// pages/call/script.js - COMPLETE FIXED VERSION
// NO AUTO REDIRECTS - EVER!

import { createCallRoom } from '/utils/daily.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;

// Initialize call page - NO AUTH CHECKS AT ALL
async function initCallPage() {
    console.log('📞 Initializing call page...');

    // Show loading
    document.getElementById('callLoading').style.display = 'flex';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'none';

    // ✅ NO AUTH CHECKS - Just load the call
    console.log('✅ Call page: No auth checks - loading call directly');

    // Load Daily.co script
    const scriptLoaded = await loadDailyScript();

    if (!scriptLoaded) {
        showError('Failed to load call service');
        return;
    }

    // Join or start call
    if (roomUrl) {
        console.log('📞 Joining call:', roomUrl);
        await joinCall(roomUrl);
    } else {
        console.log('📞 Starting new call');
        await startNewCall();
    }
}

// Load Daily.co script
function loadDailyScript() {
    return new Promise((resolve) => {
        if (window.DailyIframe) {
            console.log('✅ Daily.co already loaded');
            resolve(true);
            return;
        }

        console.log('📥 Loading Daily.co script...');
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;

        script.onload = () => {
            console.log('✅ Daily.co script loaded');
            let attempts = 0;
            const checkDaily = setInterval(() => {
                if (window.DailyIframe) {
                    clearInterval(checkDaily);
                    resolve(true);
                }
                if (attempts++ > 20) {
                    clearInterval(checkDaily);
                    console.error('❌ DailyIframe not available');
                    resolve(false);
                }
            }, 100);
        };

        script.onerror = (error) => {
            console.error('❌ Failed to load Daily.co script:', error);
            resolve(false);
        };
        
        document.head.appendChild(script);
    });
}

// Start new call
async function startNewCall() {
    try {
        console.log('Creating new call room...');
        const result = await createCallRoom();
        
        if (!result?.success) {
            showError('Failed to create call: ' + (result?.error || 'Unknown error'));
            return;
        }
        
        console.log('✅ Room created:', result.url);
        currentRoom = result;
        await joinCall(result.url);
        
    } catch (error) {
        console.error('❌ Error:', error);
        showError(error.message);
    }
}

// Join call
async function joinCall(url) {
    try {
        if (!window.DailyIframe) {
            showError('Call service unavailable');
            return;
        }

        const iframe = document.getElementById('dailyFrame');
        if (!iframe) {
            showError('Call interface not found');
            return;
        }

        console.log('🔧 Creating Daily iframe...');
        callFrame = window.DailyIframe.createFrame(iframe, {
            showLeaveButton: false,
            iframeStyle: {
                width: '100%',
                height: '100vh',
                border: '0',
                position: 'fixed',
                top: '0',
                left: '0'
            }
        });

        console.log('🔌 Joining call...');
        callFrame.join({
            url: url,
            startVideoOff: true,
            startAudioOff: false
        });

        // Successfully joined
        callFrame.on('joined-meeting', () => {
            console.log('✅ Successfully joined call');
            document.getElementById('callLoading').style.display = 'none';
            document.getElementById('callContainer').style.display = 'block';
            document.getElementById('callError').style.display = 'none';
        });

        // 🔥 CRITICAL: NO AUTO REDIRECT
        callFrame.on('left-meeting', () => {
            console.log('👋 Call ended - showing end screen');
            showCallEnded();
        });

        callFrame.on('error', (error) => {
            console.error('❌ Call error:', error);
            showError('Connection failed');
        });

        setupCallControls();

    } catch (error) {
        console.error('❌ Failed to join call:', error);
        showError('Failed to join call');
    }
}

// 🔥 SHOW CALL ENDED - NO AUTO REDIRECT
function showCallEnded() {
    console.log('📱 Showing call ended screen - NO REDIRECT');
    
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = 'Call ended';

    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
            console.log('👆 User manually clicked close - redirecting now');
            window.location.href = '/pages/home/friends/index.html';
        };
    }
}

// Setup controls
function setupCallControls() {
    let isMuted = false;
    let isVideoOff = true;

    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endBtn = document.getElementById('endCallBtn');

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            if (callFrame) callFrame.setLocalAudio(!isMuted);
            muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
        });
    }

    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            isVideoOff = !isVideoOff;
            if (callFrame) callFrame.setLocalVideo(!isVideoOff);
            videoBtn.innerHTML = isVideoOff ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        });
    }

    if (endBtn) {
        endBtn.addEventListener('click', () => {
            console.log('👆 User clicked end call button');
            if (callFrame) {
                callFrame.leave();
            } else {
                showCallEnded();
            }
        });
    }
}

// Show error
function showError(message) {
    console.error('❌ Error:', message);
    
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;

    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            console.log('👆 User manually clicked close from error');
            window.location.href = '/pages/home/friends/index.html';
        };
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', initCallPage);