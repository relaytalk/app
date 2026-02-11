// Friends Page Script
let currentUser = null;
let allFriends = [];
let filteredFriends = [];

// Toast System
class Toast {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(type, title, message = '') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        let icon = '💬';
        switch(type) {
            case 'success': icon = '✅'; break;
            case 'error': icon = '❌'; break;
            case 'warning': icon = '⚠️'; break;
            case 'info': icon = 'ℹ️'; break;
        }
        
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
        `;
        
        this.container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        return toast;
    }
}

const toast = new Toast();

// Initialize friends page
async function initFriendsPage() {
    console.log('Initializing friends page...');
    
    try {
        // Wait for Supabase
        await waitForSupabase();
        
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '../../auth/index.html';
            return;
        }
        
        currentUser = session.user;
        
        // Load friends
        await loadFriends();
        
        // Hide loading indicator
        document.getElementById('loadingIndicator').classList.add('hidden');
        
    } catch (error) {
        console.error('Error initializing friends page:', error);
        showError('Failed to load friends');
        setTimeout(() => {
            window.location.href = '../../home/index.html';
        }, 2000);
    }
}

// Wait for Supabase to load
async function waitForSupabase() {
    return new Promise((resolve) => {
        const checkSupabase = () => {
            if (window.supabase) {
                resolve();
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        checkSupabase();
    });
}

// Load friends from database
async function loadFriends() {
    try {
        if (!currentUser) return;
        
        // Get friend relationships
        const { data: friendsData, error: friendsError } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (friendsError) throw friendsError;
        
        if (!friendsData || friendsData.length === 0) {
            showEmptyState();
            return;
        }
        
        // Get friend profiles
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
        console.error('Error loading friends:', error);
        showEmptyState();
        toast.show('error', 'Error', 'Failed to load friends');
    }
}

// Render friends list
function renderFriendsList() {
    const container = document.getElementById('friendsList');
    
    if (!filteredFriends || filteredFriends.length === 0) {
        showEmptyState();
        return;
    }
    
    let html = '';
    
    filteredFriends.forEach(friend => {
        const firstLetter = friend.username ? friend.username.charAt(0).toUpperCase() : '?';
        const isOnline = friend.status === 'online';
        const lastSeen = friend.last_seen ? formatLastSeen(friend.last_seen) : 'Never';
        
        html += `
            <div class="friend-item" onclick="openChat('${friend.id}', '${friend.username}')">
                <div class="friend-avatar">${firstLetter}</div>
                <div class="friend-info">
                    <div class="friend-name">${friend.username || 'Unknown User'}</div>
                    <div class="friend-status">
                        <span class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></span>
                        ${isOnline ? 'Online' : `Last seen ${lastSeen}`}
                    </div>
                </div>
                <i class="fas fa-chevron-right" style="color: #999; font-size: 0.9rem;"></i>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Format last seen time
function formatLastSeen(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Show empty state
function showEmptyState() {
    const container = document.getElementById('friendsList');
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

// Search friends
function searchFriends() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearch');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    clearButton.style.display = searchTerm ? 'flex' : 'none';
    
    if (!searchTerm) {
        filteredFriends = [...allFriends];
        renderFriendsList();
        return;
    }
    
    filteredFriends = allFriends.filter(friend => 
        friend.username.toLowerCase().includes(searchTerm)
    );
    
    renderFriendsList();
}

// Clear search
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    searchInput.focus();
    searchFriends();
}

// Search for users to add
async function searchUsers() {
    const searchInput = document.getElementById('userSearchInput');
    const container = document.getElementById('searchResults');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        container.innerHTML = `
            <div class="empty-search">
                <i class="fas fa-search"></i>
                <p>Search for friends to add</p>
            </div>
        `;
        return;
    }
    
    try {
        // Get current friends and pending requests
        const [friendsResult, pendingResult] = await Promise.all([
            supabase
                .from('friends')
                .select('friend_id')
                .eq('user_id', currentUser.id),
            supabase
                .from('friend_requests')
                .select('receiver_id')
                .eq('sender_id', currentUser.id)
                .eq('status', 'pending')
        ]);
        
        const friendIds = friendsResult.data?.map(f => f.friend_id) || [];
        const pendingIds = pendingResult.data?.map(r => r.receiver_id) || [];
        
        // Search for users
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username')
            .neq('id', currentUser.id)
            .ilike('username', `%${searchTerm}%`)
            .limit(20);
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="empty-search">
                    <i class="fas fa-user-slash"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const isPending = pendingIds.includes(user.id);
            const firstLetter = user.username ? user.username.charAt(0).toUpperCase() : '?';
            
            html += `
                <div class="search-result-item">
                    <div class="search-result-avatar">${firstLetter}</div>
                    <div class="search-result-info">
                        <div class="search-result-name">${user.username}</div>
                        <div class="search-result-username">@${user.username.toLowerCase()}</div>
                    </div>
                    ${isFriend ? 
                        '<button class="add-friend-btn added" disabled>✓ Friend</button>' : 
                        isPending ? 
                        '<button class="add-friend-btn" disabled>Request Sent</button>' : 
                        `<button class="add-friend-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">Add Friend</button>`
                    }
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error searching users:', error);
        container.innerHTML = `
            <div class="empty-search">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error searching users</p>
            </div>
        `;
    }
}

// Send friend request
async function sendFriendRequest(userId, username, button) {
    try {
        button.disabled = true;
        button.textContent = 'Sending...';
        
        // Check if request already exists
        const { data: existing } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', userId)
            .eq('status', 'pending')
            .single();
        
        if (existing) {
            button.textContent = 'Request Sent';
            toast.show('info', 'Already Sent', 'Friend request already sent');
            return;
        }
        
        // Send request
        const { error } = await supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: userId,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        button.textContent = 'Request Sent';
        button.classList.add('added');
        
        toast.show('success', 'Request Sent', `Friend request sent to ${username}`);
        
        // Refresh search results
        searchUsers();
        
    } catch (error) {
        console.error('Error sending friend request:', error);
        button.disabled = false;
        button.textContent = 'Add Friend';
        toast.show('error', 'Error', 'Failed to send friend request');
    }
}

// Open chat with friend
function openChat(friendId, friendUsername) {
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendUsername
    }));
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

// Show error
function showError(message) {
    const container = document.getElementById('friendsList');
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">❌</div>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="add-friends-btn" onclick="window.location.reload()">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initFriendsPage);