import { createCallRoom } from '/utils/daily.js';
import { auth } from '/utils/auth.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;

// Initialize call page
async function initCallPage() {
    console.log('📞 Initializing call page...');

    document.getElementById('callLoading').style.display = 'flex';

    // Check auth
    try {
        const { success } = await auth.getCurrentUser();
        if (!success) {
            window.location.href = '/';
            return;
        }
    } catch (error) {
        console.error('Auth error:', error);
    }

    // Load Daily.co script
    const scriptLoaded = await loadDailyScript();

    if (!scriptLoaded) {
        showError('Failed to load call service');
        return;
    }

    if (roomUrl) {
        await joinCall(roomUrl);
    } else {
        await startNewCall();
    }
}

// Load Daily.co iframe library
function loadDailyScript() {
    return new Promise((resolve) => {
        if (window.DailyIframe) {
            resolve(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js@0.24.0/dist/daily.js';
        script.async = true;

        script.onload = () => {
            // Wait for DailyIframe
            let attempts = 0;
            const checkDaily = setInterval(() => {
                if (window.DailyIframe) {
                    clearInterval(checkDaily);
                    resolve(true);
                }
                if (attempts++ > 20) {
                    clearInterval(checkDaily);
                    resolve(false);
                }
            }, 100);
        };

        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

// Start a new call
async function startNewCall() {
    try {
        const result = await createCallRoom();
        if (!result?.success) {
            showError('Failed to create call: ' + (result?.error || 'Unknown error'));
            return;
        }
        currentRoom = result;
        await joinCall(result.url);
    } catch (error) {
        showError(error.message);
    }
}

// Join an existing call
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

        callFrame.join({
            url: url,
            startVideoOff: true,
            startAudioOff: false
        });

        callFrame.on('joined-meeting', () => {
            console.log('✅ Successfully joined call');
            document.getElementById('callLoading').style.display = 'none';
            document.getElementById('callContainer').style.display = 'block';
        });

        // 🔥 IMPORTANT: NO AUTO REDIRECT - Just show ended message
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
    // Hide call container, show error/end screen
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = 'Call ended';
    
    // Update the button to ONLY redirect on MANUAL click
    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
            console.log('👆 User manually clicked close - redirecting to friends');
            window.location.href = '/pages/home/friends/index.html';  // ONLY on manual click
        };
    }
}

// Setup call controls
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

    // 🔥 END BUTTON - NO AUTO REDIRECT
    if (endBtn) {
        endBtn.addEventListener('click', () => {
            console.log('👆 User clicked end call button');
            if (callFrame) {
                callFrame.leave(); // This will trigger 'left-meeting' event
            } else {
                // If no callFrame, just show ended screen
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
    
    // Update close button for error state
    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            window.location.href = '/pages/home/friends/index.html';  // ONLY on manual click
        };
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', initCallPage);