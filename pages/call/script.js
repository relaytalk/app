// pages/call/script.js - WITH SAME AUTH DETECTION AS ROOT PAGE

console.log('📞 Call page initializing...');
console.log('🔐 Has session:', window.hasUserSession);
console.log('👤 User:', window.userName || 'Guest');

// ===== GET ROOM URL =====
function getRoomUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomUrl = urlParams.get('room');
    
    console.log('📦 Room from URL:', roomUrl);
    
    if (!roomUrl) {
        try {
            const stored = sessionStorage.getItem('currentCall');
            if (stored) {
                const data = JSON.parse(stored);
                roomUrl = data.roomUrl;
                console.log('📦 Room from sessionStorage:', roomUrl);
            }
        } catch(e) {
            console.log('No stored room');
        }
    }
    
    return roomUrl;
}

// ===== GET USER NAME (using window.hasUserSession) =====
function getUserName() {
    // Use the already-detected user info
    if (window.hasUserSession && window.userName) {
        return window.userName;
    }
    
    // Fallback: try to get from localStorage directly
    try {
        const sessionStr = localStorage.getItem('supabase.auth.token');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const user = session?.user || session?.currentSession?.user;
            if (user?.email) {
                return user.email.split('@')[0];
            }
        }
    } catch(e) {
        console.log('Error parsing user:', e);
    }
    
    return 'Guest';
}

// ===== MAIN =====
const roomUrl = getRoomUrl();
const userName = getUserName();

console.log('🎯 Final room:', roomUrl);
console.log('👤 Display name:', userName);

// Update UI
const statusDiv = document.getElementById('status');
const roomInfo = document.getElementById('roomInfo');

if (statusDiv) {
    statusDiv.innerHTML = roomUrl ? 
        '✅ Room found! Loading...' : 
        '❌ ERROR: No room URL!';
}

if (roomInfo) {
    roomInfo.innerHTML = `
        <strong>Room:</strong> ${roomUrl || 'MISSING'}<br>
        <strong>User:</strong> ${userName}<br>
        <strong>Logged in:</strong> ${window.hasUserSession ? '✅ Yes' : '❌ No'}<br>
        <strong>Time:</strong> ${new Date().toLocaleTimeString()}
    `;
}

if (!roomUrl) {
    if (statusDiv) statusDiv.innerHTML = '❌ ERROR: No room URL provided!';
    throw new Error('No room URL');
}

// ===== LOAD DAILY.CO =====
const script = document.createElement('script');
script.src = 'https://unpkg.com/@daily-co/daily-js';
script.onload = function() {
    console.log('✅ Daily.co loaded');
    if (statusDiv) statusDiv.innerHTML = '✅ Daily loaded! Starting call...';
    startCall();
};
script.onerror = function() {
    console.error('❌ Failed to load Daily.co');
    if (statusDiv) statusDiv.innerHTML = '❌ Failed to load Daily.co';
};
document.head.appendChild(script);

function startCall() {
    try {
        console.log('🔧 Creating call...');
        
        // Hide status, show video
        const statusEl = document.getElementById('status');
        const roomInfoEl = document.getElementById('roomInfo');
        const dailyFrameEl = document.getElementById('dailyFrame');
        
        if (statusEl) statusEl.style.display = 'none';
        if (roomInfoEl) roomInfoEl.style.display = 'none';
        if (dailyFrameEl) dailyFrameEl.style.display = 'block';
        
        // Create call
        const callFrame = window.DailyIframe.createFrame(
            document.getElementById('dailyFrame'),
            {
                showLeaveButton: true,
                iframeStyle: {
                    width: '100%',
                    height: '100%',
                    border: '0'
                }
            }
        );
        
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = '🔌 Joining call...';
        }
        
        callFrame.join({
            url: roomUrl,
            userName: userName
        });
        
        callFrame.on('joined-meeting', () => {
            console.log('✅ Joined call!');
            if (statusEl) statusEl.style.display = 'none';
        });
        
        callFrame.on('left-meeting', () => {
            console.log('👋 Left call');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.innerHTML = 'Call ended';
            }
            if (roomInfoEl) roomInfoEl.style.display = 'block';
        });
        
    } catch(error) {
        console.error('❌ Error:', error);
        if (statusDiv) statusDiv.innerHTML = '❌ Error: ' + error.message;
    }
}

// Back button
window.goBack = function() {
    console.log('🔙 Going back');
    window.location.href = '/pages/home/friends/index.html';
};

// Keep alive log
setInterval(() => {
    console.log('⏱️ Still on call page -', new Date().toLocaleTimeString(), 
                'User:', window.userName || 'Guest');
}, 5000);