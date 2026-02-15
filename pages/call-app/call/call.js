// call-app/call/call.js - WITH VIDEO BUTTON ON YOUR UI

import { initializeSupabase } from '../utils/supabase.js'
import { createCallRoom, getRoomInfo, getCallUrl } from '../utils/jitsi.js'
import { getRelayTalkUser, syncUserToDatabase } from '../utils/userSync.js'

let supabase
let currentUser
let currentCall
let jitsiIframe
let callRoom
let isVideoOn = false  // Track video state

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
        
        // Add CSS to hide ALL Jitsi UI
        const style = document.createElement('style')
        style.textContent = `
            /* Hide everything Jitsi */
            .prejoin-screen, .welcome-page, .join-dialog,
            input, button, [class*="toolbar"], [class*="Toolbar"],
            [class*="watermark"], [class*="Watermark"],
            [class*="filmstrip"], [class*="Filmstrip"],
            [class*="chat"], [class*="Chat"],
            [class*="invite"], [class*="Invite"],
            [class*="moderator"], [class*="Moderator"],
            [class*="dial"], [class*="Dial"],
            [class*="phone"], [class*="Phone"],
            .subject, .conference-timer {
                display: none !important;
            }
            
            /* Keep video visible */
            video, #largeVideo, .videocontainer, .remote-videos {
                display: block !important;
                object-fit: cover !important;
                width: 100% !important;
                height: 100% !important;
            }
        `
        wrapper.appendChild(style)
        
        // AUTO-JOIN: Click any join button that appears
        iframe.onload = function() {
            console.log('Iframe loaded, auto-joining...')
            
            // Try multiple times to ensure join happens
            const joinAttempts = [1000, 2000, 3000, 5000]
            
            joinAttempts.forEach(delay => {
                setTimeout(() => {
                    try {
                        const iframeDoc = iframe.contentWindow.document
                        
                        // Find and click join button
                        const joinSelectors = [
                            'button[data-testid="prejoin.joinButton"]',
                            '.prejoin-input-area button',
                            '.join-button',
                            'button:contains("Join")',
                            'button:contains("Join meeting")',
                            'button:contains("Join now")'
                        ]
                        
                        for (const selector of joinSelectors) {
                            const btn = iframeDoc.querySelector(selector)
                            if (btn) {
                                console.log(`Found join button (${selector}), clicking...`)
                                btn.click()
                                break
                            }
                        }
                        
                        // Also try to find name input and fill it (just in case)
                        const nameInput = iframeDoc.querySelector('input[placeholder*="name"], input[type="text"]')
                        if (nameInput) {
                            nameInput.value = currentUser.username
                            nameInput.dispatchEvent(new Event('input', { bubbles: true }))
                        }
                        
                    } catch(e) {
                        // Ignore errors - iframe might not be ready
                    }
                }, delay)
            })
        }
        
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

// Toggle video on/off
window.toggleVideo = function() {
    const btn = document.getElementById('videoBtn')
    isVideoOn = !isVideoOn
    
    if (isVideoOn) {
        btn.innerHTML = '<i class="fas fa-video"></i>'
        btn.style.background = '#f5b342'  // Highlight when on
    } else {
        btn.innerHTML = '<i class="fas fa-video-slash"></i>'
        btn.style.background = '#333'      // Dim when off
    }
    
    // Send video toggle to Jitsi
    if (jitsiIframe) {
        try {
            jitsiIframe.contentWindow.postMessage({
                type: 'setVideoMuted',
                muted: !isVideoOn
            }, '*')
        } catch(e) {}
    }
}

window.toggleMute = function() {
    const btn = document.getElementById('muteBtn')
    btn.classList.toggle('muted')
    if (btn.classList.contains('muted')) {
        btn.innerHTML = '<i class="fas fa-microphone-slash"></i>'
    } else {
        btn.innerHTML = '<i class="fas fa-microphone"></i>'
    }
    
    if (jitsiIframe) {
        try {
            jitsiIframe.contentWindow.postMessage({
                type: 'muteAudio',
                muted: btn.classList.contains('muted')
            }, '*')
        } catch(e) {}
    }
}

window.toggleSpeaker = function() {
    const btn = document.getElementById('speakerBtn')
    btn.classList.toggle('speaker-off')
    if (btn.classList.contains('speaker-off')) {
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>'
    } else {
        btn.innerHTML = '<i class="fas fa-volume-up"></i>'
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

window.acceptCall = function() {}
window.declineCall = function() {}

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

initCall()