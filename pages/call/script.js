import { createCallRoom } from '/utils/daily.js';
import { auth } from '/utils/auth.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;
let preloadComplete = false;

// Initialize call page with pre-loading
async function initCallPage() {
    console.log('📞 Initializing call page with pre-loading...');

    // Show loading immediately
    document.getElementById('callLoading').style.display = 'flex';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'none';

    // Start pre-loading immediately
    await preloadCallService();
}

// Pre-load all necessary services
async function preloadCallService() {
    try {
        console.log('🔄 Pre-loading call services...');

        // 1. Load Daily.co script in parallel
        const scriptPromise = loadDailyScript();
        
        // 2. Check auth but DON'T redirect
        const authPromise = checkAuthWithoutRedirect();
        
        // 3. Wait for both to complete
        const [scriptLoaded, authResult] = await Promise.all([scriptPromise, authPromise]);
        
        console.log('✅ Pre-load complete:', { scriptLoaded, authResult });
        
        // 4. Now join the call
        if (roomUrl) {
            console.log('📞 Joining pre-loaded call:', roomUrl);
            await joinCall(roomUrl);
        } else {
            console.log('📞 Starting new call with pre-load');
            await startNewCall();
        }
        
    } catch (error) {
        console.error('❌ Pre-load error:', error);
        showError('Failed to load call: ' + error.message);
    }
}

// Check auth without redirecting
async function checkAuthWithoutRedirect() {
    try {
        const user = await auth.getCurrentUser();
        if (user?.success) {
            console.log('✅ Auth check passed');
            return true;
        } else {
            console.log('⚠️ Auth check failed - continuing anyway');
            return false;
        }
    } catch (error) {
        console.log('⚠️ Auth error - continuing anyway:', error);
        return false;
    }
}

// Load Daily.co iframe library
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
            // Wait for DailyIframe
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

// Start a new call
async function startNewCall() {
    try {
        // Check if already pre-loading
        if (preloadComplete) {
            console.log('✅ Using pre-loaded data for new call');
        }
        
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
        
        // Add a small delay to ensure everything is ready
        setTimeout(async () => {
            try {
                await callFrame.join({
                    url: url,
                    startVideoOff: true,
                    startAudioOff: false
                });
                console.log('✅ Join command sent');
            } catch (joinError) {
                console.error('❌ Join error:', joinError);
                showError('Failed to join call');
            }
        }, 100);

        // Successfully joined
        callFrame.on('joined-meeting', () => {
            console.log('✅ Successfully joined call');
            preloadComplete = true;
            document.getElementById('callLoading').style.display = 'none';
            document.getElementById('callContainer').style.display = 'block';
            document.getElementById('callError').style.display = 'none';
        });

        // 🔥 CRITICAL: NO AUTO REDIRECT - Just show ended message
        callFrame.on('left-meeting', (event) => {
            console.log('👋 Call ended - showing end screen (NO REDIRECT)', event);
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
    console.log('📱 Showing call ended screen (NO AUTO REDIRECT)');
    
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

// Block any attempt to redirect
window.addEventListener('beforeunload', (e) => {
    console.log('⚠️ Page is unloading - checking if this is manual navigation');
    // Don't do anything, just log
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initCallPage);