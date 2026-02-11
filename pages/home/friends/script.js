// friends/script.js - SIMPLIFIED AND FIXED VERSION

console.log('Friends page script loaded');

// Global variables
let currentUser = null;

// Simple toast function
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Wait for Supabase
async function waitForSupabase() {
    console.log('Waiting for Supabase...');
    let attempts = 0;
    while (!window.supabase && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    return !!window.supabase;
}

// Initialize page
async function initPage() {
    console.log('Initializing friends page...');
    
    try {
        // Wait for Supabase
        const supabaseReady = await waitForSupabase();
        if (!supabaseReady) {
            throw new Error('Supabase not loaded');
        }
        
        // Check authentication
        const { data } = await window.supabase.auth.getUser();
        if (!data.user) {
            window.location.href = '../../login/index.html';
            return;
        }
        
        currentUser = data.user;
        console.log('User authenticated:', currentUser.email);
        
        // Hide loading indicator
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Load friends
        await loadFriends();
        
        // Load notifications badge
        await updateNotificationsBadge();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to load page', 'error');
        
        // Hide loading indicator
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Show error state
        const container = document.getElementById('friendsContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; color: #007acc; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #005a9e; margin-bottom: 10px;">Connection Error</h3>
                    <p style="color: #666666; margin-bottom: 20px;">Failed to load friends. Please check your connection.</p>
                    <button onclick="location.reload()" style="
                        background: #007acc;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 20px;
                        cursor: pointer;
                    ">Retry</button>
                </div>
            `;
        }
    }
}

// Load friends
async function loadFriends() {
    if (!currentUser || !window.supabase) {
        console.error('Cannot load friends: User or Supabase not available');
        return;
    }
    
    const container = document.getElementById('friendsContainer');
    if (!container) {
        console.error('Friends container not found!');
        return;
    }
    
    try {
        console.log('Loading friends for user:', currentUser.id);
        
        // Show loading state
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="loading-spinner" style="margin: 0 auto 15px;"></div>
                <p style="color: #666666;">Loading friends...</p>
            </div>
        `;
        
        // Get friends list
        const { data: friends, error: friendsError } = await window.supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (friendsError) {
            console.error('Error fetching friends:', friendsError);
            throw friendsError;
        }
        
        console.log('Found friends:', friends);
        
        if (!friends || friends.length === 0) {
            showEmptyFriends();
            updateFriendsCount(0);
            return;
        }
        
        // Get friend profiles
        const friendIds = friends.map(f => f.friend_id);
        const { data: profiles, error: profilesError } = await window.supabase
            .from('profiles')
            .select('id, username, status, last_seen')
            .in('id', friendIds);
        
        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            throw profilesError;
        }
        
        console.log('Found profiles:', profiles);
        
        updateFriendsCount(friends.length);
        displayFriends(profiles || []);
        
    } catch (error) {
        console.error('Error loading friends:', error);
        showToast('Failed to load friends', 'error');
        showEmptyFriends();
    }
}

// Display friends in grid
function displayFriends(friends) {
    const container = document.getElementById('friendsContainer');
    if (!container) return;
    
    if (!friends || friends.length === 0) {
        showEmptyFriends();
        return;
    }
    
    // Sort: online first, then by username
    friends.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return (a.username || '').localeCompare(b.username || '');
    });
    
    let html = '';
    
    friends.forEach(friend => {
        const isOnline = friend.status === 'online';
        const lastSeen = friend.last_seen ? new Date(friend.last_seen) : new Date();
        const timeAgo = getTimeAgo(lastSeen);
        const firstLetter = (friend.username || 'U').charAt(0).toUpperCase();
        const displayName = friend.username || 'Unknown';
        const shortName = displayName.length > 10 ? 
            displayName.substring(0, 10) + '...' : displayName;
        
        html += `
            <div class="friend-card" onclick="openChat('${friend.id}', '${friend.username}')">
                <div class="friend-avatar ${isOnline ? 'online' : ''}">
                    ${firstLetter}
                </div>
                <div class="friend-name">${shortName}</div>
                <div class="friend-status ${isOnline ? 'online' : 'offline'}">
                    ${isOnline ? 'Online' : `Last seen ${timeAgo}`}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Show empty friends state
function showEmptyFriends() {
    const container = document.getElementById('friendsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="no-friends">
            <i class="fas fa-user-friends"></i>
            <h3>No Friends Yet</h3>
            <p>Add friends to start chatting</p>
            <button onclick="openSearchModal()" class="add-friends-btn">
                <i class="fas fa-user-plus"></i> Add Friends
            </button>
        </div>
    `;
}

// Update friends count
function updateFriendsCount(count) {
    const countElement = document.getElementById('friendsCount');
    if (countElement) {
        countElement.textContent = count;
    }
}

// Get time ago string
function getTimeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Open chat
function openChat(friendId, friendUsername = 'Friend') {
    showToast(`Opening chat with ${friendUsername}...`, 'info');
    
    // Store friend info
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendUsername
    }));

    // Redirect to chat page
    setTimeout(() => {
        window.location.href = `../../chats/index.html?friendId=${friendId}`;
    }, 800);
}

// ==================== NOTIFICATIONS ====================

// Update notifications badge
async function updateNotificationsBadge() {
    try {
        if (!currentUser || !window.supabase) return;
        
        const { data: notifications, error } = await window.supabase
            .from('friend_requests')
            .select('id')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');
        
        if (error) {
            console.error('Error fetching notifications:', error);
            return;
        }
        
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            const count = notifications?.length || 0;
            if (count > 0) {
                badge.textContent = count > 9 ? '9+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error updating notification badge:', error);
    }
}

// Load notifications
async function loadNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    try {
        if (!currentUser || !window.supabase) {
            container.innerHTML = '<div class="no-notifications">Not logged in</div>';
            return;
        }
        
        // Get notifications
        const { data: notifications, error } = await window.supabase
            .from('friend_requests')
            .select('id, sender_id, created_at')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading notifications:', error);
            container.innerHTML = '<div class="no-notifications">Error loading</div>';
            return;
        }
        
        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <h3>No Notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            `;
            return;
        }
        
        // Get sender usernames
        const senderIds = notifications.map(n => n.sender_id);
        const { data: profiles } = await window.supabase
            .from('profiles')
            .select('id, username')
            .in('id', senderIds);
        
        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => profileMap[p.id] = p.username);
        }
        
        let html = '';
        notifications.forEach(notification => {
            const senderName = profileMap[notification.sender_id] || 'Unknown User';
            const firstLetter = senderName.charAt(0).toUpperCase();
            const timeAgo = getTimeAgo(notification.created_at);
            
            html += `
                <div class="notification-item">
                    <div class="notif-avatar">${firstLetter}</div>
                    <div class="notif-content">
                        <strong>${senderName}</strong> wants to be friends
                        <small>${timeAgo}</small>
                    </div>
                    <div class="notif-actions">
                        <button class="accept-btn" onclick="acceptFriendRequest('${notification.id}', '${notification.sender_id}', '${senderName}', this)">
                            ✓
                        </button>
                        <button class="decline-btn" onclick="declineFriendRequest('${notification.id}', this)">
                            ✗
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        container.innerHTML = '<div class="no-notifications">Error loading</div>';
    }
}

// Accept friend request
async function acceptFriendRequest(requestId, senderId, senderName, button) {
    if (!currentUser || !window.supabase) return;
    
    if (button) {
        button.textContent = '...';
        button.disabled = true;
    }
    
    try {
        // Update request status
        await window.supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);
        
        // Add to friends (both directions)
        await window.supabase
            .from('friends')
            .insert([
                { user_id: currentUser.id, friend_id: senderId },
                { user_id: senderId, friend_id: currentUser.id }
            ]);
        
        showToast(`You are now friends with ${senderName}!`, 'success');
        
        // Update UI
        await loadNotifications();
        await loadFriends();
        await updateNotificationsBadge();
        
        if (button) {
            button.textContent = '✓';
            button.style.background = 'rgba(40, 167, 69, 0.3)';
        }
        
    } catch (error) {
        console.error('Error accepting friend request:', error);
        showToast('Failed to accept request', 'error');
        
        if (button) {
            button.textContent = '✓';
            button.disabled = false;
        }
    }
}

// Decline friend request
async function declineFriendRequest(requestId, button) {
    if (!currentUser || !window.supabase) return;
    
    if (button) {
        button.textContent = '...';
        button.disabled = true;
    }
    
    try {
        await window.supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);
        
        showToast('Friend request declined', 'info');
        
        // Update UI
        await loadNotifications();
        await updateNotificationsBadge();
        
        if (button) {
            button.textContent = '✗';
            button.style.background = 'rgba(220, 53, 69, 0.3)';
        }
        
    } catch (error) {
        console.error('Error declining friend request:', error);
        showToast('Failed to decline request', 'error');
        
        if (button) {
            button.textContent = '✗';
            button.disabled = false;
        }
    }
}

// ==================== SEARCH FUNCTIONALITY ====================

// Load search results
async function loadSearchResults() {
    const container = document.getElementById('searchResults');
    if (!container || !currentUser || !window.supabase) return;
    
    try {
        container.innerHTML = '<div class="loading">Loading...</div>';
        
        // Get users (excluding current user)
        const { data: users, error } = await window.supabase
            .from('profiles')
            .select('id, username, full_name')
            .neq('id', currentUser.id)
            .limit(50);
        
        if (error) {
            console.error('Error searching users:', error);
            container.innerHTML = '<div class="error">Search failed</div>';
            return;
        }
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="no-results">No users found</div>';
            return;
        }
        
        // Get current friends
        const { data: friends } = await window.supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        const friendIds = friends?.map(f => f.friend_id) || [];
        
        // Get pending requests
        const { data: pendingRequests } = await window.supabase
            .from('friend_requests')
            .select('receiver_id')
            .eq('sender_id', currentUser.id)
            .eq('status', 'pending');
        
        const pendingIds = pendingRequests?.map(r => r.receiver_id) || [];
        
        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const requestSent = pendingIds.includes(user.id);
            const firstLetter = (user.username || 'U').charAt(0).toUpperCase();
            const displayName = user.username || 'Unknown';
            
            html += `
                <div class="search-result">
                    <div class="result-avatar">${firstLetter}</div>
                    <div class="result-name">${displayName}</div>
                    ${isFriend ? `
                        <button class="add-btn" disabled style="background: rgba(40, 167, 69, 0.2); color: #28a745;">
                            ✓ Friend
                        </button>
                    ` : requestSent ? `
                        <button class="add-btn" disabled style="background: rgba(0, 122, 204, 0.2); color: #007acc;">
                            ✓ Sent
                        </button>
                    ` : `
                        <button class="add-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">
                            Add
                        </button>
                    `}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = '<div class="error">Search failed</div>';
    }
}

// Send friend request
async function sendFriendRequest(toUserId, toUsername, button) {
    if (!currentUser || !window.supabase) return;
    
    if (button) {
        button.textContent = 'Sending...';
        button.disabled = true;
    }
    
    try {
        // Check for existing request
        const { data: existing } = await window.supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', toUserId)
            .eq('status', 'pending')
            .maybeSingle();
        
        if (existing) {
            showToast('Request already sent', 'info');
            if (button) {
                button.textContent = '✓ Sent';
                button.style.background = 'rgba(0, 122, 204, 0.2)';
                button.style.color = '#007acc';
            }
            return;
        }
        
        // Send request
        await window.supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: toUserId,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        
        showToast(`Friend request sent to ${toUsername}`, 'success');
        
        // Update UI
        await updateNotificationsBadge();
        await loadSearchResults();
        
        if (button) {
            button.textContent = '✓ Sent';
            button.disabled = true;
            button.style.background = 'rgba(0, 122, 204, 0.2)';
            button.style.color = '#007acc';
        }
        
    } catch (error) {
        console.error('Error sending friend request:', error);
        showToast('Failed to send request', 'error');
        
        if (button) {
            button.textContent = 'Add';
            button.disabled = false;
        }
    }
}

// Filter search results
function filterSearchResultsInternal() {
    const searchInput = document.getElementById('searchInput');
    const container = document.getElementById('searchResults');
    
    if (!searchInput || !container) return;
    
    const term = searchInput.value.toLowerCase();
    const results = container.querySelectorAll('.search-result');
    
    if (results.length === 0) return;
    
    let hasVisible = false;
    results.forEach(result => {
        const name = result.querySelector('.result-name').textContent.toLowerCase();
        if (name.includes(term) || term === '') {
            result.style.display = 'flex';
            hasVisible = true;
        } else {
            result.style.display = 'none';
        }
    });
    
    if (!hasVisible && term !== '') {
        container.innerHTML = `<div class="no-results">No users found matching "${term}"</div>`;
    }
}

// ==================== GLOBAL FUNCTIONS ====================

// Make functions available globally
window.initPage = initPage;
window.loadFriends = loadFriends;
window.loadSearchResults = loadSearchResults;
window.loadNotifications = loadNotifications;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.sendFriendRequest = sendFriendRequest;
window.filterSearchResultsInternal = filterSearchResultsInternal;
window.openChat = openChat;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initPage, 500);
});