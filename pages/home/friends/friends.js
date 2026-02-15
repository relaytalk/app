import { initializeSupabase } from '../../../utils/supabase.js'
import { initCallListener } from '../../call/utils/callListener.js'

let supabase
let currentUser
let friends = []

async function initFriendsPage() {
    showLoading(true, 'Loading friends...')

    try {
        const user = getRelayTalkUser()
        if (!user) {
            showError('Please login to RelayTalk first')
            return
        }

        console.log('✅ Got user from RelayTalk:', user.email)
        console.log('✅ User ID:', user.id)

        supabase = await initializeSupabase()
        currentUser = await syncUserToDatabase(supabase, user)
        console.log('✅ User synced to CallApp DB')

        showLoading(true, 'Loading friends...')
        friends = await getFriends()

        showLoading(false)

        // Initialize call listener - EXACTLY like call-app
        initCallListener(supabase, currentUser)

        loadFriendsList()

    } catch (error) {
        console.error('❌ Init error:', error)
        showError('Failed to initialize: ' + error.message)
    }
}

function getRelayTalkUser() {
    try {
        const possibleKeys = [
            'supabase.auth.token',
            'sb-auth-token',
            'sb-refresh-token'
        ]

        let authData = null
        for (const key of possibleKeys) {
            const data = localStorage.getItem(key)
            if (data) {
                authData = data
                console.log(`✅ Found auth in: ${key}`)
                break
            }
        }

        if (!authData) {
            console.log('No auth data found')
            return null
        }

        const parsed = JSON.parse(authData)
        let session = null

        if (parsed.currentSession) {
            session = parsed.currentSession
        } else if (parsed.user) {
            session = parsed
        } else if (parsed.access_token) {
            session = { user: parsed.user || parsed }
        } else if (Array.isArray(parsed) && parsed[0]?.user) {
            session = parsed[0]
        }

        if (!session?.user) return null

        const user = session.user

        return {
            id: user.id,
            email: user.email || '',
            username: user.user_metadata?.username || 
                     user.email?.split('@')[0] || 
                     'User',
            avatar_url: user.user_metadata?.avatar_url || null
        }

    } catch (e) {
        console.error('Error getting user:', e)
        return null
    }
}

async function syncUserToDatabase(supabase, user) {
    try {
        console.log('🔄 Syncing user to CallApp DB:', user.email)

        const { data: existing, error: checkError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()

        if (checkError) throw checkError

        if (existing) {
            const { data: updated, error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    status: 'online',
                    last_seen: new Date().toISOString(),
                    username: existing.username || user.username,
                    email: user.email,
                    avatar_url: user.avatar_url || existing.avatar_url
                })
                .eq('id', user.id)
                .select()
                .single()

            if (updateError) throw updateError
            return updated || existing
        }

        const newUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
            status: 'online',
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString()
        }

        const { data: created, error: insertError } = await supabase
            .from('profiles')
            .insert([newUser])
            .select()
            .single()

        if (insertError) throw insertError

        console.log('✅ User created in CallApp DB')
        return created

    } catch (error) {
        console.error('❌ Sync failed:', error)
        throw error
    }
}

async function getFriends() {
    try {
        const { data: friendships } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id)

        if (!friendships || friendships.length === 0) {
            return []
        }

        const friendIds = friendships.map(f => f.friend_id)

        const { data: friends } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, status, last_seen')
            .in('id', friendIds)
            .order('username')

        return friends || []

    } catch (error) {
        console.error('Error getting friends:', error)
        return []
    }
}

function loadFriendsList() {
    const onlineFriends = friends.filter(f => f.status === 'online').length

    document.getElementById('mainContent').innerHTML = `
        <div class="friends-container">
            <div class="search-box">
                <i class="fas fa-search" style="color: #007acc;"></i>
                <input type="text" id="friendSearch" placeholder="Search friends..." oninput="searchFriends()" style="border-color: #007acc;">
            </div>
            <div id="friendsList" class="friends-list">
                ${renderFriendsList()}
            </div>
        </div>
    `
}

function renderFriendsList() {
    if (!friends || friends.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-users" style="color: #007acc; font-size: 48px;"></i>
                <h3 style="margin: 16px 0 8px;">No friends yet</h3>
                <p style="color: #666; margin-bottom: 20px;">Add friends in RelayTalk and they'll appear here</p>
                <button onclick="window.location.href='/'" class="primary-btn" style="background: #007acc; color: white;">
                    Go to RelayTalk
                </button>
            </div>
        `
    }

    let html = ''
    friends.forEach(friend => {
        const online = friend.status === 'online'
        const lastSeen = friend.last_seen ? formatLastSeen(friend.last_seen) : 'Offline'

        html += `
            <div class="friend-item" style="border-color: #007acc;">
                <div class="friend-avatar" style="background: #007acc;">
                    ${friend.avatar_url 
                        ? `<img src="${friend.avatar_url}" alt="${friend.username}">`
                        : `<span>${friend.username.charAt(0).toUpperCase()}</span>`
                    }
                    <span class="status-indicator ${online ? 'online' : 'offline'}"></span>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.username}</div>
                    <div class="friend-status-text">${online ? 'Online' : lastSeen}</div>
                </div>
                <button class="call-btn" style="background: #007acc;" onclick="startCall('${friend.id}', '${friend.username}')">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
        `
    })

    return html
}

window.searchFriends = function() {
    const term = document.getElementById('friendSearch').value.toLowerCase()

    if (!term) {
        document.getElementById('friendsList').innerHTML = renderFriendsList()
        return
    }

    const filtered = friends.filter(f => 
        f.username.toLowerCase().includes(term)
    )

    document.getElementById('friendsList').innerHTML = renderFriendsList(filtered)
}

window.startCall = function(friendId, friendName) {
    window.open(`../../call/index.html?friendId=${friendId}&friendName=${encodeURIComponent(friendName)}`, '_blank')
}

function formatLastSeen(timestamp) {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = Math.floor((now - time) / 60000)

    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return time.toLocaleDateString()
}

function showLoading(show, text) {
    const loader = document.getElementById('loadingIndicator')
    if (loader) {
        loader.style.display = show ? 'flex' : 'none'
        if (text) document.getElementById('loadingText').textContent = text
    }
}

function showError(message) {
    showLoading(false)
    document.getElementById('mainContent').innerHTML = `
        <div class="error-container">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <a href="/" class="primary-btn">Go to RelayTalk</a>
        </div>
    `
}

// Start the app
initFriendsPage()
