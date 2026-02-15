// call/utils/jitsi.js - Jitsi configuration for RelayTalk

const JAAS_APP_ID = 'vpaas-magic-cookie-16664d50d3a04e79a2876de86dcc38e4'
const JAAS_DOMAIN = '8x8.vc'

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `RelayTalk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        const fullRoomName = `${JAAS_APP_ID}/${uniqueRoomName}`

        // Jitsi config
        const config = {
            configOverwrite: {
                prejoinPageEnabled: false,
                enableWelcomePage: false,
                startWithAudioMuted: false,
                startWithVideoMuted: true,
                disableChat: false,
                disableInviteFunctions: true,
                toolbarButtons: ['microphone', 'camera', 'hangup', 'chat', 'raisehand']
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'chat', 'raisehand', 'tileview'],
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                VIDEO_LAYOUT_FIT: 'cover'
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
        console.error('❌ Error creating Jitsi room:', error)
        throw error
    }
}

export async function getRoomInfo(roomName) {
    return {
        name: roomName,
        url: `https://${JAAS_DOMAIN}/${roomName}`
    }
}

export function getCallUrl(roomUrl, username = 'User') {
    return `${roomUrl}&userInfo.displayName=${encodeURIComponent(username)}`
}
