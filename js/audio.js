/**
 * Audio/Media Module
 * Handles default audio (pari.mp3) AND custom audio/video uploads
 */
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.isInitialized = false;
        this.volume = 0.5;

        // Default audio (from assets)
        this.defaultAudio = null;
        this.defaultAudioPath = 'assets/pari.mp3';

        // Custom media (user uploaded)
        this.customAudio = null;
        this.customVideo = null;
        this.videoOverlay = null;
        this.hasCustomMedia = false;
        this.mediaType = null;  // 'audio' or 'video'
    }

    /**
     * Initialize audio - loads default audio from assets
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Load default audio from assets
            this.defaultAudio = new Audio(this.defaultAudioPath);
            this.defaultAudio.loop = true;
            this.defaultAudio.volume = this.volume;

            // Preload default audio
            await new Promise((resolve, reject) => {
                this.defaultAudio.oncanplaythrough = resolve;
                this.defaultAudio.onerror = () => {
                    console.warn('Default audio not found, will use uploaded audio only');
                    resolve(); // Don't fail if default audio missing
                };
                this.defaultAudio.load();
            });

            // Get video overlay elements
            this.videoOverlay = document.getElementById('video-overlay');
            this.customVideo = document.getElementById('alert-video');

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize audio:', error);
            throw new Error('Audio initialization failed');
        }
    }

    /**
     * Load custom media file (audio or video)
     */
    async loadCustomMedia(file) {
        const fileType = file.type.split('/')[0]; // 'audio' or 'video'
        const fileURL = URL.createObjectURL(file);

        // Clean up previous custom media
        this.clearCustomMedia();

        if (fileType === 'audio') {
            this.customAudio = new Audio(fileURL);
            this.customAudio.loop = true;
            this.customAudio.volume = this.volume;

            await new Promise((resolve, reject) => {
                this.customAudio.oncanplaythrough = resolve;
                this.customAudio.onerror = reject;
                this.customAudio.load();
            });

            this.mediaType = 'audio';
            this.hasCustomMedia = true;

        } else if (fileType === 'video') {
            if (this.customVideo) {
                this.customVideo.src = fileURL;
                this.customVideo.loop = true;
                this.customVideo.volume = this.volume;

                await new Promise((resolve, reject) => {
                    this.customVideo.oncanplaythrough = resolve;
                    this.customVideo.onerror = reject;
                    this.customVideo.load();
                });

                this.mediaType = 'video';
                this.hasCustomMedia = true;
            }
        }

        return { type: this.mediaType, name: file.name };
    }

    /**
     * Clear custom media (reverts to default audio)
     */
    clearCustomMedia() {
        if (this.customAudio) {
            this.customAudio.pause();
            this.customAudio.src = '';
            this.customAudio = null;
        }

        if (this.customVideo) {
            this.customVideo.pause();
            this.customVideo.src = '';
        }

        if (this.videoOverlay) {
            this.videoOverlay.classList.add('hidden');
        }

        this.hasCustomMedia = false;
        this.mediaType = null;
    }

    /**
     * Start alert (custom media or default audio)
     */
    startAlert() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        if (this.hasCustomMedia) {
            this.playCustomMedia();
        } else {
            this.playDefaultAudio();
        }
    }

    /**
     * Play default audio from assets/pari.mp3
     */
    playDefaultAudio() {
        if (this.defaultAudio) {
            this.defaultAudio.currentTime = 0;
            this.defaultAudio.play().catch(console.error);
        }
    }

    /**
     * Play custom media (audio or video)
     */
    playCustomMedia() {
        if (this.mediaType === 'audio' && this.customAudio) {
            this.customAudio.currentTime = 0;
            this.customAudio.play().catch(console.error);

        } else if (this.mediaType === 'video' && this.customVideo) {
            this.customVideo.currentTime = 0;
            this.customVideo.play().catch(console.error);

            if (this.videoOverlay) {
                this.videoOverlay.classList.remove('hidden');
            }
        }
    }

    /**
     * Stop alert
     */
    stopAlert() {
        if (!this.isPlaying) return;
        this.isPlaying = false;

        // Stop default audio
        if (this.defaultAudio) {
            this.defaultAudio.pause();
        }

        // Stop custom audio
        if (this.customAudio) {
            this.customAudio.pause();
        }

        // Stop custom video and hide overlay
        if (this.customVideo) {
            this.customVideo.pause();
        }
        if (this.videoOverlay) {
            this.videoOverlay.classList.add('hidden');
        }
    }

    /**
     * Set volume for all audio sources
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));

        if (this.defaultAudio) {
            this.defaultAudio.volume = this.volume;
        }
        if (this.customAudio) {
            this.customAudio.volume = this.volume;
        }
        if (this.customVideo) {
            this.customVideo.volume = this.volume;
        }
    }

    /**
     * Check if alert is playing
     */
    isAlertPlaying() {
        return this.isPlaying;
    }

    /**
     * Check if custom media is loaded
     */
    hasCustomAlert() {
        return this.hasCustomMedia;
    }

    /**
     * Get current media type
     */
    getMediaType() {
        return this.mediaType;
    }

    /**
     * Clean up
     */
    dispose() {
        this.stopAlert();
        this.clearCustomMedia();

        if (this.defaultAudio) {
            this.defaultAudio.src = '';
            this.defaultAudio = null;
        }

        this.isInitialized = false;
    }
}

// Export for use in other modules
window.AudioManager = AudioManager;
