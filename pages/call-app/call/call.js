// pages/call-app/pages/call/call.js

import { initializeSupabase } from '../../utils/supabase.js'
import { createCallRoom, getRoomInfo, getCallUrl } from '../../utils/daily.js'
import { getRelayTalkUser, syncUserToDatabase } from '../../utils/userSync.js'

let supabase
let currentUser
let currentCall
let dailyIframe
let callRoom

async function initCall() {
    try {
        // Get user from RelayTalk
        const relayUser = getRelayTalkUser()
        if (!relayUser) {
            showError('Please login to RelayTalk first')
            return
        }
        
        // Initialize Supabase
        supabase = await initializeSupabase()
        
        // Sync user to database
        currentUser = await syncUserToDatabase(supabase, relayUser)
        
        // Get call parameters
        const params = new URLSearchParams(window.location.search)
        const friendId = params.get('friendId')
        const friendName = params.get('friendName')
        const incoming = params.get('incoming')
        const roomName = params.get('room')
        const callerId = params.get('callerId')
        const callId = params.get('callId')
        
        if (incoming === 'true' && roomName && callerId && callId) {
            // Handle incoming call
            await handleIncomingCall(roomName, callerId, callId)
        } else if (friendId) {
            // Start outgoing call
            await startOutgoingCall(friendId, friendName)
        } else {
            showError('No call information provided')
        }
        
    } catch (error) {
        console.error('Init error:', error)
        showError('Failed to initialize call')
    }
}

async function startOutgoingCall(friendId, friendName) {
    try {
        document.getElementById('loadingText').textContent = `Calling ${friendName}...`
        
        // Create Daily.co room
        console.log('Creating call room...')
        callRoom = await createCallRoom()
        
        // Store call in database
        const { data: call, error } = await supabase
            .from('calls')
            .insert([{
                caller_id: currentUser.id,
                receiver_id: friendId,
                room_name: callRoom.name,
                room_url: callRoom.url,
                status: 'ringing',
                created_at: new Date().toISOString()
            }])
            .select()
            .single()
        
        if (error) throw error
        
        currentCall = call
        
        // Hide loading, show calling UI
        document.getElementById('loadingScreen').style.display = 'none'
        showCallingUI(friendName)
        
        // Listen for answer
        setupCallListener(call.id)
        
    } catch (error) {
        console.error('Call error:', error)
        showError('Failed to start call: ' + error.message)
    }
}

async function handleIncomingCall(roomName, callerId, callId) {
    try {
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        currentCall = { id: callId, room_name: roomName }
        
        // Update call status
        await supabase
            .from('calls')
            .update({ 
                status: 'active',
                answered_at: new Date().toISOString()
            })
            .eq('id', callId)
        
        // Join the call
        await joinCall(roomName)
        
    } catch (error) {
        console.error('Incoming call error:', error)
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
                <i class="fas fa-user-circle"></i>
            </div>
            <div class="caller-info">
                <h2>${friendName}</h2>
                <p id="callStatus">Calling...</p>
            </div>
            <div class="call-actions">
                <button class="call-btn decline-btn" onclick="window.cancelCall()">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
    `
    document.body.appendChild(container)
}

function setupCallListener(callId) {
    supabase
        .channel(`call-${callId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${callId}`
        }, (payload) => {
            console.log('Call update:', payload.new.status)
            
            if (payload.new.status === 'active') {
                document.getElementById('callStatus').textContent = 'Connecting...'
                joinCall(payload.new.room_name)
            } else if (payload.new.status === 'rejected') {
                showCallEnded('Call was rejected')
            } else if (payload.new.status === 'cancelled') {
                showCallEnded('Call was cancelled')
            }
        })
        .subscribe()
}

async function joinCall(roomName) {
    try {
        // Remove outgoing UI
        document.getElementById('outgoingUI')?.remove()
        
        document.getElementById('loadingScreen').style.display = 'flex'
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        // Get room info
        const roomInfo = await getRoomInfo(roomName)
        
        // Create iframe
        const iframe = document.createElement('iframe')
        iframe.allow = 'microphone; autoplay; playinline'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        
        // Build URL
        const url = getCallUrl(roomInfo.url, currentUser.username)
        iframe.src = url
        
        // Add to container
        document.getElementById('dailyContainer').innerHTML = ''
        document.getElementById('dailyContainer').appendChild(iframe)
        dailyIframe = iframe
        
        // Show call screen
        document.getElementById('loadingScreen').style.display = 'none'
        document.getElementById('activeCallScreen').style.display = 'block'
        
    } catch (error) {
        console.error('Join error:', error)
        showError('Failed to join call')
    }
}

// Call controls
window.toggleMute = function() {
    const btn = document.getElementById('muteBtn')
    btn.classList.toggle('muted')
    if (btn.classList.contains('muted')) {
        btn.innerHTML = '<i class="fas fa-microphone-slash"></i>'
    } else {
        btn.innerHTML = '<i class="fas fa-microphone"></i>'
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
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ 
                status: 'ended',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentCall.id)
    }
    window.location.href = '../../index.html'
}

window.cancelCall = async function() {
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ 
                status: 'cancelled',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentCall.id)
    }
    window.location.href = '../../index.html'
}

window.acceptCall = async function() {
    // Handled by incoming flow
}

window.declineCall = async function() {
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ 
                status: 'rejected',
                ended_at: new Date().toISOString()
            })
            .eq('id', currentCall.id)
    }
    window.location.href = '../../index.html'
}

function showCallEnded(message) {
    document.getElementById('outgoingUI')?.remove()
    
    const endedScreen = document.createElement('div')
    endedScreen.className = 'incoming-call-screen'
    endedScreen.innerHTML = `
        <div class="incoming-call-content">
            <div class="caller-avatar">
                <i class="fas fa-phone-slash" style="color:#dc3545;"></i>
            </div>
            <div class="caller-info">
                <h2>Call Ended</h2>
                <p style="color:#999;">${message}</p>
            </div>
            <button class="back-home-btn" onclick="window.location.href='../../index.html'">
                Go Back
            </button>
        </div>
    `
    document.body.appendChild(endedScreen)
    
    setTimeout(() => {
        window.location.href = '../../index.html'
    }, 2000)
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none'
    document.getElementById('errorScreen').style.display = 'flex'
    document.getElementById('errorMessage').textContent = message
}

// Start
initCall()