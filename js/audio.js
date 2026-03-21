/**
 * Audio Module
 * Handles beeping alert sound using Web Audio API
 */
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.beepInterval = null;
        this.gainNode = null;
        this.isInitialized = false;

        // Beep settings
        this.beepFrequency = 800;     // Hz
        this.beepDuration = 200;      // ms
        this.beepInterval_ms = 1000;  // ms between beeps
        this.volume = 0.3;            // 0-1
    }

    /**
     * Initialize audio context (must be called after user interaction)
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create master gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.volume;
            this.gainNode.connect(this.audioContext.destination);

            // Resume context if suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            throw new Error('Audio initialization failed');
        }
    }

    /**
     * Play a single beep
     */
    playBeep() {
        if (!this.isInitialized || !this.audioContext) return;

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const oscillator = this.audioContext.createOscillator();
        const beepGain = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = this.beepFrequency;

        // Connect oscillator -> beepGain -> masterGain -> destination
        oscillator.connect(beepGain);
        beepGain.connect(this.gainNode);

        const now = this.audioContext.currentTime;
        const duration = this.beepDuration / 1000;

        // Envelope for smooth beep
        beepGain.gain.setValueAtTime(0, now);
        beepGain.gain.linearRampToValueAtTime(1, now + 0.01);
        beepGain.gain.setValueAtTime(1, now + duration - 0.05);
        beepGain.gain.linearRampToValueAtTime(0, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    /**
     * Start continuous beeping alert
     */
    startAlert() {
        if (this.isPlaying) return;

        this.isPlaying = true;

        // Play first beep immediately
        this.playBeep();

        // Set up interval for continuous beeping
        this.beepInterval = setInterval(() => {
            if (this.isPlaying) {
                this.playBeep();
            }
        }, this.beepInterval_ms);
    }

    /**
     * Stop beeping alert
     */
    stopAlert() {
        if (!this.isPlaying) return;

        this.isPlaying = false;

        if (this.beepInterval) {
            clearInterval(this.beepInterval);
            this.beepInterval = null;
        }
    }

    /**
     * Set volume
     * @param {number} value - Volume from 0 to 1
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }

    /**
     * Set beep frequency
     * @param {number} hz - Frequency in Hz
     */
    setFrequency(hz) {
        this.beepFrequency = hz;
    }

    /**
     * Set beep interval
     * @param {number} ms - Interval in milliseconds
     */
    setBeepInterval(ms) {
        this.beepInterval_ms = ms;

        // Restart if currently playing to apply new interval
        if (this.isPlaying) {
            this.stopAlert();
            this.startAlert();
        }
    }

    /**
     * Check if audio is currently playing
     * @returns {boolean}
     */
    isAlertPlaying() {
        return this.isPlaying;
    }

    /**
     * Clean up audio resources
     */
    dispose() {
        this.stopAlert();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;
    }
}

// Export for use in other modules
window.AudioManager = AudioManager;
