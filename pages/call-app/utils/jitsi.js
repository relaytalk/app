// pages/call-app/utils/jitsi.js - FINAL FIX (NO PHONE NUMBERS!)

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `CallApp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        console.log('🎯 Creating Jitsi room:', uniqueRoomName);
        
        // COMPLETE CONFIG - NO PHONE, NO MODERATOR MESSAGES
        const jitsiConfig = '#' +
            // DISABLE EVERYTHING ANNOYING
            'config.dialInConfCode.enabled=false' +
            '&config.dialInNumbersUrl=""' +
            '&config.dialOutAuthUrl=""' +
            '&config.dialOutEnabled=false' +
            '&config.enableDialIn=false' +
            
            // DISABLE MODERATOR MESSAGES
            '&config.disableModeratorIndicator=true' +
            '&config.hideModeratorMessage=true' +
            
            // AUTO-JOIN (YOUR FIX)
            '&config.prejoinPageEnabled=false' +
            '&config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.enableWelcomePage=false' +
            
            // HIDE EVERYTHING
            '&config.disableChat=true' +
            '&config.disableInviteFunctions=true' +
            '&config.disableRecording=true' +
            '&config.hideConferenceTimer=true' +
            '&config.hideParticipantsStats=true' +
            '&config.hideLogo=true' +
            '&config.hideWatermark=true' +
            '&config.hideBrandWatermark=true' +
            
            // ONLY 3 BUTTONS
            '&config.toolbarButtons=["microphone","camera","hangup"]' +
            '&config.toolbarAlwaysVisible=true';
        
        return {
            name: uniqueRoomName,
            url: `https://meet.jit.si/${uniqueRoomName}${jitsiConfig}`,
            id: uniqueRoomName
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

export async function getRoomInfo(roomName) {
    try {
        const jitsiConfig = '#' +
            'config.dialInConfCode.enabled=false' +
            '&config.dialOutEnabled=false' +
            '&config.enableDialIn=false' +
            '&config.disableModeratorIndicator=true' +
            '&config.prejoinPageEnabled=false' +
            '&config.startWithAudioMuted=false' +
            '&config.startWithVideoMuted=true' +
            '&config.enableWelcomePage=false' +
            '&config.toolbarButtons=["microphone","camera","hangup"]';
        
        return {
            name: roomName,
            url: `https://meet.jit.si/${roomName}${jitsiConfig}`
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
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