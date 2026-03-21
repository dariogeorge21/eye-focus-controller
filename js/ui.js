/**
 * UI Module
 * Handles DOM updates and visual elements
 * Includes file upload, PiP button, and yawn warning
 */
class UIManager {
    constructor() {
        // Cache DOM elements
        this.elements = {
            focusIndicator: document.getElementById('focus-indicator'),
            indicatorText: document.querySelector('.indicator-text'),
            minFocus: document.getElementById('min-focus'),
            maxFocus: document.getElementById('max-focus'),
            avgFocus: document.getElementById('avg-focus'),
            attentionSpan: document.getElementById('attention-span'),
            currentSession: document.getElementById('current-session'),
            sessionCount: document.getElementById('session-count'),
            startBtn: document.getElementById('start-btn'),
            resetBtn: document.getElementById('reset-btn'),
            toggleDebug: document.getElementById('toggle-debug'),
            pipBtn: document.getElementById('pip-btn'),
            statusMessage: document.getElementById('status-message'),
            cameraFeed: document.getElementById('camera-feed'),
            overlayCanvas: document.getElementById('overlay-canvas'),
            noFaceWarning: document.getElementById('no-face-warning'),
            yawnWarning: document.getElementById('yawn-warning'),
            // File upload elements
            alertUpload: document.getElementById('alert-upload'),
            uploadStatus: document.getElementById('upload-status'),
            clearUpload: document.getElementById('clear-upload'),
            videoOverlay: document.getElementById('video-overlay')
        };

        // Debug view state
        this.debugEnabled = false;
        this.canvasCtx = null;

        // Initialize canvas context
        if (this.elements.overlayCanvas) {
            this.canvasCtx = this.elements.overlayCanvas.getContext('2d');
        }
    }

    /**
     * Initialize UI event listeners
     */
    init(callbacks) {
        // Start button
        if (this.elements.startBtn && callbacks.onStart) {
            this.elements.startBtn.addEventListener('click', callbacks.onStart);
        }

        // Reset button
        if (this.elements.resetBtn && callbacks.onReset) {
            this.elements.resetBtn.addEventListener('click', callbacks.onReset);
        }

        // Toggle debug view
        if (this.elements.toggleDebug) {
            this.elements.toggleDebug.addEventListener('click', () => {
                this.toggleDebugView();
            });
        }

        // PiP button
        if (this.elements.pipBtn && callbacks.onPiP) {
            this.elements.pipBtn.addEventListener('click', callbacks.onPiP);
        }

        // File upload
        if (this.elements.alertUpload && callbacks.onFileUpload) {
            this.elements.alertUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    callbacks.onFileUpload(file);
                }
            });
        }

        // Clear upload button
        if (this.elements.clearUpload && callbacks.onClearUpload) {
            this.elements.clearUpload.addEventListener('click', () => {
                callbacks.onClearUpload();
                if (this.elements.alertUpload) {
                    this.elements.alertUpload.value = '';
                }
            });
        }
    }

    /**
     * Update focus indicator display
     */
    updateFocusIndicator(state) {
        const indicator = this.elements.focusIndicator;
        const text = this.elements.indicatorText;

        if (!indicator || !text) return;

        indicator.classList.remove('focused', 'distracted', 'initializing');

        switch (state) {
            case 'focused':
                indicator.classList.add('focused');
                text.textContent = 'Focus Mode ON';
                break;
            case 'distracted':
                indicator.classList.add('distracted');
                text.textContent = 'Focus Lost';
                break;
            case 'initializing':
                indicator.classList.add('initializing');
                text.textContent = 'Initializing...';
                break;
            default:
                text.textContent = 'Click Start to Begin';
        }
    }

    /**
     * Update statistics display
     */
    updateStats(stats) {
        if (this.elements.minFocus) {
            this.elements.minFocus.textContent = stats.minFocusTime !== null
                ? this.formatTime(stats.minFocusTime)
                : '--:--';
        }

        if (this.elements.maxFocus) {
            this.elements.maxFocus.textContent = stats.maxFocusTime > 0
                ? this.formatTime(stats.maxFocusTime)
                : '--:--';
        }

        if (this.elements.avgFocus) {
            this.elements.avgFocus.textContent = stats.avgFocusTime > 0
                ? this.formatTime(stats.avgFocusTime)
                : '--:--';
        }

        if (this.elements.attentionSpan) {
            this.elements.attentionSpan.textContent = stats.attentionSpan !== null
                ? this.formatTime(stats.attentionSpan)
                : '--:--';
        }

        if (this.elements.currentSession) {
            this.elements.currentSession.textContent = this.formatTime(stats.currentSessionTime || 0);
        }

        if (this.elements.sessionCount) {
            this.elements.sessionCount.textContent = stats.sessionCount;
        }
    }

    /**
     * Format milliseconds to MM:SS
     */
    formatTime(ms) {
        if (ms === null || ms === undefined || ms < 0) return '--:--';

        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        if (!this.elements.statusMessage) return;

        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
    }

    /**
     * Clear status message
     */
    clearStatus() {
        if (!this.elements.statusMessage) return;
        this.elements.statusMessage.textContent = '';
        this.elements.statusMessage.className = 'status-message';
    }

    /**
     * Update button states
     */
    updateButtons(isRunning) {
        if (this.elements.startBtn) {
            this.elements.startBtn.textContent = isRunning ? 'Stop Tracking' : 'Start Tracking';
            this.elements.startBtn.classList.toggle('stop', isRunning);
        }

        if (this.elements.resetBtn) {
            this.elements.resetBtn.disabled = isRunning;
        }

        if (this.elements.toggleDebug) {
            this.elements.toggleDebug.disabled = !isRunning;
        }

        if (this.elements.pipBtn) {
            this.elements.pipBtn.disabled = !isRunning;
        }
    }

    /**
     * Update PiP button state
     */
    updatePiPButton(isPiPActive) {
        if (this.elements.pipBtn) {
            this.elements.pipBtn.textContent = isPiPActive ? 'Exit PiP' : 'Enable PiP';
            this.elements.pipBtn.classList.toggle('active', isPiPActive);
        }
    }

    /**
     * Update upload status display
     */
    updateUploadStatus(filename, type = null) {
        if (this.elements.uploadStatus) {
            if (filename) {
                const icon = type === 'video' ? '🎬' : '🔊';
                this.elements.uploadStatus.textContent = `${icon} ${filename}`;
                this.elements.uploadStatus.classList.add('loaded');
            } else {
                this.elements.uploadStatus.textContent = 'No file selected';
                this.elements.uploadStatus.classList.remove('loaded');
            }
        }

        if (this.elements.clearUpload) {
            this.elements.clearUpload.classList.toggle('hidden', !filename);
        }
    }

    /**
     * Toggle debug view overlay
     */
    toggleDebugView() {
        this.debugEnabled = !this.debugEnabled;

        if (this.elements.toggleDebug) {
            this.elements.toggleDebug.textContent = this.debugEnabled
                ? 'Hide Debug View'
                : 'Show Debug View';
        }

        if (!this.debugEnabled && this.canvasCtx && this.elements.overlayCanvas) {
            this.canvasCtx.clearRect(
                0, 0,
                this.elements.overlayCanvas.width,
                this.elements.overlayCanvas.height
            );
        }
    }

    /**
     * Draw face mesh overlay on canvas
     */
    drawFaceMesh(landmarks, videoWidth, videoHeight) {
        if (!this.debugEnabled || !this.canvasCtx || !this.elements.overlayCanvas) return;
        if (!landmarks || landmarks.length === 0) return;

        const canvas = this.elements.overlayCanvas;
        const ctx = this.canvasCtx;

        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(0, 255, 136, 0.6)';

        landmarks.forEach((point, index) => {
            const x = point.x * canvas.width;
            const y = point.y * canvas.height;

            const isKeyPoint = this.isKeyLandmark(index);
            const radius = isKeyPoint ? 3 : 1;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
        });

        this.drawFaceConnections(ctx, landmarks, canvas.width, canvas.height);
    }

    /**
     * Check if landmark index is a key point
     */
    isKeyLandmark(index) {
        const keyIndices = [
            33, 133, 362, 263,   // Eye corners
            1, 152, 10,          // Nose, chin, forehead
            13, 14, 78, 308      // Mouth landmarks
        ];
        return keyIndices.includes(index);
    }

    /**
     * Draw face mesh connections
     */
    drawFaceConnections(ctx, landmarks, width, height) {
        ctx.strokeStyle = 'rgba(74, 144, 217, 0.4)';
        ctx.lineWidth = 1;

        // Left eye
        const leftEye = [33, 160, 158, 133, 153, 144, 33];
        this.drawPath(ctx, landmarks, leftEye, width, height);

        // Right eye
        const rightEye = [362, 385, 387, 263, 373, 380, 362];
        this.drawPath(ctx, landmarks, rightEye, width, height);

        // Mouth outline
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
        const mouth = [78, 13, 308, 14, 78];
        this.drawPath(ctx, landmarks, mouth, width, height);
    }

    /**
     * Draw a path connecting landmarks
     */
    drawPath(ctx, landmarks, indices, width, height) {
        ctx.beginPath();
        indices.forEach((idx, i) => {
            const point = landmarks[idx];
            if (!point) return;
            const x = point.x * width;
            const y = point.y * height;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    /**
     * Show/hide no face warning
     */
    showNoFaceWarning(show) {
        if (this.elements.noFaceWarning) {
            this.elements.noFaceWarning.classList.toggle('hidden', !show);
        }
    }

    /**
     * Show/hide yawn warning
     */
    showYawnWarning(show) {
        if (this.elements.yawnWarning) {
            this.elements.yawnWarning.classList.toggle('hidden', !show);
        }
    }

    /**
     * Reset UI to initial state
     */
    reset() {
        this.updateFocusIndicator('idle');
        this.updateStats({
            minFocusTime: null,
            maxFocusTime: 0,
            avgFocusTime: 0,
            attentionSpan: null,
            currentSessionTime: 0,
            sessionCount: 0
        });
        this.updateButtons(false);
        this.clearStatus();
        this.showNoFaceWarning(false);
        this.showYawnWarning(false);

        if (this.canvasCtx && this.elements.overlayCanvas) {
            this.canvasCtx.clearRect(
                0, 0,
                this.elements.overlayCanvas.width,
                this.elements.overlayCanvas.height
            );
        }
    }
}

// Export for use in other modules
window.UIManager = UIManager;
