/**
 * Detector Module
 * Handles MediaPipe Face Mesh integration and focus detection
 * Tracks HEAD ORIENTATION, YAWN DETECTION, and EYE CLOSURE
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
            MOUTH_RIGHT: 308,
            // Eye landmarks for EAR calculation (6 points per eye)
            LEFT_EYE: [33, 160, 158, 133, 153, 144],
            RIGHT_EYE: [362, 385, 387, 263, 373, 380]
        };

        // Thresholds
        this.THRESHOLDS = {
            YAW_MAX: 25,        // Left/right head turn
            PITCH_MAX: 20,      // Up/down head tilt
            YAWN_MAR: 0.55,     // Mouth Aspect Ratio for yawn detection
            EYE_CLOSED_EAR: 0.18 // Eye Aspect Ratio below this = eyes closed
        };

        // Yawn detection state (debounce)
        this.yawnStartTime = null;
        this.yawnDebounceMs = 800;
        this.isYawning = false;

        // Eye closure detection state (debounce)
        this.eyeClosedStartTime = null;
        this.eyeClosedDebounceMs = 1500;  // Eyes must be closed for 1.5s to trigger
        this.areEyesClosed = false;
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
                    refineLandmarks: false,
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
     * Calculate Eye Aspect Ratio (EAR)
     * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
     * Lower EAR = more closed eyes
     */
    calculateEAR(landmarks, eyeIndices) {
        const p1 = landmarks[eyeIndices[0]]; // Outer corner
        const p2 = landmarks[eyeIndices[1]]; // Upper lid 1
        const p3 = landmarks[eyeIndices[2]]; // Upper lid 2
        const p4 = landmarks[eyeIndices[3]]; // Inner corner
        const p5 = landmarks[eyeIndices[4]]; // Lower lid 2
        const p6 = landmarks[eyeIndices[5]]; // Lower lid 1

        // Vertical distances
        const v1 = this.distance(p2, p6);
        const v2 = this.distance(p3, p5);

        // Horizontal distance
        const h = this.distance(p1, p4);

        if (h === 0) return 0;
        return (v1 + v2) / (2.0 * h);
    }

    /**
     * Check for eye closure with debounce
     */
    checkEyeClosure(landmarks) {
        const leftEAR = this.calculateEAR(landmarks, this.LANDMARKS.LEFT_EYE);
        const rightEAR = this.calculateEAR(landmarks, this.LANDMARKS.RIGHT_EYE);
        const avgEAR = (leftEAR + rightEAR) / 2;

        const eyesClosed = avgEAR < this.THRESHOLDS.EYE_CLOSED_EAR;
        const now = Date.now();

        if (eyesClosed) {
            if (!this.eyeClosedStartTime) {
                this.eyeClosedStartTime = now;
            }
            // Check if eyes have been closed long enough
            if (now - this.eyeClosedStartTime >= this.eyeClosedDebounceMs) {
                this.areEyesClosed = true;
                return { areEyesClosed: true, ear: avgEAR };
            }
        } else {
            // Eyes open - reset
            this.eyeClosedStartTime = null;
            this.areEyesClosed = false;
        }

        return { areEyesClosed: this.areEyesClosed, ear: avgEAR };
    }

    /**
     * Calculate head orientation (yaw and pitch)
     */
    calculateHeadOrientation(landmarks) {
        const noseTip = landmarks[this.LANDMARKS.NOSE_TIP];
        const leftEye = landmarks[this.LANDMARKS.LEFT_EYE_OUTER];
        const rightEye = landmarks[this.LANDMARKS.RIGHT_EYE_OUTER];
        const chin = landmarks[this.LANDMARKS.CHIN];
        const forehead = landmarks[this.LANDMARKS.FOREHEAD];

        const faceCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2,
            z: (leftEye.z + rightEye.z) / 2
        };

        const eyeDistance = Math.abs(rightEye.x - leftEye.x);
        const noseOffsetX = noseTip.x - faceCenter.x;
        const yaw = (noseOffsetX / eyeDistance) * 90;

        const faceHeight = Math.abs(chin.y - forehead.y);
        const noseOffsetY = noseTip.y - faceCenter.y;
        const expectedNoseY = faceHeight * 0.15;
        const pitchOffset = noseOffsetY - expectedNoseY;
        const pitch = (pitchOffset / faceHeight) * 90;

        return { yaw, pitch };
    }

    /**
     * Calculate Mouth Aspect Ratio (MAR) for yawn detection
     */
    calculateMouthAspectRatio(landmarks) {
        const upperLip = landmarks[this.LANDMARKS.UPPER_LIP];
        const lowerLip = landmarks[this.LANDMARKS.LOWER_LIP];
        const leftCorner = landmarks[this.LANDMARKS.MOUTH_LEFT];
        const rightCorner = landmarks[this.LANDMARKS.MOUTH_RIGHT];

        const verticalDist = Math.abs(upperLip.y - lowerLip.y);
        const horizontalDist = Math.abs(rightCorner.x - leftCorner.x);

        if (horizontalDist === 0) return 0;
        return verticalDist / horizontalDist;
    }

    /**
     * Check for yawn with debounce
     */
    checkYawn(landmarks) {
        const mar = this.calculateMouthAspectRatio(landmarks);
        const mouthOpen = mar > this.THRESHOLDS.YAWN_MAR;
        const now = Date.now();

        if (mouthOpen) {
            if (!this.yawnStartTime) {
                this.yawnStartTime = now;
            }
            if (now - this.yawnStartTime >= this.yawnDebounceMs) {
                this.isYawning = true;
                return { isYawning: true, mar };
            }
        } else {
            this.yawnStartTime = null;
            this.isYawning = false;
        }

        return { isYawning: this.isYawning, mar };
    }

    /**
     * Calculate focus state from landmarks
     * Includes head orientation, yawn detection, AND eye closure
     */
    calculateFocusState(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            return {
                isFocused: false,
                isYawning: false,
                areEyesClosed: false,
                confidence: 0,
                faceDetected: false,
                metrics: null
            };
        }

        // Calculate head orientation
        const orientation = this.calculateHeadOrientation(landmarks);

        // Check if head is facing forward
        const facingScreen = Math.abs(orientation.yaw) < this.THRESHOLDS.YAW_MAX &&
                            Math.abs(orientation.pitch) < this.THRESHOLDS.PITCH_MAX;

        // Check for yawn
        const yawnResult = this.checkYawn(landmarks);

        // Check for eye closure
        const eyeResult = this.checkEyeClosure(landmarks);

        // Calculate confidence
        const yawConfidence = 1 - Math.min(Math.abs(orientation.yaw) / 45, 1);
        const pitchConfidence = 1 - Math.min(Math.abs(orientation.pitch) / 45, 1);
        const confidence = (yawConfidence + pitchConfidence) / 2;

        return {
            isFocused: facingScreen,
            isYawning: yawnResult.isYawning,
            areEyesClosed: eyeResult.areEyesClosed,
            confidence,
            faceDetected: true,
            metrics: {
                yaw: orientation.yaw.toFixed(1),
                pitch: orientation.pitch.toFixed(1),
                facingScreen,
                mouthAspectRatio: yawnResult.mar.toFixed(2),
                eyeAspectRatio: eyeResult.ear.toFixed(2)
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
