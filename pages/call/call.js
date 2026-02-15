// /call/call.js - COMPLETE DEBUG VERSION

import { initializeSupabase } from './utils/supabase.js'
import { getRelayTalkUser, syncUserToDatabase } from './utils/userSync.js'

let supabase
let currentUser
let currentCall
let jitsiIframe
let callRoom
let conferenceStarted = false
let callTabClosed = false

const JAAS_APP_ID = 'vpaas-magic-cookie-16664d50d3a04e79a2876de86dcc38e4'
const JAAS_DOMAIN = '8x8.vc'

async function initCall() {
    console.log('📞 Initializing call...')

    try {
        const relayUser = getRelayTalkUser()
        if (!relayUser) {
            showError('Please login to RelayTalk first')
            return
        }

        console.log('✅ Got user:', relayUser.email)
        console.log('✅ User ID:', relayUser.id)

        supabase = await initializeSupabase()
        currentUser = await syncUserToDatabase(supabase, relayUser)

        const params = new URLSearchParams(window.location.search)
        const friendId = params.get('friendId')
        const friendName = params.get('friendName')
        const incoming = params.get('incoming')
        const roomName = params.get('room')
        const callerId = params.get('callerId')
        const callId = params.get('callId')

        console.log('📞 Call params:', { 
            friendId, 
            friendName, 
            incoming, 
            roomName, 
            callerId, 
            callId,
            currentUserId: currentUser.id
        })

        if (incoming === 'true' && roomName && callerId && callId) {
            // For incoming calls, first update the call status
            console.log('📞 Handling incoming call...')
            currentCall = { id: callId, room_name: roomName }
            
            // Update call status to active
            const { error } = await supabase
                .from('calls')
                .update({ status: 'active', answered_at: new Date().toISOString() })
                .eq('id', callId)
            
            if (error) {
                console.log('❌ Error updating call status:', error)
            } else {
                console.log('✅ Call status updated to active')
            }
            
            await joinCall(roomName)
        } else if (friendId) {
            console.log('📞 Starting outgoing call to:', friendId, friendName)
            await startOutgoingCall(friendId, friendName)
        } else {
            showError('No call information provided')
        }

    } catch (error) {
        console.error('❌ Init error:', error)
        showError('Failed to initialize call')
    }
}

async function createCallRoom() {
    try {
        const uniqueRoomName = `RelayTalk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        const fullRoomName = `${JAAS_APP_ID}/${uniqueRoomName}`

        console.log('🎯 Creating room:', fullRoomName)

        return {
            name: fullRoomName,
            url: `https://${JAAS_DOMAIN}/${fullRoomName}`,
            id: uniqueRoomName
        }

    } catch (error) {
        console.error('❌ Error creating room:', error)
        throw error
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

        console.log('3️⃣ Call data to insert:', callData)

        const { data: call, error } = await supabase
            .from('calls')
            .insert([callData])
            .select()
            .single()

        if (error) {
            console.error('❌ Supabase error:', error)
            throw new Error('Database error: ' + error.message)
        }

        console.log('4️⃣ ✅ Call inserted successfully!')
        console.log('4️⃣ ✅ Call object:', call)
        
        // DEBUG: Verify the call was inserted correctly
        console.log('🔍 Verifying call in database...')
        setTimeout(async () => {
            const { data: verifyCall, error: verifyError } = await supabase
                .from('calls')
                .select('*')
                .eq('id', call.id)
                .single()
            
            if (verifyError) {
                console.log('❌ Verification failed:', verifyError)
            } else {
                console.log('✅ Verification successful - call exists in DB:', {
                    id: verifyCall.id,
                    status: verifyCall.status,
                    caller: verifyCall.caller_id,
                    receiver: verifyCall.receiver_id,
                    created: verifyCall.created_at
                })
                
                // Check if receiver matches
                if (verifyCall.receiver_id === friendId) {
                    console.log('✅ Receiver ID matches:', friendId)
                } else {
                    console.log('❌ Receiver ID mismatch! Expected:', friendId, 'Got:', verifyCall.receiver_id)
                }
            }
        }, 2000)

        currentCall = call
        document.getElementById('loadingText').textContent = `Waiting for ${friendName} to answer...`
        setupCallListener(call.id)

    } catch (error) {
        console.error('❌ Call error:', error)
        showError('Failed to start call: ' + error.message)
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

            if (payload.new.status === 'active' && !conferenceStarted) {
                console.log('✅ Call was answered! Joining...')
                joinCall(payload.new.room_name)
            } else if (payload.new.status === 'ended' || payload.new.status === 'rejected' || payload.new.status === 'cancelled') {
                console.log('❌ Call ended or rejected')
                showCallEndedAndClose()
            }
        })
        .subscribe((status) => {
            console.log('Call listener subscription status:', status)
        })
}

async function joinCall(roomName) {
    try {
        console.log('6️⃣ Joining Jitsi call room:', roomName)
        conferenceStarted = true

        document.getElementById('loadingScreen').style.display = 'flex'
        document.getElementById('loadingText').textContent = 'Connecting...'

        const container = document.getElementById('jitsiContainer')
        container.innerHTML = ''

        const iframe = document.createElement('iframe')
        iframe.allow = 'microphone; camera; autoplay; display-capture'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.style.background = '#000'

        // Jitsi config
        const config = {
            configOverwrite: {
                prejoinPageEnabled: false,
                enableWelcomePage: false,
                startWithAudioMuted: false,
                startWithVideoMuted: true,
                disableChat: false,
                disableInviteFunctions: false,
                toolbarButtons: ['microphone', 'camera', 'hangup', 'chat', 'raisehand'],
                hideConferenceTimer: false,
                hideParticipantsStats: false,
                hideLogo: false,
                hideWatermark: false
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'chat', 'raisehand', 'tileview'],
                SHOW_JITSI_WATERMARK: true,
                SHOW_WATERMARK_FOR_GUESTS: true,
                VIDEO_LAYOUT_FIT: 'cover'
            },
            userInfo: {
                displayName: currentUser.username
            }
        }

        const configParam = encodeURIComponent(JSON.stringify(config))
        const baseUrl = `https://${JAAS_DOMAIN}/${roomName}`
        const url = `${baseUrl}#config=${configParam}`
        iframe.src = url
        console.log('8️⃣ Iframe URL:', url)

        container.appendChild(iframe)
        jitsiIframe = iframe

        // Listen for Jitsi events
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'video-conference-left') {
                console.log('📞 User left conference')
                endCallAndClose()
            }
        })

        // Hide loading after delay
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none'
        }, 3000)

        console.log('✅ Jitsi call connected!')

    } catch (error) {
        console.error('❌ Join error:', error)
        showError('Failed to join call: ' + error.message)
    }
}

// End call and close tab
async function endCallAndClose() {
    if (callTabClosed) return;
    callTabClosed = true;
    
    console.log('Ending call and closing tab...')
    if (currentCall) {
        const { error } = await supabase
            .from('calls')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
        
        if (error) {
            console.log('❌ Error updating call status:', error)
        } else {
            console.log('✅ Call status updated to ended')
        }
    }
    
    showCallEndedAndClose()
}

// Show ended screen then close
function showCallEndedAndClose() {
    // Hide all screens
    document.getElementById('loadingScreen').style.display = 'none'
    document.getElementById('errorScreen').style.display = 'none'
    document.getElementById('incomingCallScreen').style.display = 'none'
    
    // Show ended screen
    document.getElementById('callEndedScreen').style.display = 'flex'
    
    // Auto close after 3 seconds
    setTimeout(() => {
        console.log('🔚 Closing tab...')
        window.close()
        // Fallback
        setTimeout(() => {
            window.location.href = '../home/'
        }, 100)
    }, 3000)
}

// Handle Jitsi's hangup button
window.endCall = endCallAndClose

window.cancelCall = async function() {
    console.log('📞 Cancelling call...')
    if (currentCall) {
        await supabase
            .from('calls')
            .update({ status: 'cancelled', ended_at: new Date().toISOString() })
            .eq('id', currentCall.id)
    }
    window.close()
}

function showError(message) {
    console.log('❌ Error:', message)
    document.getElementById('loadingScreen').style.display = 'none'
    document.getElementById('errorScreen').style.display = 'flex'
    document.getElementById('errorMessage').textContent = message
}

// Initialize
console.log('🚀 Call page starting...')
initCall()
