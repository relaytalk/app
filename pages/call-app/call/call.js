// pages/call-app/call/call.js - COMPLETE WITH JITSI

import { initializeSupabase } from '../utils/supabase.js'
import { createCallRoom, getRoomInfo, getCallUrl } from '../utils/jitsi.js'
import { getRelayTalkUser, syncUserToDatabase } from '../utils/userSync.js'

let supabase
let currentUser
let currentCall
let jitsiIframe
let callRoom

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
        
        if (error) throw new Error('Database error: ' + error.message)
        
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
    supabase
        .channel(`call-${callId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${callId}`
        }, (payload) => {
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
        document.getElementById('outgoingUI')?.remove()
        document.getElementById('loadingScreen').style.display = 'flex'
        document.getElementById('loadingText').textContent = 'Connecting...'
        
        const roomInfo = await getRoomInfo(roomName)
        
        const container = document.getElementById('dailyContainer')
        container.innerHTML = ''
        
        const iframe = document.createElement('iframe')
        iframe.allow = 'microphone; camera; autoplay'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.style.background = '#000'
        
        const url = getCallUrl(roomInfo.url, currentUser.username)
        iframe.src = url
        
        container.appendChild(iframe)
        jitsiIframe = iframe
        
        document.getElementById('loadingScreen').style.display = 'none'
        document.getElementById('activeCallScreen').style.display = 'block'
        
        // Auto-hide toolbar after 3 seconds
        setTimeout(() => {
            try {
                iframe.contentWindow.postMessage({
                    type: 'toolbarVisible',
                    visible: false
                }, '*');
            } catch (e) {}
        }, 3000)
        
    } catch (error) {
        console.error('❌ Join error:', error)
        showError('Failed to join call: ' + error.message)
    }
}

window.toggleMute = function() {
    const btn = document.getElementById('muteBtn')
    btn.classList.toggle('muted')
    btn.innerHTML = btn.classList.contains('muted') 
        ? '<i class="fas fa-microphone-slash"></i>' 
        : '<i class="fas fa-microphone"></i>'
}

window.toggleSpeaker = function() {
    const btn = document.getElementById('speakerBtn')
    btn.classList.toggle('speaker-off')
    btn.innerHTML = btn.classList.contains('speaker-off')
        ? '<i class="fas fa-volume-mute"></i>'
        : '<i class="fas fa-volume-up"></i>'
}

window.endCall = async function() {
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.location.href = '../index.html'
}

window.cancelCall = async function() {
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'cancelled', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.location.href = '../index.html'
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
                <p style="color:#ccc;">${message}</p>
            </div>
            <button onclick="window.location.href='../index.html'" style="background: #f5b342; color: #333; border: none; padding: 12px 24px; border-radius: 25px; margin-top: 20px; cursor: pointer;">
                Go Back
            </button>
        </div>
    `
    document.body.appendChild(endedScreen)
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none'
    document.getElementById('errorScreen').style.display = 'flex'
    document.getElementById('errorMessage').textContent = message
}

initCall()