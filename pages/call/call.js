// call.js - Daily.co voice calls for mobile

import { initializeSupabase, supabase as supabaseClient } from '../../utils/supabase.js';
import { createCallRoom, getCallUrl, getRoomInfo } from '../../utils/daily.js';

let supabase = null;
let currentUser = null;
let currentCall = null;
let dailyIframe = null;
let callRoom = null;
let callType = 'outgoing'; // 'incoming' or 'outgoing'
let callerInfo = null;
let callInterval = null;

// Initialize call page
async function initCallPage() {
    console.log('Initializing call page...');
    
    try {
        supabase = await initializeSupabase();
        
        if (!supabase || !supabase.auth) {
            throw new Error('Supabase not initialized');
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (!session) {
            window.location.href = '../../pages/login/index.html';
            return;
        }
        
        currentUser = session.user;
        console.log('✅ User:', currentUser.email);
        
        // Get call parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');
        const roomName = urlParams.get('room');
        const incoming = urlParams.get('incoming');
        
        if (incoming === 'true' && roomName) {
            // Incoming call
            callType = 'incoming';
            await handleIncomingCall(roomName);
        } else if (friendId) {
            // Outgoing call
            callType = 'outgoing';
            await startOutgoingCall(friendId);
        } else {
            showError('No call information provided');
        }
        
    } catch (error) {
        console.error('Init error:', error);
        showError('Failed to initialize call: ' + error.message);
    }
}

// Start an outgoing call
async function startOutgoingCall(friendId) {
    try {
        document.getElementById('loadingText').textContent = 'Calling...';
        
        // Get friend info
        const { data: friend, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', friendId)
            .single();
            
        if (error || !friend) {
            throw new Error('Could not find friend');
        }
        
        callerInfo = friend;
        
        // Create Daily.co room
        callRoom = await createCallRoom();
        console.log('✅ Room created:', callRoom);
        
        // Store call in Supabase
        const { data: call, error: callError } = await supabase
            .from('calls')
            .insert({
                caller_id: currentUser.id,
                receiver_id: friendId,
                room_name: callRoom.name,
                room_url: callRoom.url,
                status: 'ringing',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (callError) throw callError;
        
        currentCall = call;
        
        // Hide loading, show calling UI
        document.getElementById('loadingScreen').style.display = 'none';
        
        // Show outgoing call UI (simplified - just show we're calling)
        showOutgoingUI(friend);
        
        // Listen for call acceptance/rejection
        setupCallListener(call.id);
        
    } catch (error) {
        console.error('Call start error:', error);
        showError('Failed to start call: ' + error.message);
    }
}

// Handle incoming call
async function handleIncomingCall(roomName) {
    try {
        document.getElementById('loadingText').textContent = 'Incoming call...';
        
        // Get room info from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const callerId = urlParams.get('callerId');
        const callId = urlParams.get('callId');
        
        if (!callerId || !callId) {
            throw new Error('Missing call information');
        }
        
        // Get caller info
        const { data: caller, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', callerId)
            .single();
            
        if (error || !caller) {
            throw new Error('Could not find caller');
        }
        
        callerInfo = caller;
        currentCall = { id: callId, room_name: roomName };
        
        // Hide loading, show incoming call UI
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('incomingCallScreen').style.display = 'flex';
        document.getElementById('callerName').textContent = caller.username;
        
        // Set caller avatar
        const avatarEl = document.getElementById('callerAvatar');
        if (caller.avatar_url) {
            avatarEl.innerHTML = `<img src="${caller.avatar_url}" alt="${caller.username}" style="width:120px; height:120px; border-radius:50%; object-fit:cover;">`;
        }
        
        // Listen for call status changes
        setupCallListener(callId);
        
    } catch (error) {
        console.error('Incoming call error:', error);
        showError('Failed to handle incoming call: ' + error.message);
    }
}

// Show outgoing call UI
function showOutgoingUI(friend) {
    // Create a simple outgoing call UI
    const outgoingScreen = document.createElement('div');
    outgoingScreen.className = 'incoming-call-screen';
    outgoingScreen.id = 'outgoingCallScreen';
    outgoingScreen.innerHTML = `
        <div class="incoming-call-content">
            <div class="caller-avatar">
                ${friend.avatar_url 
                    ? `<img src="${friend.avatar_url}" alt="${friend.username}" style="width:120px; height:120px; border-radius:50%; object-fit:cover;">`
                    : `<i class="fas fa-user-circle"></i>`
                }
            </div>
            <div class="caller-info">
                <h2>${friend.username}</h2>
                <p>Calling...</p>
            </div>
            <div class="call-actions">
                <button class="call-btn decline-btn" onclick="cancelCall()">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(outgoingScreen);
}

// Setup realtime listener for call
function setupCallListener(callId) {
    // Subscribe to call changes
    const subscription = supabase
        .channel(`call:${callId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${callId}`
        }, (payload) => {
            console.log('Call update:', payload);
            
            if (payload.new.status === 'active' && !dailyIframe) {
                // Call was accepted
                joinCall();
            } else if (payload.new.status === 'rejected' || payload.new.status === 'ended') {
                // Call was rejected or ended
                if (callType === 'outgoing') {
                    showCallEnded('Call was rejected');
                } else {
                    window.location.href = '../../pages/home/index.html';
                }
            }
        })
        .subscribe();
    
    // Store subscription for cleanup
    window.callSubscription = subscription;
    
    // Check if call is already active
    checkCallStatus(callId);
}

// Check call status
async function checkCallStatus(callId) {
    const { data: call } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();
        
    if (call && call.status === 'active') {
        joinCall();
    }
}

// Accept incoming call
window.acceptCall = async function() {
    try {
        document.getElementById('incomingCallScreen').style.display = 'none';
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('loadingText').textContent = 'Connecting...';
        
        // Update call status in Supabase
        await supabase
            .from('calls')
            .update({ 
                status: 'active',
                answered_at: new Date().toISOString()
            })
            .eq('id', currentCall.id);
        
        // Join the call
        await joinCall();
        
    } catch (error) {
        console.error('Accept error:', error);
        showError('Failed to accept call');
    }
};

// Decline incoming call
window.declineCall = async function() {
    try {
        await supabase
            .from('calls')
            .update({ 
                status: 'rejected',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentCall.id);
        
        window.location.href = '../../pages/home/index.html';
        
    } catch (error) {
        console.error('Decline error:', error);
        window.location.href = '../../pages/home/index.html';
    }
};

// Cancel outgoing call
window.cancelCall = async function() {
    try {
        await supabase
            .from('calls')
            .update({ 
                status: 'cancelled',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentCall.id);
        
        // Delete Daily room
        if (callRoom) {
            // Delete room API call would go here
        }
        
        window.location.href = '../../pages/home/index.html';
        
    } catch (error) {
        window.location.href = '../../pages/home/index.html';
    }
};

// Join the call (both outgoing and incoming)
async function joinCall() {
    try {
        document.getElementById('loadingScreen').style.display = 'flex';
        document.getElementById('loadingText').textContent = 'Joining call...';
        
        // Hide any incoming/outgoing UI
        document.getElementById('incomingCallScreen')?.style.display = 'none';
        document.getElementById('outgoingCallScreen')?.remove();
        
        // Get room name
        const roomName = currentCall.room_name;
        
        // Get room URL
        const roomInfo = await getRoomInfo(roomName);
        if (!roomInfo) {
            throw new Error('Could not find call room');
        }
        
        // Create Daily iframe
        const container = document.getElementById('dailyContainer');
        
        // Create iframe for Daily
        const iframe = document.createElement('iframe');
        iframe.allow = 'microphone; autoplay; playinline';
        
        // Build URL with parameters
        const dailyUrl = new URL(roomInfo.url);
        dailyUrl.searchParams.set('t', ''); // No token needed for simple calls
        dailyUrl.searchParams.set('dn', currentUser.user_metadata?.username || 'User');
        dailyUrl.searchParams.set('video', '0');
        dailyUrl.searchParams.set('audio', '1');
        dailyUrl.searchParams.set('chrome', '0');
        dailyUrl.searchParams.set('embed', '1');
        
        iframe.src = dailyUrl.toString();
        
        container.innerHTML = '';
        container.appendChild(iframe);
        dailyIframe = iframe;
        
        // Show active call screen
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('activeCallScreen').style.display = 'block';
        
        // Setup audio state
        setupAudioHandling();
        
    } catch (error) {
        console.error('Join error:', error);
        showError('Failed to join call: ' + error.message);
    }
}

// Setup audio handling
function setupAudioHandling() {
    let isMuted = false;
    let isSpeakerOn = true;
    
    // Mute toggle
    window.toggleMute = function() {
        isMuted = !isMuted;
        const muteBtn = document.getElementById('muteBtn');
        
        if (isMuted) {
            muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            muteBtn.classList.add('muted');
            // Send mute command to iframe (simplified)
            if (dailyIframe) {
                // Daily iframe handles its own mute
            }
        } else {
            muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            muteBtn.classList.remove('muted');
        }
    };
    
    // Speaker toggle
    window.toggleSpeaker = function() {
        isSpeakerOn = !isSpeakerOn;
        const speakerBtn = document.getElementById('speakerBtn');
        
        if (!isSpeakerOn) {
            speakerBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            speakerBtn.classList.add('speaker-off');
        } else {
            speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            speakerBtn.classList.remove('speaker-off');
        }
    };
    
    // End call
    window.endCall = async function() {
        try {
            await supabase
                .from('calls')
                .update({ 
                    status: 'ended',
                    ended_at: new Date().toISOString()
                })
                .eq('id', currentCall.id);
            
            window.location.href = '../../pages/home/index.html';
            
        } catch (error) {
            window.location.href = '../../pages/home/index.html';
        }
    };
}

// Show call ended message
function showCallEnded(message) {
    document.getElementById('outgoingCallScreen')?.remove();
    
    const endedScreen = document.createElement('div');
    endedScreen.className = 'incoming-call-screen';
    endedScreen.innerHTML = `
        <div class="incoming-call-content">
            <div class="caller-avatar">
                <i class="fas fa-phone-slash" style="color:#dc3545;"></i>
            </div>
            <div class="caller-info">
                <h2>Call Ended</h2>
                <p>${message}</p>
            </div>
            <button class="back-home-btn" onclick="window.location.href='../../pages/home/index.html'">
                <i class="fas fa-arrow-left"></i> Go Back
            </button>
        </div>
    `;
    document.body.appendChild(endedScreen);
}

// Show error
function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
}

// Go back
window.goBack = function() {
    window.location.href = '../../pages/home/index.html';
};

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.callSubscription) {
        window.callSubscription.unsubscribe();
    }
});

// Start
document.addEventListener('DOMContentLoaded', initCallPage);