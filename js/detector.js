/**
 * Detector Module
 * Handles MediaPipe Face Mesh integration and focus detection
 * Tracks HEAD ORIENTATION and YAWN DETECTION
 */
class EyeDetector {
    constructor() {
        this.faceMesh = null;
        this.isInitialized = false;
        this.lastResults = null;
        this.onResults = null;

        // Landmark indices for MediaPipe Face Mesh
        this.LANDMARKS = {
            NOSE_TIP: 1,
            CHIN: 152,
            LEFT_EYE_OUTER: 33,
            RIGHT_EYE_OUTER: 263,
            FOREHEAD: 10,
            LEFT_CHEEK: 234,
            RIGHT_CHEEK: 454,
            // Mouth landmarks for yawn detection
            UPPER_LIP: 13,
            LOWER_LIP: 14,
            MOUTH_LEFT: 78,
            MOUTH_RIGHT: 308
        };

        // Thresholds
        this.THRESHOLDS = {
            YAW_MAX: 25,        // Left/right head turn
            PITCH_MAX: 20,      // Up/down head tilt
            YAWN_MAR: 0.55      // Mouth Aspect Ratio for yawn detection
        };

        // Yawn detection state (debounce)
        this.yawnStartTime = null;
        this.yawnDebounceMs = 800;  // Mouth must be open for 800ms to count as yawn
        this.isYawning = false;
    }

    /**
     * Initialize MediaPipe Face Mesh
     */
    async init() {
        return new Promise((resolve, reject) => {
            try {
                this.faceMesh = new FaceMesh({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
                    }
                });

                this.faceMesh.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: false,  // Don't need iris for head tracking
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                this.faceMesh.onResults((results) => {
                    this.lastResults = results;
                    if (this.onResults) {
                        this.onResults(results);
                    }
                });

                this.faceMesh.initialize().then(() => {
                    this.isInitialized = true;
                    resolve();
                }).catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Set callback for detection results
     */
    setResultsCallback(callback) {
        this.onResults = callback;
    }

    /**
     * Send video frame to detector
     */
    async detect(video) {
        if (!this.isInitialized || !this.faceMesh) return;
        await this.faceMesh.send({ image: video });
    }

    /**
     * Calculate distance between two points
     */
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculate head orientation (yaw and pitch)
     * Uses nose position relative to face center
     */
    calculateHeadOrientation(landmarks) {
        const noseTip = landmarks[this.LANDMARKS.NOSE_TIP];
        const leftEye = landmarks[this.LANDMARKS.LEFT_EYE_OUTER];
        const rightEye = landmarks[this.LANDMARKS.RIGHT_EYE_OUTER];
        const chin = landmarks[this.LANDMARKS.CHIN];
        const forehead = landmarks[this.LANDMARKS.FOREHEAD];

        // Face center (between eyes)
        const faceCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2,
            z: (leftEye.z + rightEye.z) / 2
        };

        // Calculate YAW (left-right rotation)
        // When head turns left, nose moves left relative to eye center
        // When head turns right, nose moves right relative to eye center
        const eyeDistance = Math.abs(rightEye.x - leftEye.x);
        const noseOffsetX = noseTip.x - faceCenter.x;
        const yaw = (noseOffsetX / eyeDistance) * 90; // Normalize to degrees

        // Calculate PITCH (up-down rotation)
        // When head tilts down, nose moves down relative to eye center
        // When head tilts up, nose moves up relative to eye center
        const faceHeight = Math.abs(chin.y - forehead.y);
        const noseOffsetY = noseTip.y - faceCenter.y;
        const expectedNoseY = faceHeight * 0.15; // Nose is normally slightly below eyes
        const pitchOffset = noseOffsetY - expectedNoseY;
        const pitch = (pitchOffset / faceHeight) * 90; // Normalize to degrees

        return { yaw, pitch };
    }

    /**
     * Calculate Mouth Aspect Ratio (MAR) for yawn detection
     * MAR = vertical distance / horizontal distance
     */
    calculateMouthAspectRatio(landmarks) {
        const upperLip = landmarks[this.LANDMARKS.UPPER_LIP];
        const lowerLip = landmarks[this.LANDMARKS.LOWER_LIP];
        const leftCorner = landmarks[this.LANDMARKS.MOUTH_LEFT];
        const rightCorner = landmarks[this.LANDMARKS.MOUTH_RIGHT];

        // Vertical distance (mouth opening)
        const verticalDist = Math.abs(upperLip.y - lowerLip.y);

        // Horizontal distance (mouth width)
        const horizontalDist = Math.abs(rightCorner.x - leftCorner.x);

        if (horizontalDist === 0) return 0;

        return verticalDist / horizontalDist;
    }

    /**
     * Check for yawn with debounce
     * Returns true if mouth has been open wide for sustained period
     */
    checkYawn(landmarks) {
        const mar = this.calculateMouthAspectRatio(landmarks);
        const mouthOpen = mar > this.THRESHOLDS.YAWN_MAR;
        const now = Date.now();

        if (mouthOpen) {
            if (!this.yawnStartTime) {
                this.yawnStartTime = now;
            }
            // Check if mouth has been open long enough
            if (now - this.yawnStartTime >= this.yawnDebounceMs) {
                this.isYawning = true;
                return { isYawning: true, mar };
            }
        } else {
            // Mouth closed - reset
            this.yawnStartTime = null;
            this.isYawning = false;
        }

        return { isYawning: this.isYawning, mar };
    }

    /**
     * Calculate focus state from landmarks
     * Includes head orientation AND yawn detection
     */
    calculateFocusState(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            return {
                isFocused: false,
                isYawning: false,
                confidence: 0,
                faceDetected: false,
                metrics: null
            };
        }

        // Calculate head orientation
        const orientation = this.calculateHeadOrientation(landmarks);

        // Check if head is facing forward (within thresholds)
        const facingScreen = Math.abs(orientation.yaw) < this.THRESHOLDS.YAW_MAX &&
                            Math.abs(orientation.pitch) < this.THRESHOLDS.PITCH_MAX;

        // Check for yawn
        const yawnResult = this.checkYawn(landmarks);

        // Calculate confidence based on how centered the head is
        const yawConfidence = 1 - Math.min(Math.abs(orientation.yaw) / 45, 1);
        const pitchConfidence = 1 - Math.min(Math.abs(orientation.pitch) / 45, 1);
        const confidence = (yawConfidence + pitchConfidence) / 2;

        return {
            isFocused: facingScreen,
            isYawning: yawnResult.isYawning,
            confidence,
            faceDetected: true,
            metrics: {
                yaw: orientation.yaw.toFixed(1),
                pitch: orientation.pitch.toFixed(1),
                facingScreen,
                mouthAspectRatio: yawnResult.mar.toFixed(2)
            }
        };
    }

    /**
     * Get landmarks from last results
     */
    getLandmarks() {
        if (!this.lastResults || !this.lastResults.multiFaceLandmarks ||
            this.lastResults.multiFaceLandmarks.length === 0) {
            return null;
        }
        return this.lastResults.multiFaceLandmarks[0];
    }
}

// Export for use in other modules
window.EyeDetector = EyeDetector;
