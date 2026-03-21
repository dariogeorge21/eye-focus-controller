/**
 * Eye Focus Controller - Main Application
 * Orchestrates all modules and manages the detection loop
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
        this.lastFaceDetected = true;
        this.noFaceTimeout = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        // Initialize UI manager
        this.ui = new UIManager();
        this.ui.init({
            onStart: () => this.toggleTracking(),
            onReset: () => this.resetStats()
        });

        // Initialize focus tracker
        this.focusTracker = new FocusTracker();

        // Initialize audio manager
        this.audio = new AudioManager();

        // Initialize detector
        this.detector = new EyeDetector();

        // Initialize camera manager
        this.camera = new CameraManager();

        this.ui.showStatus('Ready. Click Start to begin tracking.', 'info');
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
            // Send frame to detector
            this.detector.detect(video);
        }

        // Continue loop
        this.animationFrameId = requestAnimationFrame(() => this.runDetectionLoop());
    }

    /**
     * Process detection results
     * @param {Object} results - MediaPipe Face Mesh results
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

        // Calculate focus state
        const focusState = this.detector.calculateFocusState(landmarks);

        // Update focus tracker
        const { stateChanged, newState } = this.focusTracker.updateState(focusState.isFocused);

        // Update UI
        this.ui.updateFocusIndicator(newState);
        this.ui.updateStats(this.focusTracker.getStats());

        // Draw debug overlay if enabled
        const dims = this.camera.getDimensions();
        this.ui.drawFaceMesh(landmarks, dims.width, dims.height);

        // Handle state change for audio
        if (stateChanged) {
            if (newState === 'distracted') {
                this.audio.startAlert();
            } else if (newState === 'focused') {
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

            // Show warning after short delay
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
