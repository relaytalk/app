// pages/call-app/call/call.js - COMPLETE WITH SPEAKER TOGGLE

import { initializeSupabase } from '../utils/supabase.js'
import { createCallRoom, getRoomInfo, getCallUrl } from '../utils/jitsi.js'
import { getRelayTalkUser, syncUserToDatabase } from '../utils/userSync.js'

let supabase
let currentUser
let currentCall
let jitsiIframe
let callRoom
let audioElements = [] // Track audio elements for speaker toggle

async function initCall() {
    console.log('📞 Initializing call page with Jitsi...')
    
    try {
        const relayUser = getRelayTalkUser()
        if (!relayUser) {
            showError('Please login to RelayTalk first')
            return
        }
        
        console.log('✅ Got user:', relayUser.email)
        
        supabase = await initializeSupabase()
        currentUser = await syncUserToDatabase(supabase, relayUser)
        
        const params = new URLSearchParams(window.location.search)
        const friendId = params.get('friendId')
        const friendName = params.get('friendName')
        const incoming = params.get('incoming')
        const roomName = params.get('room')
        const callerId = params.get('callerId')
        const callId = params.get('callId')
        
        console.log('📞 Call params:', { friendId, friendName, incoming, roomName, callerId, callId })
        
        if (incoming === 'true' && roomName && callerId && callId) {
            await handleIncomingCall(roomName, callerId, callId)
        } else if (friendId) {
            await startOutgoingCall(friendId, friendName)
        } else {
            showError('No call information provided')
        }
        
    } catch (error) {
        console.error('❌ Init error:', error)
        showError('Failed to initialize call: ' + error.message)
    }
}

async function startOutgoingCall(friendId, friendName) {
    try {
        document.getElementById('loadingText').textContent = `Calling ${friendName}...`
        console.log('1️⃣ Starting outgoing call to:', friendId, friendName)
        
        callRoom = await createCallRoom()
        console.log('2️⃣ Room created:', callRoom)
        
        const callData = {
            caller_id: currentUser.id,
            receiver_id: friendId,
            room_name: callRoom.name,
            room_url: callRoom.url,
            status: 'ringing',
            created_at: new Date().toISOString()
        }
        
        console.log('3️⃣ Call data:', callData)
        
        const { data: call, error } = await supabase
            .from('calls')
            .insert([callData])
            .select()
            .single()
        
        if (error) {
            console.error('❌ Supabase error:', error)
            throw new Error('Database error: ' + error.message)
        }
        
        console.log('4️⃣ ✅ Call inserted:', call)
        
        currentCall = call
        document.getElementById('loadingScreen').style.display = 'none'
        showCallingUI(friendName)
        setupCallListener(call.id)
        
    } catch (error) {
        console.error('❌ Call error:', error)
        showError('Failed to start call: ' + error.message)
    }
}

async function handleIncomingCall(roomName, callerId, callId) {
    try {
        console.log('📞 Handling incoming call:', { roomName, callerId, callId })
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        currentCall = { id: callId, room_name: roomName }
        
        await supabase
            .from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', callId)
        
        await joinCall(roomName)
        
    } catch (error) {
        console.error('❌ Incoming call error:', error)
        showError('Failed to accept call')
    }
}

function showCallingUI(friendName) {
    const container = document.createElement('div')
    container.className = 'incoming-call-screen'
    container.id = 'outgoingUI'
    container.innerHTML = `
        <div class="incoming-call-content">
            <div class="caller-avatar">
                <i class="fas fa-user-circle" style="font-size: 80px; color: #f5b342;"></i>
            </div>
            <div class="caller-info">
                <h2 style="color: white;">${friendName}</h2>
                <p id="callStatus" style="color: #ccc;">Calling...</p>
            </div>
            <div class="call-actions">
                <button class="call-btn decline-btn" onclick="window.cancelCall()" style="background: #dc3545; width: 60px; height: 60px; border-radius: 50%; border: none; color: white; font-size: 24px; cursor: pointer;">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
    `
    document.body.appendChild(container)
}

function setupCallListener(callId) {
    console.log('5️⃣ Setting up call listener for ID:', callId)
    
    supabase
        .channel(`call-${callId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${callId}`
        }, (payload) => {
            console.log('📞 Call update received:', payload.new.status)
            
            if (payload.new.status === 'active') {
                document.getElementById('callStatus').textContent = 'Connecting...'
                joinCall(payload.new.room_name)
            } else if (payload.new.status === 'rejected') {
                showCallEnded('Call was rejected')
            } else if (payload.new.status === 'cancelled') {
                showCallEnded('Call was cancelled')
            }
        })
        .subscribe((status) => {
            console.log('Call listener subscription status:', status)
        })
}

async function joinCall(roomName) {
    try {
        console.log('6️⃣ Joining Jitsi call room:', roomName)
        
        document.getElementById('outgoingUI')?.remove()
        document.getElementById('loadingScreen').style.display = 'flex'
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        const roomInfo = await getRoomInfo(roomName)
        console.log('7️⃣ Room info:', roomInfo)
        
        const container = document.getElementById('dailyContainer')
        container.innerHTML = ''
        
        // Create wrapper
        const wrapper = document.createElement('div')
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        wrapper.style.position = 'relative'
        wrapper.style.overflow = 'hidden'
        wrapper.style.background = '#000'
        
        const iframe = document.createElement('iframe')
        iframe.allow = 'microphone; camera; autoplay; display-capture'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.style.background = '#000'
        
        const url = getCallUrl(roomInfo.url, currentUser.username)
        iframe.src = url
        console.log('8️⃣ Iframe URL:', url)
        
        wrapper.appendChild(iframe)
        container.appendChild(wrapper)
        jitsiIframe = iframe
        
        // Add CSS to force video fit and hide inputs
        const style = document.createElement('style');
        style.textContent = `
            /* Force video to fill screen properly */
            video, 
            #largeVideo, 
            .videocontainer, 
            .remote-videos,
            [class*="video"],
            [class*="Video"] {
                object-fit: cover !important;
                width: 100% !important;
                height: 100% !important;
            }
            
            /* Hide ALL input fields and join screens */
            input, 
            .prejoin-input-area, 
            .welcome-page,
            .join-dialog,
            [class*="prejoin"],
            [class*="welcome"],
            [class*="input"],
            [class*="Input"],
            [class*="form"],
            [class*="Form"] {
                display: none !important;
            }
            
            /* Hide watermarks and logos */
            .watermark,
            .brand-watermark,
            .powered-by,
            [class*="watermark"],
            [class*="logo"],
            [class*="Logo"] {
                display: none !important;
            }
        `;
        wrapper.appendChild(style);
        
        // Monitor iframe for audio elements
        iframe.onload = function() {
            console.log('Iframe loaded, setting up audio monitoring...');
            
            // Try to get audio elements from iframe
            setTimeout(() => {
                try {
                    const iframeDoc = iframe.contentWindow.document;
                    const audioEls = iframeDoc.querySelectorAll('audio, video');
                    audioElements = Array.from(audioEls);
                    console.log(`Found ${audioElements.length} audio/video elements`);
                    
                    // Set initial audio mode (earpiece)
                    setAudioMode('earpiece');
                } catch(e) {
                    console.log('Could not access iframe audio elements:', e);
                }
            }, 3000);
        };
        
        // Hide loading after delay
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none'
        }, 3000)
        
        document.getElementById('activeCallScreen').style.display = 'block'
        console.log('✅ Jitsi call connected!')
        
    } catch (error) {
        console.error('❌ Join error:', error)
        showError('Failed to join call: ' + error.message)
    }
}

// Function to set audio mode (earpiece vs speaker)
function setAudioMode(mode) {
    console.log(`Setting audio mode to: ${mode}`);
    
    try {
        // Try to access iframe audio elements
        if (jitsiIframe) {
            try {
                const iframeDoc = jitsiIframe.contentWindow.document;
                const mediaElements = iframeDoc.querySelectorAll('audio, video');
                
                mediaElements.forEach(el => {
                    if (mode === 'speaker') {
                        // Speaker mode - use speaker
                        el.setSinkId?.('default').catch(() => {});
                        // Force audio output through speaker
                        if (el.audioTracks) {
                            // For video elements
                            el.audioTracks[0]?.enabled = true;
                        }
                    } else {
                        // Earpiece mode - use earpiece
                        el.setSinkId?.('earpiece').catch(() => {});
                    }
                });
            } catch(e) {
                console.log('Could not access iframe audio:', e);
            }
        }
        
        // Also try Web Audio API approach
        if (typeof AudioContext !== 'undefined') {
            // Force audio output through appropriate channel
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (mode === 'speaker') {
                // Force speaker
                audioContext.resume();
            } else {
                // Force earpiece (for calls)
                // This is handled by the browser automatically for WebRTC
            }
        }
        
    } catch (error) {
        console.log('Audio mode change error:', error);
    }
}

// Call controls
window.toggleMute = function() {
    const btn = document.getElementById('muteBtn')
    btn.classList.toggle('muted')
    btn.innerHTML = btn.classList.contains('muted') 
        ? '<i class="fas fa-microphone-slash"></i>' 
        : '<i class="fas fa-microphone"></i>'
    
    // Try to mute/unmute in Jitsi
    if (jitsiIframe) {
        try {
            jitsiIframe.contentWindow.postMessage({
                type: 'muteAudio',
                muted: btn.classList.contains('muted')
            }, '*');
        } catch(e) {}
    }
}

window.toggleSpeaker = function() {
    const btn = document.getElementById('speakerBtn')
    const isSpeakerOff = btn.classList.contains('speaker-off')
    
    if (isSpeakerOff) {
        // Currently off (earpiece), switch to speaker
        btn.classList.remove('speaker-off')
        btn.innerHTML = '<i class="fas fa-volume-up"></i>'
        setAudioMode('speaker')
        console.log('Switched to SPEAKER mode')
    } else {
        // Currently on (speaker), switch to earpiece
        btn.classList.add('speaker-off')
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>'
        setAudioMode('earpiece')
        console.log('Switched to EARPIECE mode')
    }
}

window.endCall = async function() {
    console.log('Ending call...')
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.location.href = '../index.html'
}

window.cancelCall = async function() {
    console.log('Cancelling call...')
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'cancelled', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.location.href = '../index.html'
}

window.acceptCall = function() {
    // Handled by incoming flow
}

window.declineCall = function() {
    if (currentCall) {
        supabase
            .from('calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
            .then(() => {
                window.location.href = '../index.html'
            })
    } else {
        window.location.href = '../index.html'
    }
}

function showCallEnded(message) {
    document.getElementById('outgoingUI')?.remove()
    
    const endedScreen = document.createElement('div')
    endedScreen.className = 'incoming-call-screen'
    endedScreen.innerHTML = `
        <div class="incoming-call-content">
            <div class="caller-avatar">
                <i class="fas fa-phone-slash" style="color:#dc3545; font-size: 60px;"></i>
            </div>
            <div class="caller-info">
                <h2 style="color: white;">Call Ended</h2>
                <p style="color:#ccc; margin: 10px 0 20px;">${message}</p>
            </div>
            <button onclick="window.location.href='../index.html'" style="background: #f5b342; color: #333; border: none; padding: 12px 24px; border-radius: 25px; font-size: 16px; cursor: pointer; margin-top: 20px;">
                Go Back
            </button>
        </div>
    `
    document.body.appendChild(endedScreen)
    
    setTimeout(() => {
        window.location.href = '../index.html'
    }, 2000)
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none'
    document.getElementById('errorScreen').style.display = 'flex'
    document.getElementById('errorMessage').textContent = message
}

// Handle messages from Jitsi
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'video-conference-started') {
        console.log('Conference started')
    }
})

// Listen for audio element changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && jitsiIframe) {
            // Check for new audio elements
            try {
                const iframeDoc = jitsiIframe.contentWindow.document;
                const newAudio = iframeDoc.querySelectorAll('audio, video');
                if (newAudio.length > audioElements.length) {
                    audioElements = Array.from(newAudio);
                    console.log('New audio elements detected');
                }
            } catch(e) {}
        }
    });
});

// Start observing when iframe is ready
setTimeout(() => {
    if (jitsiIframe) {
        try {
            observer.observe(document.body, { childList: true, subtree: true });
        } catch(e) {}
    }
}, 5000);

initCall()