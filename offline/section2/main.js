// section2/main.js - FIXED VERSION
document.addEventListener('DOMContentLoaded', function() {
    const tvVideo = document.getElementById('tv-video');
    const channelNumber = document.getElementById('channel-number');
    const remoteChannel = document.getElementById('remote-channel');
    const remoteStatus = document.getElementById('remote-status');
    const retroStatus = document.getElementById('retro-status');
    const staticOverlay = document.getElementById('static-overlay');
    const pixelOverlay = document.getElementById('pixel-overlay');
    const scanlines = document.getElementById('scanlines');
    const powerBtn = document.getElementById('power-btn');
    const prevChannelBtn = document.getElementById('prev-channel');
    const nextChannelBtn = document.getElementById('next-channel');
    const numberButtons = document.querySelectorAll('.num-btn');
    const retroBtn = document.getElementById('retro-btn');
    const aspectInfo = document.getElementById('aspect-info');
    const bufferStatus = document.getElementById('buffer-status');

    const totalChannels = 5;
    let currentChannel = 1;
    let isPoweredOn = true;
    let isVideoPlaying = false;
    let isRetroMode = false;
    
    // === FIX: Correct video paths ===
    const videoSources = [];
    for (let i = 1; i <= totalChannels; i++) {
        videoSources.push(`/offline/videos/vid${i}.mp4`);
    }

    // Pre-load buffers for videos
    const videoBuffers = {};
    let isLoading = false;
    let loadedVideos = new Set();

    // Function to pre-load videos
    function preloadVideo(channel) {
        if (loadedVideos.has(channel) || isLoading) return;
        
        const videoUrl = videoSources[channel - 1];
        console.log(`📥 Preloading video for channel ${channel}: ${videoUrl}`);
        
        bufferStatus.textContent = `Preloading channel ${channel}...`;
        bufferStatus.style.color = '#ff9800';
        
        // Create a hidden video element for preloading
        const preloadVideo = document.createElement('video');
        preloadVideo.preload = 'auto';
        preloadVideo.src = videoUrl;
        preloadVideo.style.display = 'none';
        document.body.appendChild(preloadVideo);
        
        preloadVideo.addEventListener('loadeddata', () => {
            console.log(`✅ Video preloaded for channel ${channel}`);
            loadedVideos.add(channel);
            videoBuffers[channel] = true;
            updateBufferStatus();
            document.body.removeChild(preloadVideo);
        });
        
        preloadVideo.addEventListener('error', (e) => {
            console.error(`❌ Failed to preload video for channel ${channel}:`, e);
            bufferStatus.textContent = `Failed to load channel ${channel}`;
            bufferStatus.style.color = '#f44336';
            document.body.removeChild(preloadVideo);
        });
        
        // Start preloading
        preloadVideo.load();
    }

    // Function to update buffer status
    function updateBufferStatus() {
        const loaded = loadedVideos.size;
        if (loaded === totalChannels) {
            bufferStatus.textContent = `✅ All ${totalChannels} videos loaded`;
            bufferStatus.style.color = '#4caf50';
        } else {
            bufferStatus.textContent = `📥 ${loaded}/${totalChannels} videos loaded`;
            bufferStatus.style.color = loaded > 0 ? '#ff9800' : '#ff5252';
        }
    }

    // Function to update TV display
    function updateTV() {
        if (isPoweredOn) {
            // TV is on - show video
            tvVideo.src = videoSources[currentChannel - 1];
            tvVideo.controls = false;
            staticOverlay.style.opacity = '0';
            channelNumber.textContent = currentChannel.toString().padStart(2, '0');
            remoteChannel.textContent = currentChannel.toString().padStart(2, '0');
            remoteStatus.textContent = 'ON';
            remoteStatus.style.color = '#4caf50';
            powerBtn.style.background = 'linear-gradient(to bottom, #4caf50, #2e7d32)';

            // Update aspect ratio info
            updateAspectInfo();

            // Try to play video
            const playPromise = tvVideo.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    isVideoPlaying = true;
                    // Preload next and previous videos for smooth transition
                    preloadVideo(currentChannel === totalChannels ? 1 : currentChannel + 1);
                    preloadVideo(currentChannel === 1 ? totalChannels : currentChannel - 1);
                }).catch((error) => {
                    console.log('Autoplay prevented, showing controls');
                    tvVideo.controls = true;
                    isVideoPlaying = false;
                });
            }
        } else {
            // TV is off
            tvVideo.pause();
            tvVideo.controls = false;
            staticOverlay.style.opacity = '0.8';
            channelNumber.textContent = '--';
            remoteChannel.textContent = '--';
            remoteStatus.textContent = 'OFF';
            remoteStatus.style.color = '#ff5252';
            powerBtn.style.background = 'linear-gradient(to bottom, #ff4444, #cc0000)';
            isVideoPlaying = false;
            aspectInfo.textContent = 'TV OFF';
        }
    }

    // Function to update aspect ratio info
    function updateAspectInfo() {
        if (!isPoweredOn) return;

        // Use loadedmetadata event
        const handleMetadata = function() {
            const videoWidth = tvVideo.videoWidth;
            const videoHeight = tvVideo.videoHeight;
            const aspectRatio = videoWidth / videoHeight;

            if (Math.abs(aspectRatio - (4/3)) < 0.1) {
                aspectInfo.textContent = '4:3 Native';
            } else if (Math.abs(aspectRatio - (16/9)) < 0.1) {
                aspectInfo.textContent = '16:9 in 4:3 TV';
            } else if (Math.abs(aspectRatio - 1) < 0.1) {
                aspectInfo.textContent = '1:1 Square';
            } else {
                aspectInfo.textContent = `${videoWidth}:${videoHeight}`;
            }

            // Adjust object-fit based on aspect ratio
            if (aspectRatio > 1.4) { // Widescreen (16:9)
                tvVideo.style.objectFit = 'contain'; // Show with bars
            } else if (aspectRatio < 1.2) { // Tall/square
                tvVideo.style.objectFit = 'cover'; // Fill screen
            } else { // 4:3-ish
                tvVideo.style.objectFit = 'cover'; // Fill screen
            }
        };

        // Remove previous listeners and add new one
        tvVideo.removeEventListener('loadedmetadata', handleMetadata);
        tvVideo.addEventListener('loadedmetadata', handleMetadata, { once: true });
    }

    // Function to toggle retro effects
    function toggleRetroMode() {
        isRetroMode = !isRetroMode;

        if (isRetroMode) {
            // Retro ON
            pixelOverlay.classList.remove('retro-off');
            scanlines.classList.remove('retro-off');
            retroBtn.classList.remove('active');
            retroBtn.style.background = 'linear-gradient(to bottom, #444, #222)';
            retroStatus.textContent = 'RETRO ON';
            retroStatus.style.color = '#ff9800';
            retroBtn.title = "Turn off retro effects";
        } else {
            // Retro OFF
            pixelOverlay.classList.add('retro-off');
            scanlines.classList.add('retro-off');
            retroBtn.classList.add('active');
            retroBtn.style.background = 'linear-gradient(to bottom, #4caf50, #2e7d32)';
            retroStatus.textContent = 'RETRO OFF';
            retroStatus.style.color = '#4caf50';
            retroBtn.title = "Turn on retro effects";
        }
    }

    // Function to change channel
    function changeChannel(newChannel) {
        if (!isPoweredOn) return;

        // Show static effect when changing channels
        staticOverlay.style.opacity = '0.7';

        // Pause current video
        tvVideo.pause();
        isVideoPlaying = false;

        setTimeout(() => {
            currentChannel = newChannel;
            updateTV();

            // Hide static after video loads
            setTimeout(() => {
                staticOverlay.style.opacity = '0';
            }, 300);
        }, 200);
    }

    // Power button event
    powerBtn.addEventListener('click', function() {
        isPoweredOn = !isPoweredOn;
        updateTV();

        // Animate power button
        powerBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            powerBtn.style.transform = 'scale(1)';
        }, 150);
    });

    // Previous channel button
    prevChannelBtn.addEventListener('click', function() {
        if (!isPoweredOn) return;

        let newChannel = currentChannel - 1;
        if (newChannel < 1) newChannel = totalChannels;
        changeChannel(newChannel);
    });

    // Next channel button
    nextChannelBtn.addEventListener('click', function() {
        if (!isPoweredOn) return;

        let newChannel = currentChannel + 1;
        if (newChannel > totalChannels) newChannel = 1;
        changeChannel(newChannel);
    });

    // Number pad buttons
    numberButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (!isPoweredOn) return;

            const channel = parseInt(this.getAttribute('data-channel'));
            if (channel >= 1 && channel <= totalChannels) {
                changeChannel(channel);
            }
        });
    });

    // Retro mode toggle button
    retroBtn.addEventListener('click', function() {
        toggleRetroMode();

        // Animate button
        retroBtn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            retroBtn.style.transform = 'scale(1)';
        }, 150);
    });

    // Keyboard controls
    document.addEventListener('keydown', function(event) {
        if (!isPoweredOn) return;

        // Number keys 1-5 for channels
        if (event.key >= '1' && event.key <= '5') {
            const channel = parseInt(event.key);
            changeChannel(channel);
        }
        // Arrow keys for channel navigation
        else if (event.key === 'ArrowLeft') {
            let newChannel = currentChannel - 1;
            if (newChannel < 1) newChannel = totalChannels;
            changeChannel(newChannel);
        } else if (event.key === 'ArrowRight') {
            let newChannel = currentChannel + 1;
            if (newChannel > totalChannels) newChannel = 1;
            changeChannel(newChannel);
        }
        // Space bar for power toggle
        else if (event.key === ' ') {
            event.preventDefault(); // Prevent page scroll
            isPoweredOn = !isPoweredOn;
            updateTV();
        }
        // P key to play/pause video
        else if (event.key === 'p' || event.key === 'P') {
            if (isPoweredOn) {
                if (tvVideo.paused) {
                    tvVideo.play();
                    isVideoPlaying = true;
                } else {
                    tvVideo.pause();
                    isVideoPlaying = false;
                }
            }
        }
        // R key to toggle retro mode
        else if (event.key === 'r' || event.key === 'R') {
            toggleRetroMode();
        }
        // B key to force buffer all videos
        else if (event.key === 'b' || event.key === 'B') {
            preloadAllVideos();
        }
    });

    // Function to preload all videos
    function preloadAllVideos() {
        console.log('🔄 Preloading all videos...');
        bufferStatus.textContent = 'Preloading all videos...';
        bufferStatus.style.color = '#2196f3';
        
        for (let i = 1; i <= totalChannels; i++) {
            if (!loadedVideos.has(i)) {
                preloadVideo(i);
            }
        }
    }

    // Initialize TV
    updateTV();
    toggleRetroMode(); // Set initial retro mode
    
    // Preload current video and next one
    setTimeout(() => {
        preloadVideo(currentChannel);
        preloadVideo(currentChannel === totalChannels ? 1 : currentChannel + 1);
    }, 1000);

    // Video event listeners
    tvVideo.addEventListener('playing', function() {
        isVideoPlaying = true;
        staticOverlay.style.opacity = '0';
        bufferStatus.textContent = `✅ Playing channel ${currentChannel}`;
        bufferStatus.style.color = '#4caf50';
    });

    tvVideo.addEventListener('pause', function() {
        isVideoPlaying = false;
        bufferStatus.textContent = `⏸️ Paused channel ${currentChannel}`;
        bufferStatus.style.color = '#ff9800';
    });

    tvVideo.addEventListener('waiting', function() {
        staticOverlay.style.opacity = '0.5';
        bufferStatus.textContent = '⏳ Buffering...';
        bufferStatus.style.color = '#ff9800';
    });

    tvVideo.addEventListener('canplay', function() {
        staticOverlay.style.opacity = '0';
        bufferStatus.textContent = `✅ Ready to play channel ${currentChannel}`;
        bufferStatus.style.color = '#4caf50';
    });

    tvVideo.addEventListener('loadeddata', function() {
        staticOverlay.style.opacity = '0';
    });

    tvVideo.addEventListener('error', function(e) {
        console.log('❌ Video loading error for channel', currentChannel, e);
        staticOverlay.style.opacity = '0.8';
        
        bufferStatus.textContent = `❌ Error loading channel ${currentChannel}`;
        bufferStatus.style.color = '#f44336';

        // Show error message
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            background: rgba(0,0,0,0.9);
            padding: 20px;
            border-radius: 10px;
            z-index: 10;
            text-align: center;
            max-width: 80%;
            border: 2px solid #f44336;
        `;
        errorMsg.innerHTML = `
            <h3 style="color: #f44336; margin-bottom: 10px;">⚠️ Video Error</h3>
            <p>Channel ${currentChannel}: ${videoSources[currentChannel - 1]}</p>
            <p style="font-size: 0.9rem; margin: 10px 0;">Error code: ${tvVideo.error?.code || 'Unknown'}</p>
            <p style="font-size: 0.8rem; color: #bbb;">Make sure the video file exists and is cached properly.</p>
            <button onclick="window.location.reload()" style="
                background: #f44336;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                margin-top: 10px;
                cursor: pointer;
            ">Retry</button>
        `;

        const existingError = document.querySelector('.video-error');
        if (!existingError) {
            errorMsg.className = 'video-error';
            document.querySelector('.video-container').appendChild(errorMsg);
        }
    });

    // Progress tracking
    tvVideo.addEventListener('progress', function() {
        if (tvVideo.buffered.length > 0) {
            const bufferedEnd = tvVideo.buffered.end(tvVideo.buffered.length - 1);
            const duration = tvVideo.duration;
            if (duration > 0) {
                const bufferedPercent = (bufferedEnd / duration) * 100;
                if (bufferedPercent < 100) {
                    bufferStatus.textContent = `📥 Buffered: ${bufferedPercent.toFixed(1)}%`;
                    bufferStatus.style.color = '#ff9800';
                }
            }
        }
    });

    // Click on video to play/pause
    tvVideo.addEventListener('click', function() {
        if (isPoweredOn) {
            if (tvVideo.paused) {
                tvVideo.play();
                isVideoPlaying = true;
            } else {
                tvVideo.pause();
                isVideoPlaying = false;
            }
        }
    });

    // Add occasional static effect for realism (only in retro mode)
    setInterval(() => {
        if (isPoweredOn && isVideoPlaying && isRetroMode && Math.random() < 0.05) {
            staticOverlay.style.opacity = '0.3';
            setTimeout(() => {
                if (isPoweredOn) staticOverlay.style.opacity = '0';
            }, 100);
        }
    }, 5000);

    // Add buffer status to TV screen
    const bufferIndicator = document.createElement('div');
    bufferIndicator.style.cssText = `
        position: absolute;
        bottom: 10px;
        right: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 0.8rem;
        z-index: 5;
        display: none;
    `;
    bufferIndicator.textContent = 'Buffer: 0%';
    document.querySelector('.video-container').appendChild(bufferIndicator);

    // Show buffer indicator on hover
    tvVideo.addEventListener('mouseenter', () => {
        bufferIndicator.style.display = 'block';
    });
    tvVideo.addEventListener('mouseleave', () => {
        bufferIndicator.style.display = 'none';
    });

    // Update buffer indicator
    setInterval(() => {
        if (tvVideo.buffered.length > 0 && tvVideo.duration > 0) {
            const bufferedEnd = tvVideo.buffered.end(tvVideo.buffered.length - 1);
            const bufferPercent = Math.min(100, (bufferedEnd / tvVideo.duration) * 100);
            bufferIndicator.textContent = `Buffer: ${bufferPercent.toFixed(1)}%`;
            bufferIndicator.style.color = bufferPercent > 50 ? '#4caf50' : 
                                         bufferPercent > 20 ? '#ff9800' : '#f44336';
        }
    }, 1000);
});