// pages/call-app/utils/jitsi.js - VOICE-FIRST JAAS INTEGRATION

const JAAS_APP_ID = 'vpaas-magic-cookie-16664d50d3a04e79a2876de86dcc38e4';
const JAAS_DOMAIN = '8x8.vc';

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const fullRoomName = `${JAAS_APP_ID}/${uniqueRoomName}`;
        
        console.log('🎯 Creating VOICE-FIRST room:', fullRoomName);
        
        // PERFECT CONFIGURATION - Voice first, clean UI
        const config = {
            configOverwrite: {
                // Audio first!
                startWithAudioMuted: false,
                startWithVideoMuted: true,
                enableNoAudioDetection: true,
                enableNoisyMicDetection: true,
                
                // Skip all join screens
                prejoinPageEnabled: false,
                enableWelcomePage: false,
                
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
                
                // Minimal toolbar - ONLY mic and hangup!
                toolbarButtons: ['microphone', 'hangup'],
                toolbarAlwaysVisible: false,
                toolbarAutoHide: true,
                
                // Prioritize audio quality
                startBitrate: 'audio',
                channelLastN: 1,
                
                // Make video fit properly if turned on
                disableVideoQualityLabel: true,
                enableLayerSuspension: true,
                disableFilmstripAutoHide: false,
                
                // Disable dial-in completely
                dialInConfCode: { enabled: false },
                dialOutEnabled: false,
                enableDialIn: false,
                phoneEnabled: false
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: ['microphone', 'hangup'],
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                DEFAULT_LOGO_URL: '',
                HIDE_INVITE_MORE_HEADER: true,
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                VIDEO_LAYOUT_FIT: 'cover',  // This makes video fit properly
                
                // Hide all extra UI
                MOBILE_APP_PROMO: false,
                SHOW_BRAND_WATERMARK: false,
                SHOW_POWERED_BY: false,
                DISABLE_FOCUS_INDICATOR: true,
                
                // Video settings
                ASPECT_RATIO: 16/9,
                VERTICAL_FILMSTRIP: false
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
        const config = {
            userInfo: {
                displayName: username
            }
        };
        
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