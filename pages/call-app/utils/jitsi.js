// call-app/utils/jitsi.js - COMPLETE WITH AUTO-JOIN

const JAAS_APP_ID = 'vpaas-magic-cookie-16664d50d3a04e79a2876de86dcc38e4'
const JAAS_DOMAIN = '8x8.vc'

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        const fullRoomName = `${JAAS_APP_ID}/${uniqueRoomName}`
        
        console.log('🎯 Creating VOICE-FIRST room:', fullRoomName)
        
        // CONFIG THAT AUTO-JOINS!
        const config = {
            configOverwrite: {
                // AUTO-JOIN SETTINGS - THIS IS KEY!
                prejoinPageEnabled: false,           // Skip name entry
                enableWelcomePage: false,             // Skip welcome
                startWithAudioMuted: false,           // Audio on
                startWithVideoMuted: true,            // Video off by default
                
                // Audio settings
                enableNoAudioDetection: true,
                enableNoisyMicDetection: true,
                
                // Remove all distractions
                disableChat: true,
                disableInviteFunctions: true,
                disableRecording: true,
                disableLiveStreaming: true,
                disableReactions: true,
                disableRaiseHand: true,
                disableModeratorIndicator: true,
                
                // Hide ALL the things
                hideConferenceTimer: true,
                hideParticipantsStats: true,
                hideLogo: true,
                hideWatermark: true,
                hideBrandWatermark: true,
                hideHelpButton: true,
                hideShareButton: true,
                hideVideoQualityLabel: true,
                hideAddPersonButton: true,
                hideMeetingName: true,
                
                // Hide Jitsi's toolbar completely - we have our own!
                toolbarButtons: [],                    // Empty = hide all
                toolbarAlwaysVisible: false,
                
                // Prioritize audio
                startBitrate: 'audio',
                channelLastN: 1,
                
                // Disable dial-in
                dialInConfCode: { enabled: false },
                dialOutEnabled: false,
                enableDialIn: false,
                phoneEnabled: false
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: [],                   // Hide all buttons
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                DEFAULT_LOGO_URL: '',
                HIDE_INVITE_MORE_HEADER: true,
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                VIDEO_LAYOUT_FIT: 'cover',
                MOBILE_APP_PROMO: false,
                SHOW_BRAND_WATERMARK: false,
                SHOW_POWERED_BY: false,
                DISABLE_FOCUS_INDICATOR: true,
                ASPECT_RATIO: 16/9,
                VERTICAL_FILMSTRIP: false
            }
        }
        
        const configParam = encodeURIComponent(JSON.stringify(config))
        const roomUrl = `https://${JAAS_DOMAIN}/${fullRoomName}#config=${configParam}`
        
        return {
            name: fullRoomName,
            url: roomUrl,
            id: uniqueRoomName
        }
        
    } catch (error) {
        console.error('❌ Error creating room:', error)
        throw error
    }
}

export async function getRoomInfo(roomName) {
    try {
        return {
            name: roomName,
            url: `https://${JAAS_DOMAIN}/${roomName}`
        }
    } catch (error) {
        console.error('❌ Error getting room info:', error)
        throw error
    }
}

export function getCallUrl(roomUrl, username = 'User') {
    try {
        // Add username to URL - this auto-fills the name!
        return `${roomUrl}&userInfo.displayName=${encodeURIComponent(username)}`
    } catch (error) {
        return roomUrl
    }
}