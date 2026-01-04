// /app/pages/phone/call.js
console.log("📞 Call Page Loaded");

// Wait for supabase
let supabase;
let callService;

async function initCallPage() {
    console.log("Initializing call page...");
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friend');
    const friendName = urlParams.get('name');
    const callId = urlParams.get('call');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callType = urlParams.get('type') || 'voice';
    
    console.log("Call parameters:", { friendId, friendName, callId, isIncoming, callType });
    
    // Get supabase
    if (window.supabase) {
        supabase = window.supabase;
        console.log("✅ Using window.supabase");
    } else {
        try {
            const module = await import('/app/utils/supabase.js');
            supabase = module.supabase;
            console.log("✅ Loaded supabase from module");
        } catch (error) {
            showError("Failed to load Supabase: " + error.message);
            return;
        }
    }
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        showError("Please log in to make calls");
        setTimeout(() => window.location.href = '/app/pages/login/index.html', 2000);
        return;
    }
    
    console.log("Current user:", user.email);
    
    // Update UI
    if (friendName) {
        document.getElementById('callerName').textContent = friendName;
        document.getElementById('callerAvatar').textContent = friendName.charAt(0).toUpperCase();
    }
    
    // Initialize call service
    try {
        const module = await import('/app/utils/callService.js');
        callService = module.default;
        await callService.initialize(user.id);
        console.log("✅ Call service initialized");
        
        // Setup callbacks
        callService.setOnCallStateChange(handleCallStateChange);
        callService.setOnRemoteStream(handleRemoteStream);
        callService.setOnCallEvent(handleCallEvent);
        
        // Start or answer call
        if (isIncoming && callId) {
            // Incoming call
            document.getElementById('callStatus').textContent = 'Incoming call...';
            setupIncomingCallControls(callId);
        } else if (friendId) {
            // Outgoing call
            document.getElementById('callStatus').textContent = 'Calling...';
            startOutgoingCall(friendId, friendName, callType);
        } else {
            showError("No call information provided");
        }
        
    } catch (error) {
        console.error("❌ Call setup failed:", error);
        showError("Call setup failed: " + error.message);
    }
}

function startOutgoingCall(friendId, friendName, type) {
    console.log("Starting outgoing call to:", friendName);
    
    // Show calling UI
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn mute-btn" id="muteBtn" onclick="toggleMute()">
            <i class="fas fa-microphone"></i>
        </button>
        <button class="control-btn end-btn" onclick="endCall()">
            <i class="fas fa-phone-slash"></i>
        </button>
    `;
    
    // Start the call
    callService.initiateCall(friendId, type).catch(error => {
        console.error("Call initiation failed:", error);
        showError("Call failed: " + error.message);
    });
}

function setupIncomingCallControls(callId) {
    console.log("Setting up incoming call controls");
    
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn accept-btn" onclick="answerCall('${callId}')">
            <i class="fas fa-phone"></i>
        </button>
        <button class="control-btn decline-btn" onclick="declineCall('${callId}')">
            <i class="fas fa-phone-slash"></i>
        </button>
    `;
}

async function answerCall(callId) {
    console.log("Answering call:", callId);
    
    document.getElementById('callStatus').textContent = 'Answering...';
    
    try {
        await callService.answerCall(callId);
        
        // Update controls to show mute/end
        const controls = document.getElementById('callControls');
        controls.innerHTML = `
            <button class="control-btn mute-btn" id="muteBtn" onclick="toggleMute()">
                <i class="fas fa-microphone"></i>
            </button>
            <button class="control-btn end-btn" onclick="endCall()">
                <i class="fas fa-phone-slash"></i>
            </button>
        `;
        
    } catch (error) {
        console.error("Answer call failed:", error);
        showError("Failed to answer: " + error.message);
    }
}

async function declineCall(callId) {
    console.log("Declining call:", callId);
    
    try {
        // Update call status to rejected
        await supabase
            .from('calls')
            .update({ 
                status: 'rejected',
                ended_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', callId);
            
        // Go back
        window.history.back();
        
    } catch (error) {
        console.error("Decline failed:", error);
        showError("Failed to decline call");
    }
}

function handleCallStateChange(state) {
    console.log("Call state changed:", state);
    const statusEl = document.getElementById('callStatus');
    const timerEl = document.getElementById('callTimer');
    const loadingEl = document.getElementById('loadingMessage');
    
    if (loadingEl) loadingEl.style.display = 'none';
    
    switch(state) {
        case 'ringing':
            statusEl.textContent = 'Ringing...';
            break;
        case 'connecting':
            statusEl.textContent = 'Connecting...';
            break;
        case 'active':
            statusEl.textContent = 'Call Connected';
            if (timerEl) {
                timerEl.style.display = 'block';
                startCallTimer();
            }
            break;
        case 'ending':
            statusEl.textContent = 'Ending call...';
            break;
    }
}

function handleRemoteStream(stream) {
    console.log("Remote stream received:", stream);
    const audio = document.getElementById('remoteAudio');
    if (audio) {
        audio.srcObject = stream;
        console.log("Remote audio setup");
    }
}

function handleCallEvent(event, data) {
    console.log("Call event:", event, data);
    
    if (event === 'call_ended') {
        endCall();
    }
}

window.toggleMute = async () => {
    if (!callService) return;
    
    const isMuted = await callService.toggleMute();
    const muteBtn = document.getElementById('muteBtn');
    
    if (muteBtn) {
        if (isMuted) {
            muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            muteBtn.style.background = 'linear-gradient(45deg, #ff9500, #ff5e3a)';
        } else {
            muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            muteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        }
    }
};

window.endCall = () => {
    console.log("Ending call");
    
    if (callService) {
        callService.endCall();
    }
    
    // Go back after a delay
    setTimeout(() => {
        window.history.back();
    }, 1000);
};

let callTimerInterval = null;
function startCallTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('callTimer');
    if (!timerEl) return;
    
    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function showError(message) {
    console.error("Error:", message);
    
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
    
    document.getElementById('callStatus').textContent = 'Error';
    document.getElementById('loadingMessage').style.display = 'none';
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initCallPage);