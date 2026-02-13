// utils/daily.js - Daily.co API Helper - RelayTalk
const DAILY_API_KEY = '909b11ef9f9f9ca6d21f995698e0ce3ce5ce05fde589c12b0fe6664bba974f69';
const DAILY_API_URL = 'https://api.daily.co/v1';

// Create a private room for 1-on-1 call
async function createCallRoom() {
    try {
        console.log('📞 Creating Daily.co room...');
        
        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: `relay-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                privacy: 'private',
                properties: {
                    max_participants: 2,
                    enable_chat: false,
                    enable_screenshare: false,
                    start_video_off: true,
                    start_audio_off: false,
                    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Daily.co API error:', response.status, errorText);
            throw new Error(`Daily.co API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Room created successfully:', data.url);
        
        return {
            success: true,
            url: data.url,
            name: data.name
        };
    } catch (error) {
        console.error('❌ Daily room creation failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Validate room still exists
async function validateRoom(roomName) {
    try {
        const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });
        return response.ok;
    } catch {
        return false;
    }
}

export { createCallRoom, validateRoom };