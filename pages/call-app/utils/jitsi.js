// pages/call-app/utils/jitsi.js - NOW WITH JAAS!

const JAAS_APP_ID = 'vpaas-magic-cookie-16664d50d3a04e79a2876de86dcc38e4';
const JAAS_DOMAIN = '8x8.vc';

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        // JAAS format
        const fullRoomName = `${JAAS_APP_ID}/${uniqueRoomName}`;
        
        console.log('🎯 Creating JAAS room:', fullRoomName);
        
        // Perfect configuration - everything hidden!
        const config = {
            configOverwrite: {
                startWithAudioMuted: false,      // Audio ON immediately
                startWithVideoMuted: true,       // Video OFF
                prejoinPageEnabled: false,       // NO welcome page
                enableWelcomePage: false,        // NO welcome page
                disableChat: true,                // NO chat
                disableInviteFunctions: true,     // NO invite
                disableRecording: true,           // NO recording
                hideConferenceTimer: true,        // NO timer
                hideParticipantsStats: true,      // NO stats
                hideLogo: true,                    // NO logo
                hideWatermark: true,               // NO watermark
                toolbarButtons: ['microphone', 'camera', 'hangup'], // Only 3 buttons
                disableModeratorIndicator: true,   // NO moderator messages
                disableReactions: true,            // NO reactions
                disableRaiseHand: true             // NO raise hand
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup'],
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                DEFAULT_LOGO_URL: '',
                HIDE_INVITE_MORE_HEADER: true,
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
            }
        };
        
        const configParam = encodeURIComponent(JSON.stringify(config));
        const roomUrl = `https://${JAAS_DOMAIN}/${fullRoomName}#config=${configParam}`;
        
        return {
            name: fullRoomName,
            url: roomUrl,
            id: uniqueRoomName
        };
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        throw error;
    }
}

export async function getRoomInfo(roomName) {
    try {
        return {
            name: roomName,
            url: `https://${JAAS_DOMAIN}/${roomName}`
        };
    } catch (error) {
        console.error('❌ Error getting room info:', error);
        throw error;
    }
}

export function getCallUrl(roomUrl, username = 'User') {
    try {
        // Add username to existing URL with config
        const config = {
            userInfo: {
                displayName: username
            }
        };
        
        // Check if URL already has config
        if (roomUrl.includes('#config=')) {
            return `${roomUrl}&userInfo.displayName=${encodeURIComponent(username)}`;
        } else {
            const configParam = encodeURIComponent(JSON.stringify(config));
            return `${roomUrl}#config=${configParam}`;
        }
        
    } catch (error) {
        return roomUrl;
    }
}