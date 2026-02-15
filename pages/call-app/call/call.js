// /pages/call-app/call/call.js

import { initializeSupabase } from '/pages/call-app/utils/supabase.js'
import { createCallRoom, getRoomInfo, getCallUrl } from '/pages/call-app/utils/jitsi.js'
import { getRelayTalkUser, syncUserToDatabase } from '/pages/call-app/utils/userSync.js'

let supabase
let currentUser
let currentCall
let jitsiIframe
let callRoom
let isVideoOn = false
let joinAttempts = 0

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
        
        callRoom = await createCallRoom()
        
        const callData = {
            caller_id: currentUser.id,
            receiver_id: friendId,
            room_name: callRoom.name,
            room_url: callRoom.url,
            status: 'ringing',
            created_at: new Date().toISOString()
        }
        
        const { data: call, error } = await supabase
            .from('calls')
            .insert([callData])
            .select()
            .single()
        
        if (error) throw error
        
        currentCall = call
        document.getElementById('loadingScreen').style.display = 'none'
        joinCall(call.room_name)
        
    } catch (error) {
        console.error('❌ Call error:', error)
        showError('Failed to start call')
    }
}

async function handleIncomingCall(roomName, callerId, callId) {
    try {
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

async function joinCall(roomName) {
    try {
        document.getElementById('loadingScreen').style.display = 'flex'
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        const roomInfo = await getRoomInfo(roomName)
        
        const container = document.getElementById('dailyContainer')
        container.innerHTML = ''
        
        const wrapper = document.createElement('div')
        wrapper.style.width = '100%'
        wrapper.style.height = '100%'
        wrapper.style.position = 'relative'
        
        const iframe = document.createElement('iframe')
        iframe.allow = 'microphone; camera; autoplay'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.style.background = '#000'
        
        const url = getCallUrl(roomInfo.url, currentUser.username)
        iframe.src = url
        
        wrapper.appendChild(iframe)
        container.appendChild(wrapper)
        jitsiIframe = iframe
        
        // AGGRESSIVE AUTO-JOIN
        iframe.onload = function() {
            console.log('Iframe loaded, attempting auto-join...')
            
            // Try to join every second for 10 seconds
            const joinInterval = setInterval(() => {
                try {
                    const iframeDoc = iframe.contentWindow.document
                    
                    // Look for name input and fill it
                    const nameInput = iframeDoc.querySelector('input[placeholder*="name"], input[type="text"]')
                    if (nameInput) {
                        nameInput.value = currentUser.username
                        nameInput.dispatchEvent(new Event('input', { bubbles: true }))
                    }
                    
                    // Click ALL possible join buttons
                    const buttons = iframeDoc.querySelectorAll('button')
                    buttons.forEach(btn => {
                        const text = btn.textContent.toLowerCase()
                        if (text.includes('join') || text.includes('continue') || text.includes('start')) {
                            console.log('Clicking join button:', text)
                            btn.click()
                        }
                    })
                    
                    // Also try by testid
                    const joinBtn = iframeDoc.querySelector('[data-testid="prejoin.joinButton"]')
                    if (joinBtn) joinBtn.click()
                    
                } catch(e) {}
            }, 1000)
            
            // Stop trying after 10 seconds
            setTimeout(() => clearInterval(joinInterval), 10000)
        }
        
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none'
            document.getElementById('activeCallScreen').style.display = 'block'
        }, 2000)
        
    } catch (error) {
        console.error('❌ Join error:', error)
        showError('Failed to join call')
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
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.location.href = '/pages/call-app/index.html'
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none'
    document.getElementById('errorScreen').style.display = 'flex'
    document.getElementById('errorMessage').textContent = message
}

initCall()