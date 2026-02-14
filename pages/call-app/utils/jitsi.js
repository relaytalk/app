// pages/call-app/utils/jitsi.js - UPDATED with cleaner UI

export async function createCallRoom(roomName = null) {
    try {
        // Generate a unique room name
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        console.log('🎯 Creating Jitsi room:', uniqueRoomName);
        
        // Jitsi configuration for voice-only, clean UI
        const jitsiConfig = '#config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.disableChat=true' +
            '&config.disableInviteFunctions=true' +
            '&config.enableClosePage=false' +
            '&config.disableProfile=true' +
            '&config.disableAudioLevel=false' +
            '&config.disableVideoQualityLabel=true' +
            '&config.disableRecording=true' +
            '&config.hideConferenceTimer=true' +
            '&config.hideParticipantsStats=true' +
            '&config.hideSubject=true' +
            '&config.disableTileView=true' +
            '&config.disableFilmstripAutoHide=false' +
            '&config.toolbarButtons=["microphone","camera","hangup"]' +
            '&config.buttonsWithNotifyClick=["hangup"]';
        
        return {
            name: uniqueRoomName,
            url: `https://meet.jit.si/${uniqueRoomName}${jitsiConfig}`,
            id: uniqueRoomName
        };
        
    } catch (error) {
        console.error('❌ Error creating Jitsi room:', error);
        throw error;
    }
}

export async function getRoomInfo(roomName) {
    try {
        console.log('🔍 Getting Jitsi room info for:', roomName);
        
        const jitsiConfig = '#config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.disableChat=true' +
            '&config.disableInviteFunctions=true' +
            '&config.enableClosePage=false' +
            '&config.disableProfile=true' +
            '&config.disableAudioLevel=false' +
            '&config.disableVideoQualityLabel=true' +
            '&config.disableRecording=true' +
            '&config.hideConferenceTimer=true' +
            '&config.hideParticipantsStats=true' +
            '&config.hideSubject=true' +
            '&config.disableTileView=true' +
            '&config.disableFilmstripAutoHide=false' +
            '&config.toolbarButtons=["microphone","camera","hangup"]' +
            '&config.buttonsWithNotifyClick=["hangup"]';
        
        return {
            name: roomName,
            url: `https://meet.jit.si/${roomName}${jitsiConfig}`
        };
        
    } catch (error) {
        console.error('❌ Error getting room info:', error);
        throw error;
    }
}

export function getCallUrl(roomUrl, username = 'User') {
    try {
        // Add username properly encoded
        return `${roomUrl}&userInfo.displayName=${encodeURIComponent(username)}`;
    } catch (error) {
        return roomUrl;
    }
}