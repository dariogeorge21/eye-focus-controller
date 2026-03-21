/**
 * UI Module
 * Handles DOM updates and visual elements
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
            statusMessage: document.getElementById('status-message'),
            cameraFeed: document.getElementById('camera-feed'),
            overlayCanvas: document.getElementById('overlay-canvas'),
            noFaceWarning: document.getElementById('no-face-warning')
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
     * @param {Object} callbacks - Event callbacks
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
    }

    /**
     * Update focus indicator display
     * @param {string} state - 'focused', 'distracted', 'initializing', or 'idle'
     */
    updateFocusIndicator(state) {
        const indicator = this.elements.focusIndicator;
        const text = this.elements.indicatorText;

        if (!indicator || !text) return;

        // Remove all state classes
        indicator.classList.remove('focused', 'distracted', 'initializing');

        // Add appropriate class and text
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
     * @param {Object} stats - Statistics object from FocusTracker
     */
    updateStats(stats) {
        // Min focus time
        if (this.elements.minFocus) {
            this.elements.minFocus.textContent = stats.minFocusTime !== null
                ? this.formatTime(stats.minFocusTime)
                : '--:--';
        }

        // Max focus time
        if (this.elements.maxFocus) {
            this.elements.maxFocus.textContent = stats.maxFocusTime > 0
                ? this.formatTime(stats.maxFocusTime)
                : '--:--';
        }

        // Average focus time
        if (this.elements.avgFocus) {
            this.elements.avgFocus.textContent = stats.avgFocusTime > 0
                ? this.formatTime(stats.avgFocusTime)
                : '--:--';
        }

        // Attention span
        if (this.elements.attentionSpan) {
            this.elements.attentionSpan.textContent = stats.attentionSpan !== null
                ? this.formatTime(stats.attentionSpan)
                : '--:--';
        }

        // Current session
        if (this.elements.currentSession) {
            this.elements.currentSession.textContent = this.formatTime(stats.currentSessionTime || 0);
        }

        // Session count
        if (this.elements.sessionCount) {
            this.elements.sessionCount.textContent = stats.sessionCount;
        }
    }

    /**
     * Format milliseconds to MM:SS
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time string
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
     * @param {string} message - Message text
     * @param {string} type - 'error', 'success', or 'info'
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
     * @param {boolean} isRunning - Whether tracking is running
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

        // Clear canvas if debug disabled
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
     * @param {Array} landmarks - Face landmarks from MediaPipe
     * @param {number} videoWidth - Video width
     * @param {number} videoHeight - Video height
     */
    drawFaceMesh(landmarks, videoWidth, videoHeight) {
        if (!this.debugEnabled || !this.canvasCtx || !this.elements.overlayCanvas) return;
        if (!landmarks || landmarks.length === 0) return;

        const canvas = this.elements.overlayCanvas;
        const ctx = this.canvasCtx;

        // Set canvas size to match video
        if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
        }

        // Clear previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw face mesh points
        ctx.fillStyle = 'rgba(0, 255, 136, 0.6)';

        landmarks.forEach((point, index) => {
            const x = point.x * canvas.width;
            const y = point.y * canvas.height;

            // Draw larger points for key landmarks
            const isKeyPoint = this.isKeyLandmark(index);
            const radius = isKeyPoint ? 3 : 1;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Draw connections for face outline, eyes, and iris
        this.drawFaceConnections(ctx, landmarks, canvas.width, canvas.height);
    }

    /**
     * Check if landmark index is a key point
     * @param {number} index
     * @returns {boolean}
     */
    isKeyLandmark(index) {
        const keyIndices = [
            33, 133, 362, 263,  // Eye corners
            1, 152, 10,          // Nose, chin, forehead
            468, 473             // Iris centers
        ];
        return keyIndices.includes(index);
    }

    /**
     * Draw face mesh connections
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} landmarks
     * @param {number} width
     * @param {number} height
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

        // Draw iris circles
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
        ctx.lineWidth = 2;

        // Left iris
        if (landmarks[468]) {
            const leftIris = landmarks[468];
            const leftRadius = this.getIrisRadius(landmarks, [469, 470, 471, 472]);
            ctx.beginPath();
            ctx.arc(leftIris.x * width, leftIris.y * height, leftRadius * width, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Right iris
        if (landmarks[473]) {
            const rightIris = landmarks[473];
            const rightRadius = this.getIrisRadius(landmarks, [474, 475, 476, 477]);
            ctx.beginPath();
            ctx.arc(rightIris.x * width, rightIris.y * height, rightRadius * width, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    /**
     * Draw a path connecting landmarks
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} landmarks
     * @param {Array} indices
     * @param {number} width
     * @param {number} height
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
     * Calculate iris radius from surrounding landmarks
     * @param {Array} landmarks
     * @param {Array} irisIndices
     * @returns {number}
     */
    getIrisRadius(landmarks, irisIndices) {
        const center = landmarks[irisIndices[0] - 1]; // Iris center is index before
        if (!center) return 0.01;

        let totalDist = 0;
        irisIndices.forEach(idx => {
            const point = landmarks[idx];
            if (point) {
                const dx = point.x - center.x;
                const dy = point.y - center.y;
                totalDist += Math.sqrt(dx * dx + dy * dy);
            }
        });

        return totalDist / irisIndices.length;
    }

    /**
     * Show/hide no face warning
     * @param {boolean} show
     */
    showNoFaceWarning(show) {
        if (this.elements.noFaceWarning) {
            this.elements.noFaceWarning.classList.toggle('hidden', !show);
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

        // Clear canvas
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
