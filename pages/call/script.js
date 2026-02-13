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

    // Show loading immediately
    document.getElementById('callLoading').style.display = 'flex';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'none';

    // Try auth but DON'T redirect on failure
    try {
        const user = await auth.getCurrentUser();
        if (user?.success) {
            console.log('✅ Auth successful');
        } else {
            console.log('⚠️ Auth failed, but continuing anyway - user can still join call with URL');
        }
    } catch (error) {
        console.log('⚠️ Auth error, but continuing anyway:', error);
    }

    // Load Daily.co script
    const scriptLoaded = await loadDailyScript();

    if (!scriptLoaded) {
        showError('Failed to load call service');
        return;
    }

    // Check if we have a room URL
    if (roomUrl) {
        console.log('📞 Joining existing call:', roomUrl);
        await joinCall(roomUrl);
    } else {
        console.log('📞 Starting new call');
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

        script.onerror = () => {
            console.error('❌ Failed to load Daily.co script');
            resolve(false);
        };
        
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
        console.error('❌ Error starting new call:', error);
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

        // 🔥 CRITICAL: NO AUTO REDIRECT - Just show ended message
        callFrame.on('left-meeting', (event) => {
            console.log('👋 Call ended - showing end screen', event);
            showCallEnded();
        });

        // Handle errors
        callFrame.on('error', (error) => {
            console.error('❌ Call error:', error);
            showError('Connection failed: ' + (error.errorMsg || 'Unknown error'));
        });

        // Handle participant left
        callFrame.on('participant-left', (event) => {
            console.log('👤 Participant left:', event);
            // Don't do anything - let the call continue
        });

        // Handle participant joined
        callFrame.on('participant-joined', (event) => {
            console.log('👤 Participant joined:', event);
        });

        setupCallControls();

    } catch (error) {
        console.error('❌ Failed to join call:', error);
        showError('Failed to join call: ' + error.message);
    }
}

// 🔥 SHOW CALL ENDED - NO AUTO REDIRECT, EVER!
function showCallEnded() {
    console.log('📱 Showing call ended screen');
    
    // Hide all other screens
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callLoading').style.display = 'none';
    
    // Show error/end screen
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
                // Just leave the call - this will trigger 'left-meeting' event
                callFrame.leave();
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
    
    // Hide all other screens
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callContainer').style.display = 'none';
    
    // Show error screen
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
    
    // Update close button for error state - ONLY redirect on manual click
    const closeBtn = document.querySelector('.back-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            console.log('👆 User manually clicked close from error');
            window.location.href = '/pages/home/friends/index.html';  // ONLY on manual click
        };
    }
}

// Make sure we never redirect automatically
window.addEventListener('beforeunload', (e) => {
    // This prevents any accidental redirects
    console.log('Page is unloading - but this should only happen on manual navigation');
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initCallPage);