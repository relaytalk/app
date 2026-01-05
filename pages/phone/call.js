console.log("📞 Call Page Loaded - CONNECTION FIXED");

let supabase;
let callService;
let signalingManager;
let currentCallId = null;
let isSpeakerMode = false;
let isMuted = false;
let isIncomingCall = false;
let friendName = "Connecting...";
let friendId = null;
let connectionMonitor = null;

// ==================== INITIALIZATION ====================
async function initCallPage() {
    console.log("🚀 INITIALIZING CALL PAGE...");

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    friendId = urlParams.get('friend');
    friendName = decodeURIComponent(urlParams.get('name') || "Caller");
    const callIdParam = urlParams.get('call') || urlParams.get('call_id');
    isIncomingCall = urlParams.get('incoming') === 'true';
    const callType = urlParams.get('type') || 'voice';

    console.log("📊 URL Parameters:", {
        friendId,
        friendName,
        callIdParam,
        isIncomingCall,
        callType
    });

    // Validate we have enough info
    if (!callIdParam && !friendId) {
        showError("No call information provided");
        setTimeout(() => window.history.back(), 3000);
        return;
    }

    // Store globally
    currentCallId = callIdParam;
    window.currentCallId = currentCallId;
    window.friendId = friendId;
    window.isIncomingCall = isIncomingCall;

    // Initialize Supabase
    try {
        const module = await import('/app/utils/supabase.js');
        supabase = module.supabase;
        window.globalSupabase = supabase;
        console.log("✅ Supabase initialized");
    } catch (error) {
        console.error("❌ Supabase init failed:", error);
        showError("Database connection failed");
        return;
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        showError("Please log in to make calls");
        setTimeout(() => window.location.href = '/app/pages/login/index.html', 2000);
        return;
    }

    console.log("👤 Current user:", user.id);

    // Update UI immediately
    updateCallerUI();
    updateStatus('Initializing call...', 'connecting');

    // Initialize services
    await initializeServices(user.id);

    // Setup appropriate call flow
    if (isIncomingCall && currentCallId) {
        console.log("📲 RECEIVER: Incoming call flow");
        updateStatus('Incoming call...', 'ringing');
        document.getElementById('callerAvatar').classList.add('ringing-animation');
        await handleIncomingCall();
    } else if (friendId) {
        console.log("📤 CALLER: Outgoing call flow");
        updateStatus('Calling...', 'ringing');
        await handleOutgoingCall(friendId, callType);
    } else {
        showError("Cannot start call: missing parameters");
    }

    // Start connection monitor
    startConnectionMonitor();
}

async function initializeServices(userId) {
    try {
        // Initialize Call Service
        const callModule = await import('/app/utils/callService.js');
        callService = callModule.default;
        window.globalCallService = callService;
        
        await callService.initialize(userId);
        console.log("✅ Call service initialized");

        // Setup callbacks
        callService.setOnCallStateChange(handleCallStateChange);
        callService.setOnRemoteStream(handleRemoteStream);
        callService.setOnCallEvent(handleCallEvent);
        callService.setOnSpeakerModeChange(handleSpeakerModeChange);

    } catch (error) {
        console.error("❌ Service initialization failed:", error);
        throw error;
    }
}

function updateCallerUI() {
    const callerNameEl = document.getElementById('callerName');
    const callerAvatarEl = document.getElementById('callerAvatar');
    
    if (callerNameEl) {
        callerNameEl.textContent = friendName;
        // Prevent text overflow
        callerNameEl.style.whiteSpace = 'nowrap';
        callerNameEl.style.overflow = 'hidden';
        callerNameEl.style.textOverflow = 'ellipsis';
        callerNameEl.style.maxWidth = '90%';
    }
    
    if (callerAvatarEl) {
        callerAvatarEl.textContent = friendName.charAt(0).toUpperCase();
    }
}

// ==================== INCOMING CALL HANDLER (RECEIVER) ====================
async function handleIncomingCall() {
    console.log("📲 Processing incoming call...");
    
    if (!currentCallId) {
        showError("No call ID provided");
        return;
    }

    setupIncomingCallControls();

    try {
        // 1. Fetch call details from database
        console.log("📋 Fetching call details for:", currentCallId);
        const { data: call, error } = await supabase
            .from('calls')
            .select('*')
            .eq('id', currentCallId)
            .single();

        if (error) {
            console.error("❌ Call not found:", error);
            showError("Call not found or expired");
            setTimeout(() => window.history.back(), 2000);
            return;
        }

        console.log("✅ Call found:", {
            id: call.id,
            status: call.status,
            caller_id: call.caller_id,
            hasOffer: !!call.sdp_offer
        });

        // Check if call is still ringing
        if (call.status !== 'ringing') {
            if (call.status === 'ended' || call.status === 'missed' || call.status === 'rejected') {
                showError("Call has already ended");
                setTimeout(() => window.history.back(), 2000);
                return;
            }
        }

        // Update friend info if needed
        if (call.caller_id && !friendId) {
            friendId = call.caller_id;
        }

        // 2. Setup real-time monitoring
        setupCallMonitoring(call.id);

    } catch (error) {
        console.error("❌ Incoming call setup failed:", error);
        showError("Failed to setup call: " + error.message);
    }
}

function setupIncomingCallControls() {
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn accept-btn" onclick="window.answerIncomingCall()">
            <i class="fas fa-phone"></i>
            <span>Answer</span>
        </button>
        <button class="control-btn decline-btn" onclick="window.declineIncomingCall()">
            <i class="fas fa-phone-slash"></i>
            <span>Decline</span>
        </button>
        <button class="control-btn debug-btn" onclick="window.runDebugChecks()">
            <i class="fas fa-bug"></i>
            <span>Debug</span>
        </button>
    `;
}

// ==================== OUTGOING CALL HANDLER (CALLER) ====================
async function handleOutgoingCall(friendId, callType) {
    console.log("📤 Starting outgoing call to:", friendId);
    
    setupOutgoingCallControls();

    try {
        // Start the call
        const call = await callService.initiateCall(friendId, callType);
        currentCallId = call.id;
        window.currentCallId = currentCallId;
        
        console.log("✅ Outgoing call started:", call);
        
        // Setup real-time monitoring
        setupCallMonitoring(call.id);

        updateStatus('Ringing...', 'ringing');
        showToast('Calling...');

    } catch (error) {
        console.error("❌ Outgoing call failed:", error);
        showError("Call failed: " + error.message);
    }
}

function setupOutgoingCallControls() {
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn speaker-btn" id="speakerBtn" onclick="window.toggleSpeaker()">
            <i class="fas fa-headphones"></i>
            <span>Speaker</span>
        </button>
        <button class="control-btn mute-btn" id="muteBtn" onclick="window.toggleMute()">
            <i class="fas fa-microphone"></i>
            <span>Mute</span>
        </button>
        <button class="control-btn end-btn" onclick="window.endCall()">
            <i class="fas fa-phone-slash"></i>
            <span>End</span>
        </button>
        <button class="control-btn debug-btn" onclick="window.runDebugChecks()">
            <i class="fas fa-bug"></i>
            <span>Debug</span>
        </button>
    `;
}

// ==================== CALL MONITORING ====================
function setupCallMonitoring(callId) {
    if (!supabase || !callId) return;
    
    console.log("📡 Setting up call monitoring for:", callId);
    
    const channel = supabase.channel(`call-monitor-${callId}`);
    
    channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${callId}`
    }, async (payload) => {
        const call = payload.new;
        console.log("📱 Call updated:", call.status);
        
        // Handle status changes
        switch(call.status) {
            case 'active':
                if (isIncomingCall && !callService.isInCall) {
                    // Call was answered by someone else
                    showCallEnded("Call answered on another device");
                }
                break;
                
            case 'ended':
            case 'missed':
            case 'rejected':
                showCallEnded(`Call ${call.status}`);
                break;
        }
    });
    
    channel.subscribe((status) => {
        console.log(`📡 Call monitor: ${status}`);
    });
}

// ==================== GLOBAL FUNCTIONS ====================
window.answerIncomingCall = async function() {
    console.log("📞 ANSWERING INCOMING CALL...");
    
    if (!callService || !currentCallId) {
        showError("Call service not ready");
        return;
    }

    try {
        // Update UI
        updateStatus('Answering...', 'connecting');
        document.getElementById('callerAvatar').classList.remove('ringing-animation');
        
        // Hide loading message
        const loadingEl = document.getElementById('loadingMessage');
        if (loadingEl) loadingEl.style.display = 'none';
        
        // Answer the call
        await callService.answerCall(currentCallId);
        
        // Switch to active call controls
        setupActiveCallControls();
        
        showToast('Call answered!');
        
    } catch (error) {
        console.error("❌ Answer call failed:", error);
        showError("Failed to answer: " + error.message);
    }
};

window.declineIncomingCall = async function() {
    console.log("❌ DECLINING INCOMING CALL...");
    
    if (supabase && currentCallId) {
        try {
            await supabase
                .from('calls')
                .update({ 
                    status: 'rejected',
                    ended_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentCallId);
            console.log("✅ Call rejected in database");
        } catch (error) {
            console.error("❌ Decline failed:", error);
        }
    }
    
    window.history.back();
};

window.toggleSpeaker = async function() {
    console.log("🔊 TOGGLE SPEAKER clicked");
    
    if (!callService) {
        console.error("❌ No call service");
        showToast('Call service not ready');
        return;
    }

    try {
        const speakerBtn = document.getElementById('speakerBtn');
        if (speakerBtn) speakerBtn.style.opacity = '0.7';
        
        const newMode = await callService.toggleSpeakerMode();
        isSpeakerMode = newMode;
        
        updateSpeakerUI(isSpeakerMode);
        showToast(isSpeakerMode ? '🔊 Speaker ON' : '🎧 Earpiece ON');
        
        // Check database after toggle
        setTimeout(async () => {
            await checkDatabase();
        }, 300);
        
    } catch (error) {
        console.error("❌ Toggle speaker failed:", error);
        showToast('❌ Failed to toggle speaker');
    } finally {
        const speakerBtn = document.getElementById('speakerBtn');
        if (speakerBtn) speakerBtn.style.opacity = '1';
    }
};

function updateSpeakerUI(speakerOn) {
    const speakerBtn = document.getElementById('speakerBtn');
    if (!speakerBtn) return;

    if (speakerOn) {
        speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i><span>Speaker ON</span>';
        speakerBtn.classList.add('active');
    } else {
        speakerBtn.innerHTML = '<i class="fas fa-headphones"></i><span>Speaker</span>';
        speakerBtn.classList.remove('active');
    }
}

window.toggleMute = async function() {
    if (!callService) {
        console.error("❌ No call service");
        return;
    }

    try {
        const isMuted = await callService.toggleMute();
        const muteBtn = document.getElementById('muteBtn');

        if (muteBtn) {
            if (isMuted) {
                muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Muted</span>';
                muteBtn.style.background = 'linear-gradient(45deg, #ff9500, #ff5e3a)';
                showToast('🔇 Microphone Muted');
            } else {
                muteBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Mute</span>';
                muteBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                showToast('🎤 Microphone Unmuted');
            }
        }
    } catch (error) {
        console.error("❌ Toggle mute failed:", error);
        showToast('❌ Failed to toggle mute');
    }
};

window.endCall = async function() {
    console.log("📞 ENDING CALL...");
    
    if (callService) {
        try {
            await callService.endCall();
        } catch (error) {
            console.error("❌ Error ending call:", error);
        }
    }

    showCallEnded("Call ended");
};

function setupActiveCallControls() {
    const controls = document.getElementById('callControls');
    controls.innerHTML = `
        <button class="control-btn speaker-btn" id="speakerBtn" onclick="window.toggleSpeaker()">
            <i class="fas fa-headphones"></i>
            <span>Speaker</span>
        </button>
        <button class="control-btn mute-btn" id="muteBtn" onclick="window.toggleMute()">
            <i class="fas fa-microphone"></i>
            <span>Mute</span>
        </button>
        <button class="control-btn end-btn" onclick="window.endCall()">
            <i class="fas fa-phone-slash"></i>
            <span>End</span>
        </button>
        <button class="control-btn debug-btn" onclick="window.runDebugChecks()">
            <i class="fas fa-bug"></i>
            <span>Debug</span>
        </button>
    `;
}

// ==================== EVENT HANDLERS ====================
function handleCallStateChange(state) {
    console.log("📊 Call state changed:", state);
    
    switch(state) {
        case 'ringing':
            updateStatus('Ringing...', 'ringing');
            break;
        case 'connecting':
            updateStatus('Connecting...', 'connecting');
            break;
        case 'connected':
            updateStatus('Connected', 'connected');
            showToast('✅ Call connected!');
            startCallTimer();
            break;
        case 'disconnected':
            updateStatus('Disconnected', 'error');
            showToast('❌ Connection lost');
            break;
        case 'failed':
            updateStatus('Connection failed', 'error');
            showToast('❌ Connection failed');
            break;
        case 'closed':
            updateStatus('Call ended', 'normal');
            break;
    }
}

function handleRemoteStream(stream) {
    console.log("🔊 REMOTE STREAM RECEIVED!");
    
    const audio = document.getElementById('remoteAudio');
    if (!audio) {
        console.error("❌ No remote audio element");
        return;
    }

    console.log("🎧 Stream details:", {
        active: stream.active,
        id: stream.id,
        tracks: stream.getTracks().length
    });

    audio.srcObject = stream;
    audio.volume = 1.0;
    
    // Set initial to earpiece mode
    audio.setAttribute('playsinline', 'true');
    
    // Update status
    updateStatus('Audio stream received', 'connected');
    
    // Try to play audio
    const playAudio = async () => {
        console.log("▶️ Attempting to play audio...");
        
        try {
            await audio.play();
            console.log("✅ Audio playing successfully!");
            updateStatus('Connected ✓', 'connected');
            showToast('Audio connected!');
            
            // Hide audio help
            document.getElementById('audioHelpOverlay').style.display = 'none';
            
        } catch (error) {
            console.log("⚠️ Audio play blocked:", error.name);
            updateStatus('Tap to enable audio', 'warning');
            
            // Show help overlay
            document.getElementById('audioHelpOverlay').style.display = 'flex';
            
            // Auto-retry
            setTimeout(() => {
                if (audio.paused) {
                    audio.play().catch(e => {
                        console.log("⚠️ Auto-retry failed:", e.name);
                    });
                }
            }, 1000);
        }
    };
    
    // Wait for stream to be ready
    if (stream.active) {
        playAudio();
    } else {
        stream.onactive = playAudio;
    }
}

function handleSpeakerModeChange(speakerMode) {
    console.log("🔊 Speaker mode changed:", speakerMode);
    isSpeakerMode = speakerMode;
    updateSpeakerUI(speakerMode);
}

function handleCallEvent(event, data) {
    console.log("📞 Call event:", event, data);
    
    if (event === 'call_ended') {
        showCallEnded('Call ended');
    }
}

// ==================== HELPER FUNCTIONS ====================
function updateStatus(message, type = 'normal') {
    const statusEl = document.getElementById('callStatus');
    const connStatus = document.getElementById('connectionStatus');
    const loadingEl = document.getElementById('loadingMessage');
    
    if (loadingEl && (type === 'connected' || type === 'ringing')) {
        loadingEl.style.display = 'none';
    }
    
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'call-status';
        
        if (type === 'connected') {
            statusEl.style.color = '#4cd964';
        } else if (type === 'error') {
            statusEl.style.color = '#ff3b30';
        } else if (type === 'warning') {
            statusEl.style.color = '#ff9500';
        } else if (type === 'ringing') {
            statusEl.style.color = '#5ac8fa';
        }
    }
    
    if (connStatus) {
        connStatus.textContent = message;
        connStatus.className = 'connection-status';
        
        if (type === 'connected') {
            connStatus.classList.add('connected');
        } else if (type === 'error') {
            connStatus.classList.add('error');
        } else if (type === 'warning') {
            connStatus.classList.add('warning');
        } else if (type === 'ringing') {
            connStatus.classList.add('ringing');
        } else if (type === 'connecting') {
            connStatus.classList.add('connecting');
        }
    }
    
    console.log("📡 Status:", message);
}

function showCallEnded(message) {
    console.log("📞 Call ended:", message);
    
    updateStatus(message);
    document.getElementById('callTimer').style.display = 'none';
    
    // Clear ringing animation
    const avatar = document.getElementById('callerAvatar');
    if (avatar) avatar.classList.remove('ringing-animation');
    
    showToast(message);
    
    setTimeout(() => {
        window.history.back();
    }, 2000);
}

function startCallTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('callTimer');
    if (!timerEl) return;

    timerEl.style.display = 'block';
    window.callTimerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function showToast(message) {
    const existing = document.getElementById('toastNotification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

function showError(message) {
    console.error("❌ ERROR:", message);
    
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }

    updateStatus('Error', 'error');
    const loadingEl = document.getElementById('loadingMessage');
    if (loadingEl) loadingEl.style.display = 'none';

    showToast('❌ ' + message);
}

// ==================== CONNECTION MONITOR ====================
function startConnectionMonitor() {
    if (connectionMonitor) clearInterval(connectionMonitor);
    
    connectionMonitor = setInterval(() => {
        if (!callService) return;
        
        const state = callService.getConnectionState();
        const audio = document.getElementById('remoteAudio');
        
        // Update audio status
        updateAudioStatus();
        
        // Log state periodically
        if (state !== 'connected' && state !== 'connecting') {
            console.log("📡 Periodic check - Connection state:", state);
        }
    }, 2000);
}

function updateAudioStatus() {
    const audio = document.getElementById('remoteAudio');
    const dot = document.getElementById('audioStatusDot');
    const text = document.getElementById('audioStatusText');
    
    if (!audio) return;
    
    if (audio.srcObject) {
        const stream = audio.srcObject;
        const tracks = stream.getTracks();
        
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
            text.textContent = 'Audio: Connected ✓';
            dot.className = 'audio-status-dot active';
        } else if (tracks.length > 0) {
            text.textContent = 'Audio: Connecting...';
            dot.className = 'audio-status-dot inactive';
        } else {
            text.textContent = 'Audio: No stream';
            dot.className = 'audio-status-dot inactive';
        }
    } else if (callService && callService.isInCall) {
        text.textContent = 'Audio: Setting up...';
        dot.className = 'audio-status-dot inactive';
    } else {
        text.textContent = 'Audio: Ready';
        dot.className = 'audio-status-dot inactive';
    }
}

// ==================== DEBUG FUNCTIONS ====================
window.runDebugChecks = async function() {
    console.group("🔍 DEBUG CHECKS");
    
    console.log("📊 Current State:", {
        currentCallId,
        isIncomingCall,
        friendId,
        friendName,
        callService: !!callService,
        isInCall: callService?.isInCall,
        connectionState: callService?.getConnectionState?.(),
        speakerMode: callService?.getSpeakerMode?.()
    });
    
    // Check WebRTC connection
    if (callService && callService.peerConnection) {
        const pc = callService.peerConnection;
        console.log("📡 WebRTC Connection:", {
            signalingState: pc.signalingState,
            iceConnectionState: pc.iceConnectionState,
            iceGatheringState: pc.iceGatheringState,
            connectionState: pc.connectionState
        });
    }
    
    // Check audio elements
    const remoteAudio = document.getElementById('remoteAudio');
    const localAudio = document.getElementById('localAudio');
    console.log("🎧 Audio Elements:", {
        remoteAudio: remoteAudio ? {
            hasStream: !!remoteAudio.srcObject,
            paused: remoteAudio.paused,
            readyState: remoteAudio.readyState,
            volume: remoteAudio.volume
        } : 'Not found',
        localAudio: localAudio ? {
            hasStream: !!localAudio.srcObject,
            paused: localAudio.paused
        } : 'Not found'
    });
    
    // Check database
    await checkDatabase();
    
    console.groupEnd();
    showToast('Debug complete - check console');
};

async function checkDatabase() {
    if (!currentCallId || !supabase) {
        console.log("❌ Cannot check database: no call ID or supabase");
        return;
    }
    
    try {
        const { data: call, error } = await supabase
            .from('calls')
            .select('id, status, audio_mode, updated_at, sdp_offer, sdp_answer')
            .eq('id', currentCallId)
            .single();
            
        if (error) {
            console.error("❌ Database error:", error);
        } else if (call) {
            console.log("✅ Database record:", {
                id: call.id,
                status: call.status,
                audio_mode: call.audio_mode,
                updated_at: call.updated_at,
                hasOffer: !!call.sdp_offer,
                hasAnswer: !!call.sdp_answer
            });
            
            // Check if database matches current speaker mode
            if (callService && call.audio_mode) {
                const dbSpeaker = call.audio_mode === 'speaker';
                const uiSpeaker = callService.getSpeakerMode();
                
                if (dbSpeaker !== uiSpeaker) {
                    console.warn("⚠️ Database/UI mismatch:", {
                        database: call.audio_mode,
                        ui: uiSpeaker ? 'speaker' : 'mic'
                    });
                }
            }
        }
    } catch (error) {
        console.error("❌ Database check failed:", error);
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', initCallPage);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.callTimerInterval) {
        clearInterval(window.callTimerInterval);
    }
    
    if (connectionMonitor) {
        clearInterval(connectionMonitor);
    }
    
    if (callService) {
        callService.endCall();
    }
});

// Global audio enable function
window.enableAudio = function() {
    const audio = document.getElementById('remoteAudio');
    if (audio) {
        audio.play()
            .then(() => {
                console.log("✅ Audio enabled");
                document.getElementById('audioHelpOverlay').style.display = 'none';
            })
            .catch(e => console.log("⚠️ Audio still blocked:", e));
    }
};