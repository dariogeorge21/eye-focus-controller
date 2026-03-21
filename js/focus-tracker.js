/**
 * Focus Tracker Module
 * Manages focus state machine and calculates statistics
 */
class FocusTracker {
    constructor() {
        // State management
        this.currentState = 'idle'; // idle, focused, distracted
        this.previousState = 'idle';
        this.stateStartTime = null;

        // Debounce settings
        this.debounceMs = 500;
        this.pendingState = null;
        this.pendingStateTime = null;

        // Session tracking
        this.currentSession = null;
        this.completedSessions = [];

        // Overall statistics
        this.stats = {
            minFocusTime: null,
            maxFocusTime: 0,
            totalFocusTime: 0,
            sessionCount: 0,
            attentionSpan: null,
            distractionCount: 0,
            trackingStartTime: null
        };
    }

    /**
     * Start tracking
     */
    start() {
        this.stats.trackingStartTime = Date.now();
        this.currentState = 'idle';
        this.stateStartTime = Date.now();
    }

    /**
     * Update focus state with debouncing
     * @param {boolean} isFocused - Current focus detection result
     * @returns {{stateChanged: boolean, newState: string}}
     */
    updateState(isFocused) {
        const now = Date.now();
        const targetState = isFocused ? 'focused' : 'distracted';

        // If same as current confirmed state, clear pending
        if (targetState === this.currentState) {
            this.pendingState = null;
            this.pendingStateTime = null;
            return { stateChanged: false, newState: this.currentState };
        }

        // If different from current state, start or continue pending
        if (this.pendingState !== targetState) {
            this.pendingState = targetState;
            this.pendingStateTime = now;
            return { stateChanged: false, newState: this.currentState };
        }

        // Check if debounce period has passed
        if (now - this.pendingStateTime >= this.debounceMs) {
            // Confirm state change
            this.previousState = this.currentState;
            this.currentState = targetState;
            this.pendingState = null;
            this.pendingStateTime = null;

            // Handle state transitions
            this.handleStateTransition(this.previousState, this.currentState, now);

            return { stateChanged: true, newState: this.currentState };
        }

        return { stateChanged: false, newState: this.currentState };
    }

    /**
     * Handle state transitions
     * @param {string} fromState
     * @param {string} toState
     * @param {number} timestamp
     */
    handleStateTransition(fromState, toState, timestamp) {
        if (toState === 'focused') {
            // Starting a new focus session
            this.currentSession = {
                startTime: timestamp,
                endTime: null,
                duration: 0
            };
        } else if (toState === 'distracted' && fromState === 'focused') {
            // Ending a focus session
            if (this.currentSession) {
                this.currentSession.endTime = timestamp;
                this.currentSession.duration = timestamp - this.currentSession.startTime;

                // Only count sessions longer than 1 second
                if (this.currentSession.duration >= 1000) {
                    this.completedSessions.push({ ...this.currentSession });
                    this.updateStats();
                }

                this.currentSession = null;
            }

            this.stats.distractionCount++;
        }
    }

    /**
     * Update statistics based on completed sessions
     */
    updateStats() {
        if (this.completedSessions.length === 0) return;

        const durations = this.completedSessions.map(s => s.duration);

        // Min focus time
        this.stats.minFocusTime = Math.min(...durations);

        // Max focus time
        this.stats.maxFocusTime = Math.max(...durations);

        // Total and average
        this.stats.totalFocusTime = durations.reduce((a, b) => a + b, 0);
        this.stats.sessionCount = this.completedSessions.length;

        // Attention span (average time between distractions)
        if (this.stats.trackingStartTime && this.stats.distractionCount > 0) {
            const totalTrackingTime = Date.now() - this.stats.trackingStartTime;
            this.stats.attentionSpan = totalTrackingTime / this.stats.distractionCount;
        }
    }

    /**
     * Get current session duration
     * @returns {number} Duration in milliseconds
     */
    getCurrentSessionDuration() {
        if (!this.currentSession) return 0;
        return Date.now() - this.currentSession.startTime;
    }

    /**
     * Get formatted statistics
     * @returns {Object}
     */
    getStats() {
        // Update current session time if focused
        let currentSessionTime = 0;
        if (this.currentState === 'focused' && this.currentSession) {
            currentSessionTime = this.getCurrentSessionDuration();
        }

        return {
            minFocusTime: this.stats.minFocusTime,
            maxFocusTime: Math.max(this.stats.maxFocusTime, currentSessionTime),
            avgFocusTime: this.stats.sessionCount > 0
                ? this.stats.totalFocusTime / this.stats.sessionCount
                : 0,
            attentionSpan: this.stats.attentionSpan,
            sessionCount: this.stats.sessionCount,
            currentSessionTime,
            distractionCount: this.stats.distractionCount,
            totalFocusTime: this.stats.totalFocusTime
        };
    }

    /**
     * Get current state
     * @returns {string}
     */
    getState() {
        return this.currentState;
    }

    /**
     * Reset all statistics
     */
    reset() {
        this.currentState = 'idle';
        this.previousState = 'idle';
        this.stateStartTime = null;
        this.pendingState = null;
        this.pendingStateTime = null;
        this.currentSession = null;
        this.completedSessions = [];
        this.stats = {
            minFocusTime: null,
            maxFocusTime: 0,
            totalFocusTime: 0,
            sessionCount: 0,
            attentionSpan: null,
            distractionCount: 0,
            trackingStartTime: null
        };
    }

    /**
     * Check if tracking is active
     * @returns {boolean}
     */
    isTracking() {
        return this.stats.trackingStartTime !== null;
    }
}

// Export for use in other modules
window.FocusTracker = FocusTracker;
