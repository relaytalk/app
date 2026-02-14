// pages/call/script.js - USES EXISTING SUPABASE INSTANCE
import { initializeSupabase, getCurrentUser } from '../../utils/call-supabase.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
let roomUrl = urlParams.get('room');
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let supabase = null;

async function initCallPage() {
    console.log('📞 Call page initializing...');
    
    // Show loading
    document.getElementById('callLoading').style.display = 'flex';
    
    // Get existing Supabase instance (shares session with friends page)
    try {
        supabase = await initializeSupabase();
        console.log('✅ Supabase ready');
        
        // Check if user is logged in (but don't block on it)
        const { user } = await getCurrentUser();
        console.log('👤 User:', user ? user.email : 'Guest mode');
    } catch (error) {
        console.log('⚠️ Auth not available, continuing as guest');
    }
    
    // Check for room URL
    if (!roomUrl) {
        // Try sessionStorage as fallback
        try {
            const stored = sessionStorage.getItem('currentCall');
            if (stored) {
                const data = JSON.parse(stored);
                roomUrl = data.roomUrl;
                console.log('📦 Recovered room from sessionStorage');
            }
        } catch (e) {}
    }
    
    if (!roomUrl) {
        showError('No call room specified');
        return;
    }
    
    // Load Daily.co
    const scriptLoaded = await loadDailyScript();
    if (!scriptLoaded) {
        showError('Failed to load call service');
        return;
    }
    
    // Join the call
    await joinCall(roomUrl);
}

// Load Daily.co script
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
            let attempts = 0;
            const check = setInterval(() => {
                if (window.DailyIframe) {
                    clearInterval(check);
                    resolve(true);
                }
                if (attempts++ > 20) {
                    clearInterval(check);
                    resolve(false);
                }
            }, 100);
        };
        
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

// Join call
async function joinCall(url) {
    try {
        const container = document.getElementById('dailyFrame');
        if (!container) throw new Error('Call container not found');

        callFrame = window.DailyIframe.createFrame(container, {
            showLeaveButton: false,
            iframeStyle: {
                width: '100%',
                height: '100%',
                border: '0',
                position: 'absolute',
                top: '0',
                left: '0'
            }
        });

        // Set up event listeners
        callFrame
            .on('joined-meeting', () => {
                document.getElementById('callLoading').style.display = 'none';
                document.getElementById('callContainer').style.display = 'block';
            })
            .on('left-meeting', () => {
                showEndScreen();
            })
            .on('error', (error) => {
                console.error('Call error:', error);
                showError('Connection failed');
            });

        // Join with video off by default
        await callFrame.join({
            url: url,
            startVideoOff: true,
            startAudioOff: false
        });

        setupControls();

    } catch (error) {
        console.error('Join failed:', error);
        showError('Failed to join call');
    }
}

// Setup controls
function setupControls() {
    let isMuted = false;
    let isVideoOff = true;

    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endBtn = document.getElementById('endCallBtn');

    if (muteBtn) {
        muteBtn.onclick = () => {
            isMuted = !isMuted;
            if (callFrame) callFrame.setLocalAudio(!isMuted);
            muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
        };
    }

    if (videoBtn) {
        videoBtn.onclick = () => {
            isVideoOff = !isVideoOff;
            if (callFrame) callFrame.setLocalVideo(!isVideoOff);
            videoBtn.innerHTML = isVideoOff ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            videoBtn.classList.toggle('active', !isVideoOff);
        };
    }

    if (endBtn) {
        endBtn.onclick = () => {
            if (callFrame) {
                callFrame.leave();
            } else {
                showEndScreen();
            }
        };
    }
}

// Show end screen - NO AUTO REDIRECT
function showEndScreen() {
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = 'Call ended';
    
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            window.location.href = '/pages/home/friends/index.html';
        };
    }
}

// Show error
function showError(message) {
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
    
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            window.location.href = '/pages/home/friends/index.html';
        };
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCallPage);
} else {
    initCallPage();
}