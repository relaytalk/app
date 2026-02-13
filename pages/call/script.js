import { createCallRoom } from '/utils/daily.js';
import { initializeSupabase } from '/utils/supabase.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;
let supabaseInstance = null;

// Initialize call page
async function initCallPage() {
    console.log('📞 Initializing call page...');

    // Show loading immediately
    document.getElementById('callLoading').style.display = 'flex';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'none';

    // Initialize Supabase first (this will set window.supabase)
    try {
        supabaseInstance = await initializeSupabase();
        console.log('✅ Supabase initialized');
    } catch (error) {
        console.log('⚠️ Supabase init warning:', error);
        // Continue anyway - call might still work
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
        
        // Join the call
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
            // If other participant left, show message but don't redirect
            if (event && event.participant && event.participant.user_name) {
                showToast('info', `${event.participant.user_name} left the call`);
            }
        });

        // Handle participant joined
        callFrame.on('participant-joined', (event) => {
            console.log('👤 Participant joined:', event);
            if (event && event.participant && event.participant.user_name) {
                showToast('success', `${event.participant.user_name} joined the call`);
            }
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

// Simple toast for messages
function showToast(type, message) {
    // Create temporary toast if needed
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#22c55e' : '#3b82f6'};
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 0.9rem;
        z-index: 2000;
        animation: slideDown 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translate(-50%, -20px);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initCallPage);