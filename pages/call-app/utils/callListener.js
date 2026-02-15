// utils/callListener.js - THE WORKING VERSION

let supabase = null
let currentUser = null
let callSubscription = null
let audioPlayer = null
let notificationShowing = false

export function initCallListener(supabaseClient, user) {
    supabase = supabaseClient
    currentUser = user
    
    console.log('📞 Initializing call listener for:', user.username)
    
    setupRingtone()
    setupIncomingCallListener()
    checkForExistingCalls()
}

function setupRingtone() {
    try {
        audioPlayer = new Audio()
        audioPlayer.loop = true
        audioPlayer.volume = 0.5
        audioPlayer.src = 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAA8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PA=='
    } catch (e) {
        console.log('Ringtone setup failed:', e)
    }
}

function playRingtone() {
    if (audioPlayer) {
        audioPlayer.play().catch(e => console.log('Audio play failed:', e))
    }
}

function stopRingtone() {
    if (audioPlayer) {
        audioPlayer.pause()
        audioPlayer.currentTime = 0
    }
}

function setupIncomingCallListener() {
    if (!supabase || !currentUser) return
    
    console.log('Setting up call listener for user:', currentUser.id)
    
    callSubscription = supabase
        .channel(`calls:${currentUser.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 Incoming call detected!', payload.new)
            
            if (payload.new.status === 'ringing') {
                handleIncomingCall(payload.new)
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('Call updated:', payload.new.status)
            
            if (payload.new.status === 'cancelled' || payload.new.status === 'ended') {
                hideIncomingCallNotification()
                stopRingtone()
            }
        })
        .subscribe((status) => {
            console.log('Call listener status:', status)
        })
}

async function checkForExistingCalls() {
    try {
        const { data: calls } = await supabase
            .from('calls')
            .select('*')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'ringing')
            .order('created_at', { ascending: false })
            .limit(1)
        
        if (calls && calls.length > 0) {
            console.log('Found existing ringing call')
            handleIncomingCall(calls[0])
        }
    } catch (error) {
        console.error('Error checking existing calls:', error)
    }
}

async function handleIncomingCall(call) {
    if (window.location.pathname.includes('/call/') || window.location.pathname.includes('/call-app/')) {
        return
    }
    
    if (notificationShowing) return
    
    const caller = await getCallerInfo(call.caller_id)
    
    showIncomingCallNotification(call, caller)
    playRingtone()
    
    sessionStorage.setItem('incomingCall', JSON.stringify({
        id: call.id,
        roomName: call.room_name,
        callerId: call.caller_id,
        callerName: caller?.username || 'Unknown'
    }))
}

async function getCallerInfo(callerId) {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single()
        
        return data || { username: 'Unknown', avatar_url: null }
    } catch (error) {
        return { username: 'Unknown', avatar_url: null }
    }
}

function showIncomingCallNotification(call, caller) {
    hideIncomingCallNotification()
    notificationShowing = true
    
    const notification = document.getElementById('incomingCallNotification')
    if (!notification) {
        console.error('Notification element not found!')
        return
    }
    
    let avatarHtml = ''
    if (caller?.avatar_url) {
        avatarHtml = `<img src="${caller.avatar_url}" alt="${caller.username}">`
    } else {
        const initial = caller?.username?.charAt(0).toUpperCase() || '?'
        avatarHtml = `<div class="caller-avatar-placeholder">${initial}</div>`
    }
    
    notification.style.display = 'flex'
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
            ${avatarHtml}
            <div>
                <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 4px;">${caller?.username || 'Incoming Call'}</div>
                <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem;">🔊 Incoming voice call...</div>
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="acceptCallBtn" style="background: white; border: none; color: #28a745; width: 48px; height: 48px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <i class="fas fa-phone-alt"></i>
            </button>
            <button id="declineCallBtn" style="background: white; border: none; color: #dc3545; width: 48px; height: 48px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <i class="fas fa-phone-slash"></i>
            </button>
        </div>
    `
    
    document.getElementById('acceptCallBtn').addEventListener('click', async () => {
        console.log('Accept button clicked')
        stopRingtone()
        hideIncomingCallNotification()
        
        await supabase
            .from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', call.id)
        
        window.location.href = `/pages/call-app/call/index.html?incoming=true&room=${call.room_name}&callerId=${call.caller_id}&callId=${call.id}`
    })
    
    document.getElementById('declineCallBtn').addEventListener('click', async () => {
        console.log('Decline button clicked')
        stopRingtone()
        hideIncomingCallNotification()
        
        await supabase
            .from('calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', call.id)
        
        sessionStorage.removeItem('incomingCall')
    })
}

function hideIncomingCallNotification() {
    notificationShowing = false
    const notification = document.getElementById('incomingCallNotification')
    if (notification) {
        notification.style.display = 'none'
        notification.innerHTML = ''
    }
}

export function cleanupCallListener() {
    stopRingtone()
    if (callSubscription) {
        callSubscription.unsubscribe()
    }
    hideIncomingCallNotification()
}
