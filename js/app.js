/**
 * Eye Focus Controller - Main Application
 * Orchestrates all modules and manages the detection loop
 * Includes PiP mode and yawn detection
 */
class EyeFocusApp {
    constructor() {
        this.camera = null;
        this.detector = null;
        this.focusTracker = null;
        this.audio = null;
        this.ui = null;

        this.isRunning = false;
        this.animationFrameId = null;
        this.backgroundInterval = null;
        this.lastFaceDetected = true;
        this.noFaceTimeout = null;

        // PiP state
        this.isPiPActive = false;

        // Yawn state
        this.isShowingYawnWarning = false;

        // Eye closure state
        this.isShowingEyeClosedWarning = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        // Initialize UI manager
        this.ui = new UIManager();
        this.ui.init({
            onStart: () => this.toggleTracking(),
            onReset: () => this.resetStats(),
            onPiP: () => this.togglePiP(),
            onFileUpload: (file) => this.handleFileUpload(file),
            onClearUpload: () => this.handleClearUpload()
        });

        // Initialize focus tracker
        this.focusTracker = new FocusTracker();

        // Initialize audio manager
        this.audio = new AudioManager();

        // Initialize detector
        this.detector = new EyeDetector();

        // Initialize camera manager
        this.camera = new CameraManager();

        // Set up visibility change handler for background operation
        this.setupVisibilityHandler();

        this.ui.showStatus('Ready. Click Start to begin tracking.', 'info');
    }

    /**
     * Set up visibility change handler for background operation
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!this.isRunning) return;

            if (document.hidden && !this.isPiPActive) {
                // Tab hidden and no PiP - switch to interval-based detection
                this.startBackgroundDetection();
            } else {
                // Tab visible or PiP active - use requestAnimationFrame
                this.stopBackgroundDetection();
            }
        });
    }

    /**
     * Start background detection using setInterval
     */
    startBackgroundDetection() {
        if (this.backgroundInterval) return;

        // Cancel rAF loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Use setInterval for background (throttled by browser to ~1 FPS)
        this.backgroundInterval = setInterval(() => {
            if (this.isRunning) {
                const video = this.camera.getVideoElement();
                if (video && video.readyState >= 2) {
                    this.detector.detect(video);
                }
            }
        }, 500);
    }

    /**
     * Stop background detection and resume rAF
     */
    stopBackgroundDetection() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }

        // Resume rAF loop if running
        if (this.isRunning && !this.animationFrameId) {
            this.runDetectionLoop();
        }
    }

    /**
     * Toggle Picture-in-Picture mode
     */
    async togglePiP() {
        const video = this.camera.getVideoElement();
        if (!video) return;

        try {
            if (this.isPiPActive) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (error) {
            console.error('PiP error:', error);
            this.ui.showStatus('PiP not supported or permission denied', 'error');
        }
    }

    /**
     * Handle file upload for custom alert
     */
    async handleFileUpload(file) {
        try {
            this.ui.showStatus('Loading custom alert...', 'info');
            const result = await this.audio.loadCustomMedia(file);
            this.ui.updateUploadStatus(result.name, result.type);
            this.ui.showStatus(`Custom ${result.type} loaded: ${result.name}`, 'success');
        } catch (error) {
            console.error('Upload error:', error);
            this.ui.showStatus('Failed to load custom alert', 'error');
        }
    }

    /**
     * Handle clearing custom upload
     */
    handleClearUpload() {
        this.audio.clearCustomMedia();
        this.ui.updateUploadStatus(null);
        this.ui.showStatus('Custom alert cleared, using default beep', 'info');
    }

    /**
     * Toggle tracking on/off
     */
    async toggleTracking() {
        if (this.isRunning) {
            this.stop();
        } else {
            await this.start();
        }
    }

    /**
     * Start tracking
     */
    async start() {
        try {
            this.ui.updateFocusIndicator('initializing');
            this.ui.showStatus('Initializing camera...', 'info');

            // Initialize camera
            await this.camera.init();

            // Set up PiP event listeners
            const video = this.camera.getVideoElement();
            video.addEventListener('enterpictureinpicture', () => {
                this.isPiPActive = true;
                this.ui.updatePiPButton(true);
                this.stopBackgroundDetection(); // PiP keeps video active
            });
            video.addEventListener('leavepictureinpicture', () => {
                this.isPiPActive = false;
                this.ui.updatePiPButton(false);
                if (document.hidden) {
                    this.startBackgroundDetection();
                }
            });

            this.ui.showStatus('Loading face detection model...', 'info');

            // Initialize audio (must be after user interaction)
            await this.audio.init();

            // Initialize detector
            await this.detector.init();

            // Set up detector callback
            this.detector.setResultsCallback((results) => {
                this.processResults(results);
            });

            // Start tracking
            this.focusTracker.start();
            this.isRunning = true;

            // Update UI
            this.ui.updateButtons(true);
            this.ui.showStatus('Tracking active', 'success');

            // Start detection loop
            this.runDetectionLoop();

        } catch (error) {
            console.error('Failed to start:', error);
            this.ui.showStatus(error.message, 'error');
            this.ui.updateFocusIndicator('idle');
            this.stop();
        }
    }

    /**
     * Stop tracking
     */
    stop() {
        this.isRunning = false;

        // Stop animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Stop background interval
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }

        // Exit PiP if active
        if (this.isPiPActive && document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => {});
        }

        // Stop camera
        if (this.camera) {
            this.camera.stop();
        }

        // Stop audio
        if (this.audio) {
            this.audio.stopAlert();
        }

        // Clear no face timeout
        if (this.noFaceTimeout) {
            clearTimeout(this.noFaceTimeout);
            this.noFaceTimeout = null;
        }

        // Update UI
        this.ui.updateButtons(false);
        this.ui.updateFocusIndicator('idle');
        this.ui.showNoFaceWarning(false);
        this.ui.showYawnWarning(false);
        this.ui.showEyeClosedWarning(false);
        this.ui.showStatus('Tracking stopped', 'info');
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.focusTracker.reset();
        this.ui.reset();
        this.ui.showStatus('Statistics reset', 'info');
    }

    /**
     * Main detection loop
     */
    runDetectionLoop() {
        if (!this.isRunning) return;

        const video = this.camera.getVideoElement();

        if (video && video.readyState >= 2) {
            this.detector.detect(video);
        }

        // Continue loop
        this.animationFrameId = requestAnimationFrame(() => this.runDetectionLoop());
    }

    /**
     * Process detection results
     */
    processResults(results) {
        if (!this.isRunning) return;

        const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0
            ? results.multiFaceLandmarks[0]
            : null;

        // Handle no face detected
        if (!landmarks) {
            this.handleNoFace();
            return;
        }

        // Face detected - clear no face warning
        this.handleFaceDetected();

        // Calculate focus state (includes yawn detection)
        const focusState = this.detector.calculateFocusState(landmarks);

        // Update live metrics panel
        this.ui.updateMetrics(focusState);

        // Update focus tracker
        const { stateChanged, newState } = this.focusTracker.updateState(focusState.isFocused);

        // Update UI
        this.ui.updateFocusIndicator(newState);
        this.ui.updateStats(this.focusTracker.getStats());

        // Draw debug overlay if enabled
        const dims = this.camera.getDimensions();
        this.ui.drawFaceMesh(landmarks, dims.width, dims.height);

        // Handle yawn detection
        this.handleYawnState(focusState.isYawning);

        // Handle eye closure detection
        this.handleEyeClosedState(focusState.areEyesClosed);

        // Handle focus/distraction audio
        if (newState === 'distracted') {
            if (!this.audio.isAlertPlaying()) {
                this.audio.startAlert();
            }
        } else if (newState === 'focused') {
            // Only stop alert if not yawning and eyes are open
            if (this.audio.isAlertPlaying() && !focusState.isYawning && !focusState.areEyesClosed) {
                this.audio.stopAlert();
            }
        }
    }

    /**
     * Handle yawn state changes
     */
    handleYawnState(isYawning) {
        if (isYawning && !this.isShowingYawnWarning) {
            // Yawn detected - show warning and play alert
            this.isShowingYawnWarning = true;
            this.ui.showYawnWarning(true);

            // Play alert for yawn if not already playing
            if (!this.audio.isAlertPlaying()) {
                this.audio.startAlert();
            }
        } else if (!isYawning && this.isShowingYawnWarning) {
            // Yawn ended - hide warning
            this.isShowingYawnWarning = false;
            this.ui.showYawnWarning(false);

            // Stop alert if focused and eyes open
            const currentState = this.focusTracker.getState();
            if (currentState === 'focused' && this.audio.isAlertPlaying() && !this.isShowingEyeClosedWarning) {
                this.audio.stopAlert();
            }
        }
    }

    /**
     * Handle eye closure state changes
     */
    handleEyeClosedState(areEyesClosed) {
        if (areEyesClosed && !this.isShowingEyeClosedWarning) {
            // Eyes closed - show warning and play alert
            this.isShowingEyeClosedWarning = true;
            this.ui.showEyeClosedWarning(true);

            // Play alert if not already playing
            if (!this.audio.isAlertPlaying()) {
                this.audio.startAlert();
            }
        } else if (!areEyesClosed && this.isShowingEyeClosedWarning) {
            // Eyes opened - hide warning
            this.isShowingEyeClosedWarning = false;
            this.ui.showEyeClosedWarning(false);

            // Stop alert if focused and not yawning
            const currentState = this.focusTracker.getState();
            if (currentState === 'focused' && this.audio.isAlertPlaying() && !this.isShowingYawnWarning) {
                this.audio.stopAlert();
            }
        }
    }

    /**
     * Handle no face detected scenario
     */
    handleNoFace() {
        if (this.lastFaceDetected) {
            this.lastFaceDetected = false;

            this.noFaceTimeout = setTimeout(() => {
                if (!this.lastFaceDetected && this.isRunning) {
                    this.ui.showNoFaceWarning(true);
                }
            }, 500);
        }
    }

    /**
     * Handle face detected after being missing
     */
    handleFaceDetected() {
        if (!this.lastFaceDetected) {
            this.lastFaceDetected = true;
            this.ui.showNoFaceWarning(false);

            if (this.noFaceTimeout) {
                clearTimeout(this.noFaceTimeout);
                this.noFaceTimeout = null;
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new EyeFocusApp();
    app.init();
});
