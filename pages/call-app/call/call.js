// /pages/call-app/call/call.js - FIXED VERSION

import { initializeSupabase } from '/pages/call-app/utils/supabase.js'
import { createCallRoom, getRoomInfo, getCallUrl } from '/pages/call-app/utils/jitsi.js'
import { getRelayTalkUser, syncUserToDatabase } from '/pages/call-app/utils/userSync.js'

let supabase
let currentUser
let currentCall
let jitsiIframe
let callRoom
let isVideoOn = false

async function initCall() {
    console.log('📞 Initializing call...')
    
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
        showError('Failed to initialize call')
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
        
        // Instead of showing calling UI, just update loading text
        document.getElementById('loadingText').textContent = `Waiting for ${friendName} to answer...`
        
        // Listen for answer
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
                // Update loading text if element exists
                const loadingText = document.getElementById('loadingText')
                if (loadingText) {
                    loadingText.textContent = 'Connecting...'
                }
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
        
        document.getElementById('loadingScreen').style.display = 'flex'
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        const roomInfo = await getRoomInfo(roomName)
        console.log('7️⃣ Room info:', roomInfo)
        
        const container = document.getElementById('dailyContainer')
        container.innerHTML = ''
        
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
        
        // FIXED: Use getCallUrl properly
        const url = getCallUrl(roomInfo.url, currentUser.username)
        iframe.src = url
        console.log('8️⃣ Iframe URL:', url)
        
        wrapper.appendChild(iframe)
        container.appendChild(wrapper)
        jitsiIframe = iframe
        
        // AUTO-JOIN
        iframe.onload = function() {
            console.log('Iframe loaded, auto-joining...')
            
            // Try to join every second for 10 seconds
            const joinInterval = setInterval(() => {
                try {
                    const iframeDoc = iframe.contentWindow.document
                    
                    // Fill name input
                    const nameInput = iframeDoc.querySelector('input[placeholder*="name"], input[type="text"]')
                    if (nameInput) {
                        nameInput.value = currentUser.username
                        nameInput.dispatchEvent(new Event('input', { bubbles: true }))
                    }
                    
                    // Click join buttons
                    const joinBtn = iframeDoc.querySelector('[data-testid="prejoin.joinButton"]')
                    if (joinBtn) {
                        console.log('Clicking join button')
                        joinBtn.click()
                        clearInterval(joinInterval)
                    }
                    
                    // Try other buttons
                    const buttons = iframeDoc.querySelectorAll('button')
                    buttons.forEach(btn => {
                        const text = btn.textContent.toLowerCase()
                        if (text.includes('join') || text.includes('continue')) {
                            console.log('Clicking button:', text)
                            btn.click()
                        }
                    })
                    
                } catch(e) {}
            }, 1000)
            
            setTimeout(() => clearInterval(joinInterval), 10000)
        }
        
        // Hide loading after delay
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none'
            document.getElementById('activeCallScreen').style.display = 'block'
        }, 3000)
        
        console.log('✅ Jitsi call connected!')
        
    } catch (error) {
        console.error('❌ Join error:', error)
        showError('Failed to join call: ' + error.message)
    }
}

// Video toggle
window.toggleVideo = function() {
    const btn = document.getElementById('videoBtn')
    isVideoOn = !isVideoOn
    
    if (isVideoOn) {
        btn.innerHTML = '<i class="fas fa-video"></i>'
        btn.style.background = '#f5b342'
    } else {
        btn.innerHTML = '<i class="fas fa-video-slash"></i>'
        btn.style.background = '#333'
    }
    
    if (jitsiIframe) {
        try {
            jitsiIframe.contentWindow.postMessage({
                type: 'setVideoMuted',
                muted: !isVideoOn
            }, '*')
        } catch(e) {}
    }
}

// Mute toggle
window.toggleMute = function() {
    const btn = document.getElementById('muteBtn')
    btn.classList.toggle('muted')
    btn.innerHTML = btn.classList.contains('muted') 
        ? '<i class="fas fa-microphone-slash"></i>' 
        : '<i class="fas fa-microphone"></i>'
    
    if (jitsiIframe) {
        try {
            jitsiIframe.contentWindow.postMessage({
                type: 'muteAudio',
                muted: btn.classList.contains('muted')
            }, '*')
        } catch(e) {}
    }
}

// Speaker toggle
window.toggleSpeaker = function() {
    const btn = document.getElementById('speakerBtn')
    btn.classList.toggle('speaker-off')
    btn.innerHTML = btn.classList.contains('speaker-off')
        ? '<i class="fas fa-volume-mute"></i>'
        : '<i class="fas fa-volume-up"></i>'
}

// End call
window.endCall = async function() {
    console.log('Ending call...')
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.location.href = '/pages/call-app/index.html'
}

window.cancelCall = async function() {
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'cancelled', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.location.href = '/pages/call-app/index.html'
}

function showCallEnded(message) {
    document.getElementById('loadingScreen').style.display = 'flex'
    document.getElementById('loadingText').textContent = message
    
    setTimeout(() => {
        window.location.href = '/pages/call-app/index.html'
    }, 2000)
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none'
    document.getElementById('errorScreen').style.display = 'flex'
    document.getElementById('errorMessage').textContent = message
}

initCall()