// friends.js - WITH AVATAR SUPPORT + CALL FEATURE

import { initializeSupabase, supabase as supabaseClient } from '../../../utils/supabase.js';
import { createCallRoom } from '../../../utils/daily.js';  // ✅ ADD THIS

let supabase = null;
let currentUser = null;
let allFriends = [];
let filteredFriends = [];

// Initialize with Supabase wait
async function initFriendsPage() {
    console.log('Loading friends...');

    try {
        supabase = await initializeSupabase();

        if (!supabase || !supabase.auth) {
            throw new Error('Supabase not initialized');
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session) {
            window.location.href = '../../../pages/login/index.html';
            return;
        }

        currentUser = session.user;
        console.log('✅ Logged in as:', currentUser.email);

        await loadFriends();

        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.classList.add('hidden');

    } catch (error) {
        console.error('Init error:', error);
        showError('Failed to load friends: ' + error.message);
    }
}

// Load friends WITH AVATAR URL
async function loadFriends() {
    try {
        if (!currentUser || !supabase) return;

        const { data: friendsData, error: friendsError } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        if (friendsError) throw friendsError;

        if (!friendsData || friendsData.length === 0) {
            showEmptyState();
            return;
        }

        const friendIds = friendsData.map(f => f.friend_id);

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, status, last_seen')
            .in('id', friendIds)
            .order('username');

        if (profilesError) throw profilesError;

        allFriends = profiles || [];
        filteredFriends = [...allFriends];
        renderFriendsList();

    } catch (error) {
        console.error('Load error:', error);
        showEmptyState();
    }
}

// 🔥 UPDATED: Render friends list WITH AVATAR URL AND CALL BUTTON
function renderFriendsList() {
    const container = document.getElementById('friendsList');
    if (!container) return;

    if (!filteredFriends || filteredFriends.length === 0) {
        showEmptyState();
        return;
    }

    let html = '';

    filteredFriends.forEach(friend => {
        const initial = friend.username ? friend.username.charAt(0).toUpperCase() : '?';
        const online = friend.status === 'online';
        const lastSeen = friend.last_seen ? formatLastSeen(friend.last_seen) : 'Never';

        html += `
            <div class="friend-item" style="display: flex; align-items: center; gap: 15px; padding: 15px; background: white; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
                
                <!-- Avatar (click to chat) -->
                <div class="friend-avatar" onclick="openChat('${friend.id}', '${friend.username}')" style="cursor: pointer; width: 55px; height: 55px; background: linear-gradient(45deg, #007acc, #00b4d8); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 600; color: white; position: relative;">
                    ${friend.avatar_url 
                        ? `<img src="${friend.avatar_url}" alt="${friend.username}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                        : `<span style="color:white; font-size:1.3rem; font-weight:600;">${initial}</span>`
                    }
                    <span style="position: absolute; bottom: 5px; right: 5px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; ${online ? 'background: #28a745;' : 'background: #888888;'}"></span>
                </div>
                
                <!-- Friend Info (click to chat) -->
                <div onclick="openChat('${friend.id}', '${friend.username}')" style="flex: 1; cursor: pointer;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 5px;">${friend.username || 'User'}</div>
                    <div style="font-size: 0.85rem; color: #64748b;">
                        ${online ? 'Online' : `Last seen ${lastSeen}`}
                    </div>
                </div>
                
                <!-- ✅ NEW: Call Button -->
                <button class="call-friend-btn" onclick="startCall('${friend.id}', '${friend.username}')" style="background: #28a745; border: none; color: white; width: 45px; height: 45px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3); transition: all 0.2s;">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ✅ NEW: Start a call
window.startCall = async function(friendId, friendName) {
    try {
        console.log('📞 Calling:', friendName);
        
        // Show loading toast
        showToast('info', `Calling ${friendName}...`);

        // 1. Create Daily.co room
        const roomResult = await createCallRoom();
        
        if (!roomResult.success) {
            showToast('error', 'Failed to create call');
            return;
        }

        console.log('✅ Room created:', roomResult.url);

        // 2. Save to Supabase calls table
        const { error } = await supabase
            .from('calls')
            .insert({
                caller_id: currentUser.id,
                receiver_id: friendId,
                room_url: roomResult.url,
                status: 'ringing',
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Database error:', error);
            showToast('error', 'Failed to start call');
            return;
        }

        // 3. Navigate to call page (caller)
        window.location.href = `/pages/call/index.html?room=${encodeURIComponent(roomResult.url)}`;
        
    } catch (error) {
        console.error('Call error:', error);
        showToast('error', 'Failed to start call');
    }
};

// Format last seen
function formatLastSeen(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 60000);

    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
    return time.toLocaleDateString();
}

// Search friends
window.searchFriends = function() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    if (!input) return;

    const term = input.value.toLowerCase().trim();

    if (clearBtn) clearBtn.style.display = term ? 'flex' : 'none';

    filteredFriends = term 
        ? allFriends.filter(f => f.username?.toLowerCase().includes(term))
        : [...allFriends];

    renderFriendsList();
};

// Clear search
window.clearSearch = function() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        window.searchFriends();
    }
};

// Show empty state
function showEmptyState() {
    const container = document.getElementById('friendsList');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3>No friends yet</h3>
            <p>Add friends to start chatting</p>
            <button class="add-friends-btn" onclick="openSearch()">
                <i class="fas fa-user-plus"></i> Add Friends
            </button>
        </div>
    `;
}

// Show error
function showError(message) {
    const container = document.getElementById('friendsList');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">❌</div>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="add-friends-btn" onclick="location.reload()">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;
}

// Open chat with correct path
window.openChat = function(friendId, friendName) {
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendName
    }));
    window.location.href = `../../chats/index.html?friendId=${friendId}`;
};

// Search users WITH AVATAR URL
window.searchUsers = async function() {
    if (!supabase || !currentUser) {
        console.log('Waiting for Supabase...');
        return;
    }

    const input = document.getElementById('userSearchInput');
    const container = document.getElementById('searchResults');
    if (!input || !container) return;

    const term = input.value.toLowerCase().trim();

    if (!term) {
        container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-search" style="font-size:2rem;color:#cbd5e1;margin-bottom:10px;"></i><p>Search for friends to add</p></div>`;
        return;
    }

    try {
        const { data: friends } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        const friendIds = friends?.map(f => f.friend_id) || [];

        const { data: pending } = await supabase
            .from('friend_requests')
            .select('receiver_id')
            .eq('sender_id', currentUser.id)
            .eq('status', 'pending');

        const pendingIds = pending?.map(r => r.receiver_id) || [];

        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .neq('id', currentUser.id)
            .ilike('username', `%${term}%`)
            .limit(20);

        if (error) throw error;

        if (!users || users.length === 0) {
            container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-user-slash" style="font-size:2rem;color:#cbd5e1;margin-bottom:10px;"></i><p>No users found</p></div>`;
            return;
        }

        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const isPending = pendingIds.includes(user.id);
            const initial = user.username?.charAt(0).toUpperCase() || '?';

            html += `
                <div class="search-result-item">
                    <div class="search-result-avatar" style="background: linear-gradient(45deg, #007acc, #00b4d8);">
                        ${user.avatar_url 
                            ? `<img src="${user.avatar_url}" alt="${user.username}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                            : `<span style="color:white; font-size:1.2rem; font-weight:600;">${initial}</span>`
                        }
                    </div>
                    <div class="search-result-info">
                        <div class="search-result-name">${user.username}</div>
                        <div class="search-result-username">@${user.username}</div>
                    </div>
                    ${isFriend 
                        ? '<button class="add-friend-btn added" disabled>✓ Friends</button>'
                        : isPending
                        ? '<button class="add-friend-btn added" disabled>⏳ Sent</button>'
                        : `<button class="add-friend-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">+ Add</button>`
                    }
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i><p>Error searching users</p></div>`;
    }
};

// Send friend request
window.sendFriendRequest = async function(userId, username, btn) {
    try {
        btn.disabled = true;
        btn.textContent = 'Sending...';

        const { error } = await supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: userId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        if (error) throw error;

        btn.textContent = '✓ Sent';
        btn.classList.add('added');
        showToast('success', `Friend request sent to ${username}`);

    } catch (error) {
        console.error('Request error:', error);
        btn.disabled = false;
        btn.textContent = '+ Add';
        showToast('error', 'Failed to send request');
    }
};

// Toast
function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    let color = type === 'success' ? '#22c55e' : '#ef4444';

    toast.innerHTML = `
        <i class="fas fa-${icon}" style="color:${color};"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Navigation
window.goToHome = () => window.location.href = '../../home/index.html';
window.openSearch = () => {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('userSearchInput')?.focus(), 100);
    }
};
window.closeModal = () => {
    document.getElementById('searchModal').style.display = 'none';
};
window.logout = async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();

    document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    window.location.href = '../../../pages/login/index.html';
};

// Start
document.addEventListener('DOMContentLoaded', initFriendsPage);