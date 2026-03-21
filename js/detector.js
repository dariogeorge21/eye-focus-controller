/**
 * Detector Module
 * Handles MediaPipe Face Mesh integration and focus detection
 */
class EyeDetector {
    constructor() {
        this.faceMesh = null;
        this.isInitialized = false;
        this.lastResults = null;
        this.onResults = null;

        // Landmark indices for MediaPipe Face Mesh
        this.LANDMARKS = {
            // Left eye contour
            LEFT_EYE: [33, 160, 158, 133, 153, 144],
            // Right eye contour
            RIGHT_EYE: [362, 385, 387, 263, 373, 380],
            // Iris landmarks (requires refineLandmarks: true)
            LEFT_IRIS: [468, 469, 470, 471, 472],
            RIGHT_IRIS: [473, 474, 475, 476, 477],
            // Face orientation reference points
            NOSE_TIP: 1,
            CHIN: 152,
            LEFT_EYE_OUTER: 33,
            RIGHT_EYE_OUTER: 263,
            LEFT_EYE_INNER: 133,
            RIGHT_EYE_INNER: 362,
            FOREHEAD: 10
        };

        // Focus detection thresholds (relaxed for normal use)
        this.THRESHOLDS = {
            EAR_MIN: 0.12,           // Minimum eye aspect ratio (eyes open)
            YAW_MAX: 35,             // Maximum face yaw angle (degrees)
            PITCH_MAX: 35,           // Maximum face pitch angle (degrees)
            IRIS_DEVIATION_MAX: 0.6  // Maximum iris deviation from center
        };
    }

    /**
     * Initialize MediaPipe Face Mesh
     * @returns {Promise<void>}
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
                    refineLandmarks: true,  // Enable iris tracking
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
     * @param {Function} callback
     */
    setResultsCallback(callback) {
        this.onResults = callback;
    }

    /**
     * Send video frame to detector
     * @param {HTMLVideoElement} video
     */
    async detect(video) {
        if (!this.isInitialized || !this.faceMesh) return;
        await this.faceMesh.send({ image: video });
    }

    /**
     * Calculate Eye Aspect Ratio (EAR)
     * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
     * @param {Array} landmarks - Face landmarks array
     * @param {Array} eyeIndices - Eye landmark indices
     * @returns {number} EAR value
     */
    calculateEAR(landmarks, eyeIndices) {
        const p1 = landmarks[eyeIndices[0]];
        const p2 = landmarks[eyeIndices[1]];
        const p3 = landmarks[eyeIndices[2]];
        const p4 = landmarks[eyeIndices[3]];
        const p5 = landmarks[eyeIndices[4]];
        const p6 = landmarks[eyeIndices[5]];

        // Vertical distances
        const v1 = this.distance(p2, p6);
        const v2 = this.distance(p3, p5);

        // Horizontal distance
        const h = this.distance(p1, p4);

        if (h === 0) return 0;
        return (v1 + v2) / (2.0 * h);
    }

    /**
     * Calculate distance between two 3D points
     * @param {Object} p1
     * @param {Object} p2
     * @returns {number}
     */
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculate face orientation (yaw, pitch, roll)
     * @param {Array} landmarks
     * @returns {{yaw: number, pitch: number, roll: number}}
     */
    calculateFaceOrientation(landmarks) {
        const noseTip = landmarks[this.LANDMARKS.NOSE_TIP];
        const chin = landmarks[this.LANDMARKS.CHIN];
        const leftEye = landmarks[this.LANDMARKS.LEFT_EYE_OUTER];
        const rightEye = landmarks[this.LANDMARKS.RIGHT_EYE_OUTER];
        const forehead = landmarks[this.LANDMARKS.FOREHEAD];

        // Calculate yaw (left-right rotation)
        const eyeCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2
        };
        const yaw = Math.atan2(noseTip.x - eyeCenter.x, noseTip.z - ((leftEye.z + rightEye.z) / 2)) * (180 / Math.PI);

        // Calculate pitch (up-down rotation)
        const faceHeight = this.distance(forehead, chin);
        const noseOffset = noseTip.y - eyeCenter.y;
        const pitch = Math.asin(noseOffset / (faceHeight * 0.5)) * (180 / Math.PI);

        // Calculate roll (tilt)
        const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

        return { yaw, pitch, roll };
    }

    /**
     * Calculate iris deviation from eye center
     * @param {Array} landmarks
     * @returns {{left: number, right: number, centered: boolean}}
     */
    calculateIrisDeviation(landmarks) {
        // Left iris center
        const leftIrisCenter = landmarks[this.LANDMARKS.LEFT_IRIS[0]];
        const leftEyeInner = landmarks[this.LANDMARKS.LEFT_EYE_INNER];
        const leftEyeOuter = landmarks[this.LANDMARKS.LEFT_EYE_OUTER];

        // Right iris center
        const rightIrisCenter = landmarks[this.LANDMARKS.RIGHT_IRIS[0]];
        const rightEyeInner = landmarks[this.LANDMARKS.RIGHT_EYE_INNER];
        const rightEyeOuter = landmarks[this.LANDMARKS.RIGHT_EYE_OUTER];

        // Calculate eye centers
        const leftEyeCenter = {
            x: (leftEyeInner.x + leftEyeOuter.x) / 2,
            y: (leftEyeInner.y + leftEyeOuter.y) / 2
        };
        const rightEyeCenter = {
            x: (rightEyeInner.x + rightEyeOuter.x) / 2,
            y: (rightEyeInner.y + rightEyeOuter.y) / 2
        };

        // Calculate eye widths for normalization
        const leftEyeWidth = this.distance(leftEyeInner, leftEyeOuter);
        const rightEyeWidth = this.distance(rightEyeInner, rightEyeOuter);

        // Calculate normalized deviation
        const leftDeviation = leftEyeWidth > 0
            ? this.distance(leftIrisCenter, leftEyeCenter) / leftEyeWidth
            : 0;
        const rightDeviation = rightEyeWidth > 0
            ? this.distance(rightIrisCenter, rightEyeCenter) / rightEyeWidth
            : 0;

        const avgDeviation = (leftDeviation + rightDeviation) / 2;

        return {
            left: leftDeviation,
            right: rightDeviation,
            average: avgDeviation,
            centered: avgDeviation < this.THRESHOLDS.IRIS_DEVIATION_MAX
        };
    }

    /**
     * Calculate focus state from landmarks
     * @param {Array} landmarks
     * @returns {{isFocused: boolean, confidence: number, metrics: Object}}
     */
    calculateFocusState(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            return {
                isFocused: false,
                confidence: 0,
                faceDetected: false,
                metrics: null
            };
        }

        // Calculate Eye Aspect Ratio
        const leftEAR = this.calculateEAR(landmarks, this.LANDMARKS.LEFT_EYE);
        const rightEAR = this.calculateEAR(landmarks, this.LANDMARKS.RIGHT_EYE);
        const avgEAR = (leftEAR + rightEAR) / 2;
        const eyesOpen = avgEAR > this.THRESHOLDS.EAR_MIN;

        // Calculate face orientation
        const orientation = this.calculateFaceOrientation(landmarks);
        const facingForward = Math.abs(orientation.yaw) < this.THRESHOLDS.YAW_MAX &&
                             Math.abs(orientation.pitch) < this.THRESHOLDS.PITCH_MAX;

        // Calculate iris deviation
        const irisDeviation = this.calculateIrisDeviation(landmarks);

        // Determine focus state
        const isFocused = eyesOpen && facingForward && irisDeviation.centered;

        // Calculate confidence score (0-1)
        const earScore = Math.min(avgEAR / 0.3, 1);
        const yawScore = 1 - Math.min(Math.abs(orientation.yaw) / 45, 1);
        const pitchScore = 1 - Math.min(Math.abs(orientation.pitch) / 45, 1);
        const irisScore = 1 - Math.min(irisDeviation.average / 0.5, 1);

        const confidence = (earScore * 0.2 + yawScore * 0.3 + pitchScore * 0.2 + irisScore * 0.3);

        return {
            isFocused,
            confidence,
            faceDetected: true,
            metrics: {
                ear: avgEAR,
                eyesOpen,
                orientation,
                facingForward,
                irisDeviation: irisDeviation.average,
                irisCentered: irisDeviation.centered
            }
        };
    }

    /**
     * Get last detection results
     * @returns {Object|null}
     */
    getLastResults() {
        return this.lastResults;
    }

    /**
     * Get landmarks from last results
     * @returns {Array|null}
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
