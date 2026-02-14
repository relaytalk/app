// pages/call/script.js - STANDALONE version
// NO Supabase dependencies! NO redirects!

import { getUserFromStorage, getDisplayName, getRoomFromParams } from '../../../utils/call-utils.js';

// ===== STATE =====
let callFrame = null;
let roomUrl = null;
let user = null;
let pageLoaded = false;

// ===== INIT =====
async function initCallPage() {
    console.log('📞 Call page initializing...');
    pageLoaded = true;

    // Show loading
    showLoading();

    // Get user (just for display name - NO Supabase calls!)
    user = getUserFromStorage();
    console.log('👤 User:', user ? user.email : 'Guest mode');

    // Get room URL
    roomUrl = getRoomFromParams();
    
    if (!roomUrl) {
        showError('No call room specified. Please start a call from the friends page.');
        return;
    }

    console.log('🔗 Room URL:', roomUrl);

    // Load Daily.co
    const scriptLoaded = await loadDailyScript();
    if (!scriptLoaded) {
        showError('Failed to load call service. Please check your internet connection.');
        return;
    }

    // Join call
    await joinCall();
}

// ===== LOAD DAILY.CO =====
function loadDailyScript() {
    return new Promise((resolve) => {
        // Check if already loaded
        if (window.DailyIframe) {
            console.log('✅ Daily.co already loaded');
            resolve(true);
            return;
        }

        console.log('📥 Loading Daily.co script...');

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;
        script.crossOrigin = 'anonymous';

        script.onload = () => {
            console.log('✅ Daily.co script loaded');
            
            // Wait for DailyIframe
            let attempts = 0;
            const checkInterval = setInterval(() => {
                if (window.DailyIframe) {
                    clearInterval(checkInterval);
                    console.log('✅ DailyIframe ready');
                    resolve(true);
                }
                
                attempts++;
                if (attempts > 50) {
                    clearInterval(checkInterval);
                    console.error('❌ DailyIframe timeout');
                    resolve(false);
                }
            }, 100);
        };

        script.onerror = () => {
            console.error('❌ Failed to load Daily.co');
            resolve(false);
        };

        document.head.appendChild(script);
    });
}

// ===== JOIN CALL =====
async function joinCall() {
    try {
        console.log('🔧 Creating Daily iframe...');

        const container = document.getElementById('dailyFrame');
        if (!container) {
            showError('Call interface not found');
            return;
        }

        container.innerHTML = '';

        // Create Daily iframe
        callFrame = window.DailyIframe.createFrame(container, {
            showLeaveButton: false,
            iframeStyle: {
                width: '100%',
                height: '100%',
                border: '0',
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0'
            },
            showFullscreenButton: true,
            showParticipantsBar: true
        });

        console.log('✅ Daily iframe created');

        // Set up event listeners
        callFrame
            .on('joining-meeting', () => {
                console.log('⏳ Joining meeting...');
            })
            .on('joined-meeting', () => {
                console.log('✅ Successfully joined call');
                hideLoading();
                showCallContainer();

                // Start with video off
                setTimeout(() => {
                    if (callFrame) {
                        callFrame.setLocalVideo(false);
                    }
                }, 1000);
            })
            .on('left-meeting', () => {
                console.log('👋 Left meeting');
                showEndScreen();
            })
            .on('error', (error) => {
                console.error('❌ Call error:', error);
                showError('Connection failed. Please try again.');
            });

        // Join the meeting
        console.log('🔌 Joining call:', roomUrl);
        await callFrame.join({
            url: roomUrl,
            userName: getDisplayName(user),
            videoSource: false,
            audioSource: true
        });

        // Setup controls
        setupControls();

    } catch (error) {
        console.error('❌ Failed to join call:', error);
        showError('Failed to join call: ' + (error.message || 'Unknown error'));
    }
}

// ===== SETUP CONTROLS =====
function setupControls() {
    console.log('🔧 Setting up controls');

    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endBtn = document.getElementById('endCallBtn');

    let isMuted = false;
    let isVideoOff = true;

    if (muteBtn) {
        muteBtn.onclick = () => {
            if (!callFrame) return;
            isMuted = !isMuted;
            
            try {
                callFrame.setLocalAudio(!isMuted);
                muteBtn.innerHTML = isMuted ? 
                    '<i class="fas fa-microphone-slash"></i>' : 
                    '<i class="fas fa-microphone"></i>';
                console.log('🎤 Audio:', isMuted ? 'Muted' : 'Unmuted');
            } catch (e) {
                console.error('Error toggling audio:', e);
            }
        };
    }

    if (videoBtn) {
        videoBtn.onclick = () => {
            if (!callFrame) return;
            isVideoOff = !isVideoOff;
            
            try {
                callFrame.setLocalVideo(!isVideoOff);
                videoBtn.innerHTML = isVideoOff ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
                videoBtn.classList.toggle('active', !isVideoOff);
                console.log('📹 Video:', isVideoOff ? 'Off' : 'On');
            } catch (e) {
                console.error('Error toggling video:', e);
            }
        };
        videoBtn.classList.add('active');
    }

    if (endBtn) {
        endBtn.onclick = () => {
            console.log('👋 Ending call...');
            if (callFrame) {
                try {
                    callFrame.leave();
                } catch (e) {
                    console.error('Error leaving call:', e);
                    showEndScreen();
                }
            } else {
                showEndScreen();
            }
        };
    }
}

// ===== UI HELPERS =====
function showLoading() {
    const loading = document.getElementById('callLoading');
    const container = document.getElementById('callContainer');
    const error = document.getElementById('callError');
    
    if (loading) loading.style.display = 'flex';
    if (container) container.style.display = 'none';
    if (error) error.style.display = 'none';
}

function hideLoading() {
    const loading = document.getElementById('callLoading');
    if (loading) loading.style.display = 'none';
}

function showCallContainer() {
    const loading = document.getElementById('callLoading');
    const container = document.getElementById('callContainer');
    const error = document.getElementById('callError');
    
    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'block';
    if (error) error.style.display = 'none';
}

function showError(message) {
    console.error('❌ Error:', message);

    const loading = document.getElementById('callLoading');
    const container = document.getElementById('callContainer');
    const error = document.getElementById('callError');
    const errorMsg = document.getElementById('errorMessage');
    
    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = message;
}

function showEndScreen() {
    console.log('📱 Showing end screen');

    const container = document.getElementById('callContainer');
    const loading = document.getElementById('callLoading');
    const error = document.getElementById('callError');
    const errorMsg = document.getElementById('errorMessage');
    
    if (container) container.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (error) {
        error.style.display = 'flex';
        if (errorMsg) errorMsg.textContent = 'Call ended';
    }
}

// ===== NAVIGATION =====
window.goBack = function() {
    console.log('🔙 Going back to friends');
    window.location.href = '/pages/home/friends/index.html';
};

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
    console.log('👋 Page unloading');
    if (callFrame) {
        try {
            callFrame.leave();
            callFrame.destroy();
        } catch (e) {
            console.error('Error during cleanup:', e);
        }
    }
});

// ===== START =====
document.addEventListener('DOMContentLoaded', initCallPage);

// Log every 5 seconds to prove no redirect
setInterval(() => {
    if (pageLoaded) {
        console.log('⏱️ Still on call page -', new Date().toLocaleTimeString());
    }
}, 5000);