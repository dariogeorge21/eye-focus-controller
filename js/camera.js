/**
 * Camera Module
 * Handles WebRTC camera access and video stream management
 */
class CameraManager {
    constructor() {
        this.videoElement = null;
        this.stream = null;
        this.isRunning = false;
    }

    /**
     * Initialize camera and start video stream
     * @returns {Promise<HTMLVideoElement>} The video element with camera feed
     */
    async init() {
        this.videoElement = document.getElementById('camera-feed');

        if (!this.videoElement) {
            throw new Error('Video element not found');
        }

        // Check for camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported in this browser');
        }

        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play()
                        .then(resolve)
                        .catch(reject);
                };
                this.videoElement.onerror = reject;
            });

            this.isRunning = true;
            return this.videoElement;
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera permission denied. Please allow camera access.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera found. Please connect a camera.');
            } else {
                throw new Error(`Camera error: ${error.message}`);
            }
        }
    }

    /**
     * Get the video element
     * @returns {HTMLVideoElement}
     */
    getVideoElement() {
        return this.videoElement;
    }

    /**
     * Get video dimensions
     * @returns {{width: number, height: number}}
     */
    getDimensions() {
        if (!this.videoElement) return { width: 640, height: 480 };
        return {
            width: this.videoElement.videoWidth || 640,
            height: this.videoElement.videoHeight || 480
        };
    }

    /**
     * Stop camera stream and release resources
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        this.isRunning = false;
    }

    /**
     * Check if camera is running
     * @returns {boolean}
     */
    isActive() {
        return this.isRunning && this.stream !== null;
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;
