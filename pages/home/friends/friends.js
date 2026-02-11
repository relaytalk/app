// friends.js - ULTRA SIMPLE

let currentUser = null;
let allFriends = [];
let filteredFriends = [];

// Initialize
async function initFriendsPage() {
    console.log('Loading friends...');
    
    try {
        await waitForSupabase();
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '../../index.html';
            return;
        }
        
        currentUser = session.user;
        await loadFriends();
        
        document.getElementById('loadingIndicator')?.classList.add('hidden');
        
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to load friends');
    }
}

// Wait for Supabase
function waitForSupabase() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.supabase) resolve();
            else setTimeout(check, 100);
        };
        check();
    });
}

// Load friends
async function loadFriends() {
    try {
        if (!currentUser) return;
        
        // Get friends
        const { data: friendsData, error: friendsError } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
            
        if (friendsError) throw friendsError;
        
        if (!friendsData || friendsData.length === 0) {
            showEmptyState();
            return;
        }
        
        // Get profiles
        const friendIds = friendsData.map(f => f.friend_id);
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, status, last_seen')
            .in('id', friendIds)
            .order('username');
            
        if (profilesError) throw profilesError;
        
        allFriends = profiles || [];
        filteredFriends = [...allFriends];
        renderFriendsList();
        
    } catch (error) {
        console.error('Error:', error);
        showEmptyState();
    }
}

// Render friends list
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
            <div class="friend-item" onclick="openChat('${friend.id}', '${friend.username}')">
                <div class="friend-avatar">${initial}</div>
                <div class="friend-info">
                    <div class="friend-name">${friend.username || 'User'}</div>
                    <div class="friend-status">
                        <span class="status-dot ${online ? 'status-online' : 'status-offline'}"></span>
                        ${online ? 'Online' : `Last seen ${lastSeen}`}
                    </div>
                </div>
                <i class="fas fa-chevron-right" style="color:#cbd5e1;"></i>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

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
function searchFriends() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    const term = input.value.toLowerCase().trim();
    
    if (clearBtn) clearBtn.style.display = term ? 'flex' : 'none';
    
    filteredFriends = term 
        ? allFriends.filter(f => f.username?.toLowerCase().includes(term))
        : [...allFriends];
    
    renderFriendsList();
}

// Clear search
function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        searchFriends();
    }
}

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

// Open chat
function openChat(friendId, friendName) {
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendName
    }));
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

// Search users
async function searchUsers() {
    const input = document.getElementById('userSearchInput');
    const container = document.getElementById('searchResults');
    const term = input.value.toLowerCase().trim();
    
    if (!term) {
        container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><p>Search for friends to add</p></div>`;
        return;
    }
    
    try {
        // Get current friends
        const { data: friends } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
            
        const friendIds = friends?.map(f => f.friend_id) || [];
        
        // Search users
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username')
            .neq('id', currentUser.id)
            .ilike('username', `%${term}%`)
            .limit(20);
            
        if (error) throw error;
        
        if (!users || users.length === 0) {
            container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><p>No users found</p></div>`;
            return;
        }
        
        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const initial = user.username?.charAt(0).toUpperCase() || '?';
            
            html += `
                <div class="search-result-item">
                    <div class="search-result-avatar">${initial}</div>
                    <div class="search-result-info">
                        <div class="search-result-name">${user.username}</div>
                        <div class="search-result-username">@${user.username}</div>
                    </div>
                    ${isFriend 
                        ? '<button class="add-friend-btn added" disabled>✓ Friends</button>'
                        : `<button class="add-friend-btn" onclick="sendRequest('${user.id}', '${user.username}', this)">+ Add</button>`
                    }
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Send friend request
async function sendRequest(userId, username, btn) {
    try {
        btn.disabled = true;
        btn.textContent = '...';
        
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
        showToast('success', `Request sent to ${username}`);
        
    } catch (error) {
        console.error('Request error:', error);
        btn.disabled = false;
        btn.textContent = '+ Add';
        showToast('error', 'Failed to send request');
    }
}

// Simple toast
function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="color:${type === 'success' ? '#22c55e' : '#ef4444'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Navigation functions
window.goToHome = function() {
    window.location.href = '../../home/index.html';
};

window.openSearch = function() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('userSearchInput')?.focus(), 100);
    }
};

window.openSettings = function() {
    document.getElementById('settingsModal').style.display = 'flex';
};

window.closeModal = function() {
    document.getElementById('searchModal').style.display = 'none';
    document.getElementById('settingsModal').style.display = 'none';
};

window.logout = function() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '../../index.html';
};

// Start
document.addEventListener('DOMContentLoaded', initFriendsPage);