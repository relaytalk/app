import { createCallRoom, validateRoom } from '../../utils/daily.js';
import { auth } from '../../utils/auth.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const roomUrl = urlParams.get('room');
const isIncoming = urlParams.get('incoming') === 'true';
const friendName = urlParams.get('friend') || 'Friend';

let callFrame = null;
let currentRoom = null;

// Initialize call page
async function initCallPage() {
    // Check auth
    const { success, user } = await auth.getCurrentUser();
    if (!success) {
        window.location.href = '/';
        return;
    }

    // Show loading
    document.getElementById('callLoading').style.display = 'flex';

    // Load Daily.co script
    await loadDailyScript();

    if (roomUrl) {
        // Joining existing call
        await joinCall(roomUrl);
    } else {
        // Creating new call
        await startNewCall();
    }
}

// Load Daily.co iframe library
function loadDailyScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@daily-co/daily-js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Start a new call
async function startNewCall() {
    try {
        const result = await createCallRoom();
        
        if (!result.success) {
            showError('Failed to create call room');
            return;
        }

        currentRoom = result;
        
        // Update Supabase with call record
        await updateCallRecord(result.url, 'ringing');
        
        // Join the room
        await joinCall(result.url);
        
    } catch (error) {
        showError(error.message);
    }
}

// Join an existing call
async function joinCall(url) {
    try {
        const iframe = document.getElementById('dailyFrame');
        
        callFrame = window.DailyIframe.createFrame(iframe, {
            showLeaveButton: false,
            showFullscreenButton: true,
            showParticipantsBar: false,
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
            showLeaveButton: false,
            startVideoOff: true,
            startAudioOff: false
        });

        callFrame.on('joined-meeting', () => {
            document.getElementById('callLoading').style.display = 'none';
            document.getElementById('callContainer').style.display = 'block';
        });

        callFrame.on('left-meeting', () => {
            window.close();
        });

        callFrame.on('error', (e) => {
            showError(e.errorMessage);
        });

        // Setup controls
        setupCallControls();
        
    } catch (error) {
        showError(error.message);
    }
}

// Setup call controls
function setupCallControls() {
    let isMuted = false;
    let isVideoOff = true;

    document.getElementById('muteBtn').addEventListener('click', () => {
        isMuted = !isMuted;
        callFrame.setLocalAudio(isMuted);
        document.getElementById('muteBtn').innerHTML = isMuted 
            ? '<i class="fas fa-microphone-slash"></i>' 
            : '<i class="fas fa-microphone"></i>';
    });

    document.getElementById('videoBtn').addEventListener('click', () => {
        isVideoOff = !isVideoOff;
        callFrame.setLocalVideo(isVideoOff);
        document.getElementById('videoBtn').innerHTML = isVideoOff 
            ? '<i class="fas fa-video"></i>' 
            : '<i class="fas fa-video-slash"></i>';
    });

    document.getElementById('endCallBtn').addEventListener('click', () => {
        callFrame.leave();
        window.location.href = '/pages/friends/index.html';
    });
}

// Update call record in Supabase
async function updateCallRecord(roomUrl, status) {
    // Will implement after friends page update
    console.log('Call status:', status, roomUrl);
}

// Show error
function showError(message) {
    document.getElementById('callLoading').style.display = 'none';
    document.getElementById('callError').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
}

// Initialize
document.addEventListener('DOMContentLoaded', initCallPage);