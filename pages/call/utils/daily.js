// pages/call-app/utils/daily.js

const DAILY_API_KEY = '1c5745786e9656a252444e587670d2ceec086aba600f90d5062f7335f5cd73b6';
const DAILY_API_URL = 'https://api.daily.co/v1';

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        console.log('🎯 Creating Daily.co room:', uniqueRoomName);
        
        const requestBody = {
            name: uniqueRoomName,
            privacy: 'private',
            properties: {
                exp: Math.floor(Date.now() / 1000) + 3600,
                enable_chat: false,
                enable_screenshare: false,
                start_video_off: true,
                start_audio_off: false,
                max_participants: 2,
                autojoin: true
            }
        };
        
        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        console.log('📡 Response status:', response.status);
        console.log('📋 Response body:', responseText);

        if (!response.ok) {
            throw new Error(`Daily.co error (${response.status}): ${responseText}`);
        }

        const room = JSON.parse(responseText);
        console.log('✅ Room created successfully:', room);
        
        return {
            name: room.name,
            url: room.url,
            id: room.id
        };
        
    } catch (error) {
        console.error('❌ Error in createCallRoom:', error);
        throw error;
    }
}

export async function getRoomInfo(roomName) {
    try {
        console.log('🔍 Getting room info for:', roomName);
        
        const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });

        const responseText = await response.text();
        
        if (!response.ok) {
            throw new Error(`Failed to get room: ${response.status} - ${responseText}`);
        }

        return JSON.parse(responseText);
        
    } catch (error) {
        console.error('❌ Error getting room info:', error);
        throw error;
    }
}

export function getCallUrl(roomUrl, username = 'User') {
    try {
        const url = new URL(roomUrl);
        url.searchParams.set('dn', username);
        url.searchParams.set('video', '0');
        url.searchParams.set('audio', '1');
        url.searchParams.set('chrome', '0');
        url.searchParams.set('embed', '1');
        return url.toString();
    } catch (error) {
        console.error('❌ Error creating call URL:', error);
        return roomUrl;
    }
}
