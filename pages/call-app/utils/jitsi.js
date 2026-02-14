// pages/call-app/utils/jitsi.js - COMPLETE FIXED VERSION

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        console.log('🎯 Creating Jitsi room:', uniqueRoomName);
        
        // PERFECT CONFIGURATION - Auto-joins, audio works, no distractions
        const jitsiConfig = '#' +
            // CRITICAL: Skip welcome page and auto-join
            'config.prejoinPageEnabled=false' +
            '&config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.enableWelcomePage=false' +
            
            // Essential permissions
            '&config.disableAudioLevel=false' +
            '&config.enableNoAudioDetection=true' +
            '&config.enableNoisyMicDetection=true' +
            
            // Show ONLY essential controls
            '&config.toolbarButtons=["microphone","camera","hangup"]' +
            '&config.toolbarAlwaysVisible=true' +
            
            // Hide distractions
            '&config.disableChat=true' +
            '&config.disableInviteFunctions=true' +
            '&config.disableRecording=true' +
            '&config.hideConferenceTimer=true' +
            '&config.hideParticipantsStats=true' +
            '&config.hideLogo=true' +
            '&config.hideWatermark=true' +
            '&config.hideBrandWatermark=true' +
            
            // Audio optimization
            '&config.channelLastN=2' +
            '&config.startBitrate=200';
        
        return {
            name: uniqueRoomName,
            url: `https://meet.jit.si/${uniqueRoomName}${jitsiConfig}`,
            id: uniqueRoomName
        };
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        throw error;
    }
}

export async function getRoomInfo(roomName) {
    try {
        const jitsiConfig = '#' +
            'config.prejoinPageEnabled=false' +
            '&config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.enableWelcomePage=false' +
            '&config.toolbarButtons=["microphone","camera","hangup"]' +
            '&config.disableChat=true' +
            '&config.disableInviteFunctions=true';
        
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
        return `${roomUrl}&userInfo.displayName=${encodeURIComponent(username)}`;
    } catch (error) {
        return roomUrl;
    }
}