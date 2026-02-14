// pages/call-app/utils/daily.js

const DAILY_API_KEY = '909b11ef9f9f9ca6d21f995698e0ce3ce5ce05f589c12b0fe6664bba974f69'
const DAILY_API_URL = 'https://api.daily.co/v1'

export async function createCallRoom(roomName = null) {
    try {
        const uniqueRoomName = roomName || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        
        console.log('Creating Daily.co room:', uniqueRoomName)
        
        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
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
            })
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('Daily.co API error:', error)
            throw new Error(`Failed to create room: ${error}`)
        }

        const room = await response.json()
        console.log('✅ Room created:', room)
        
        return {
            name: room.name,
            url: room.url,
            id: room.id
        }
        
    } catch (error) {
        console.error('Error creating room:', error)
        throw error
    }
}

export async function getRoomInfo(roomName) {
    try {
        const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        })

        if (!response.ok) {
            throw new Error('Room not found')
        }

        return await response.json()
        
    } catch (error) {
        console.error('Error getting room info:', error)
        throw error
    }
}

export function getCallUrl(roomUrl, username = 'User') {
    const url = new URL(roomUrl)
    url.searchParams.set('dn', username)
    url.searchParams.set('video', '0')
    url.searchParams.set('audio', '1')
    url.searchParams.set('chrome', '0')
    url.searchParams.set('embed', '1')
    return url.toString()
}