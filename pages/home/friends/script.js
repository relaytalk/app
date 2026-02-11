// friends/script.js - Complete with navigation and notifications

console.log('Friends page loaded');

// Global variables
let currentUser = null;

// Toast Notification System (Same as home page)
class ToastNotification {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) this.createToastContainer();
    }

    createToastContainer() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.id = 'toastContainer';
        document.body.prepend(this.container);
    }

    show(options) {
        const { title = '', message = '', type = 'info', duration = 5000 } = options;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = '💬';
        switch(type) {
            case 'success': icon = '✨'; break;
            case 'error': icon = '❌'; break;
            case 'warning': icon = '⚠️'; break;
            case 'info': icon = '💬'; break;
        }

        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">
                    ${title}
                    <span class="toast-time">${time}</span>
                </div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            <div class="toast-progress">
                <div class="toast-progress-bar"></div>
            </div>
        `;

        this.container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    success(title, message = '', duration = 5000) {
        return this.show({ title, message, type: 'success', duration });
    }

    error(title, message = '', duration = 7000) {
        return this.show({ title, message, type: 'error', duration });
    }

    warning(title, message = '', duration = 6000) {
        return this.show({ title, message, type: 'warning', duration });
    }

    info(title, message = '', duration = 4000) {
        return this.show({ title, message, type: 'info', duration });
    }
}

const toast = new ToastNotification();

// Global functions
window.showToast = toast.show.bind(toast);
window.showSuccess = toast.success.bind(toast);
window.showError = toast.error.bind(toast);
window.showWarning = toast.warning.bind(toast);
window.showInfo = toast.info.bind(toast);

// Initialize page
async function initPage() {
    console.log('Initializing friends page...');
    
    try {
        // Wait for Supabase
        await waitForSupabase();
        
        // Check if user is logged in
        const { data } = await window.supabase.auth.getUser();
        if (!data.user) {
            window.location.href = '../../login/index.html';
            return;
        }
        
        currentUser = data.user;
        console.log('User:', currentUser.email);
        
        // Hide loading
        document.getElementById('loadingIndicator').style.display = 'none';
        
        // Load friends
        await loadFriends();
        
        // Load notifications badge
        await updateNotificationsBadge();
        
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to load page');
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}

// Wait for Supabase
async function waitForSupabase() {
    let attempts = 0;
    while (!window.supabase && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    if (!window.supabase) {
        throw new Error('Supabase not loaded');
    }
}

// Load friends
async function loadFriends() {
    if (!currentUser) return;
    
    try {
        const grid = document.getElementById('friendsGrid');
        
        // Get friends
        const { data: friends, error } = await window.supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
            
        if (error) throw error;
        
        if (!friends || friends.length === 0) {
            showEmptyFriends();
            updateFriendsCount(0);
            return;
        }
        
        // Get profiles
        const friendIds = friends.map(f => f.friend_id);
        const { data: profiles } = await window.supabase
            .from('profiles')
            .select('id, username, status, last_seen')
            .in('id', friendIds);
            
        updateFriendsCount(friends.length);
        displayFriends(profiles || []);
        
    } catch (error) {
        console.error('Load friends error:', error);
        showError('Failed to load friends');
        showEmptyFriends();
    }
}

// Display friends in grid
function displayFriends(friends) {
    const grid = document.getElementById('friendsGrid');
    if (!friends || friends.length === 0) {
        showEmptyFriends();
        return;
    }
    
    // Sort: online first, then by name
    friends.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.username.localeCompare(b.username);
    });
    
    let html = '';
    
    friends.forEach(friend => {
        const isOnline = friend.status === 'online';
        const lastSeen = friend.last_seen ? new Date(friend.last_seen) : new Date();
        const timeAgo = getTimeAgo(lastSeen);
        const firstLetter = friend.username?.charAt(0).toUpperCase() || 'U';
        const displayName = friend.username && friend.username.length > 10 ? 
            friend.username.substring(0, 10) + '...' : friend.username || 'Unknown';
        
        html += `
            <div class="friend-card" onclick="openChat('${friend.id}', '${friend.username}')">
                <div class="friend-avatar ${isOnline ? 'online' : ''}">
                    ${firstLetter}
                </div>
                <div class="friend-name">${displayName}</div>
                <div class="friend-status ${isOnline ? 'online' : 'offline'}">
                    ${isOnline ? 'Online' : `Last seen ${timeAgo}`}
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Show empty friends state
function showEmptyFriends() {
    const grid = document.getElementById('friendsGrid');
    grid.innerHTML = `
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

// Get time ago
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
async function openChat(friendId, friendUsername = 'Friend') {
    showInfo('Opening chat...', `Connecting with ${friendUsername}`);
    
    // Store friend info in session storage
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendUsername
    }));

    // Redirect to chat page
    setTimeout(() => {
        window.location.href = `../../chats/index.html?friendId=${friendId}`;
    }, 800);
}

// ==================== NOTIFICATIONS SYSTEM (SAME AS HOME PAGE) ====================

// Update notifications badge
async function updateNotificationsBadge() {
    try {
        if (!currentUser || !window.supabase) {
            console.log('Cannot update notifications: No user or Supabase');
            hideNotificationBadge();
            return;
        }

        const { data: notifications, error } = await window.supabase
            .from('friend_requests')
            .select('id')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) {
            console.log('Notifications error:', error.message);
            hideNotificationBadge();
            return;
        }

        const unreadCount = notifications?.length || 0;
        console.log('Found', unreadCount, 'notifications');

        updateBadgeDisplay(unreadCount);

    } catch (error) {
        console.error('❌ Error loading notifications:', error);
        hideNotificationBadge();
    }
}

function updateBadgeDisplay(count) {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'inline-block';

            // Show subtle notification toast for first notification
            if (count === 1) {
                setTimeout(() => {
                    showInfo("New Notification", "You have a new friend request");
                }, 1000);
            }
        } else {
            badge.style.display = 'none';
        }
    }
}

function hideNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.style.display = 'none';
    }
}

// Load notifications modal
async function loadNotifications() {
    const container = document.getElementById('notificationsList');

    if (!container) {
        console.error("Notifications container not found!");
        return;
    }

    try {
        if (!currentUser || !window.supabase) {
            showEmptyNotifications(container);
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
            console.error("Notifications error:", error.message);
            showEmptyNotifications(container);
            return;
        }

        if (!notifications || notifications.length === 0) {
            showEmptyNotifications(container);
            return;
        }

        // Get usernames for each sender
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
            const timeAgo = getTimeAgo(notification.created_at);
            const senderName = profileMap[notification.sender_id] || 'Unknown User';
            const firstLetter = senderName.charAt(0).toUpperCase();

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
        console.error("❌ Error loading notifications:", error);
        showEmptyNotifications(container);
    }
}

function showEmptyNotifications(container) {
    container.innerHTML = `
        <div class="no-notifications">
            <i class="fas fa-bell-slash"></i>
            <h3>No Notifications</h3>
            <p>You're all caught up!</p>
        </div>
    `;
}

// Accept friend request (same as home page)
async function acceptFriendRequest(requestId, senderId, senderName = 'User', button = null) {
    console.log("Accepting request:", requestId, "from:", senderId);

    if (!currentUser || !window.supabase) {
        showError("Error", "Cannot accept request");
        return;
    }

    // Show loading state on button
    if (button) {
        const originalText = button.textContent;
        button.textContent = '...';
        button.disabled = true;
    }

    try {
        // Update friend request status
        const { error: updateError } = await window.supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // Add to friends table (both directions)
        await window.supabase
            .from('friends')
            .insert({
                user_id: currentUser.id,
                friend_id: senderId,
                created_at: new Date().toISOString()
            });

        await window.supabase
            .from('friends')
            .insert({
                user_id: senderId,
                friend_id: currentUser.id,
                created_at: new Date().toISOString()
            });

        // Update UI
        await loadNotifications();
        await loadFriends();
        await updateNotificationsBadge();

        showSuccess("New Friend!", `You are now connected with ${senderName}! 🎉`);

        // Update button
        if (button) {
            button.textContent = '✓';
            button.disabled = true;
            button.style.background = 'rgba(40, 167, 69, 0.3)';
        }

    } catch (error) {
        console.error("❌ Error accepting friend request:", error);
        showError("Connection Failed", "Could not accept friend request");

        // Reset button
        if (button) {
            button.textContent = '✓';
            button.disabled = false;
        }
    }
}

// Decline friend request (same as home page)
async function declineFriendRequest(requestId, button = null) {
    if (!currentUser || !window.supabase) {
        showError("Error", "Cannot decline request");
        return;
    }

    // Show loading state on button
    if (button) {
        const originalText = button.textContent;
        button.textContent = '...';
        button.disabled = true;
    }

    try {
        const { error } = await window.supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (error) throw error;

        await loadNotifications();
        await updateNotificationsBadge();

        showInfo("Request Declined", "Friend request has been declined");

        // Update button
        if (button) {
            button.textContent = '✗';
            button.disabled = true;
            button.style.background = 'rgba(220, 53, 69, 0.3)';
        }

    } catch (error) {
        console.error("❌ Error declining friend request:", error);
        showError("Action Failed", "Could not decline friend request");

        // Reset button
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
        container.innerHTML = '<div class="loading">Loading users...</div>';

        // Get all users except current user
        const { data: users, error } = await window.supabase
            .from('profiles')
            .select('id, username, full_name')
            .neq('id', currentUser.id)
            .limit(50);

        if (error) {
            console.error('Search error:', error);
            container.innerHTML = '<div class="error">Error loading users</div>';
            return;
        }

        if (!users || users.length === 0) {
            container.innerHTML = '<div class="no-results">No users found</div>';
            return;
        }

        await displaySearchResults(users);

    } catch (error) {
        console.error('❌ Search error:', error);
        container.innerHTML = '<div class="error">Search failed</div>';
    }
}

async function displaySearchResults(users) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = '<div class="no-results">No users found</div>';
        return;
    }

    try {
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
            const firstLetter = user.username.charAt(0).toUpperCase();
            const displayName = user.username.length > 15 ? 
                user.username.substring(0, 15) + '...' : user.username;

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
        console.error('Display results error:', error);
        container.innerHTML = '<div class="error">Failed to load results</div>';
    }
}

// Send friend request
async function sendFriendRequest(toUserId, toUsername, button) {
    if (!currentUser || !window.supabase) {
        showError("Error", "Cannot send request");
        return;
    }

    // Show loading state
    if (button) {
        const originalText = button.textContent;
        button.textContent = 'Sending...';
        button.disabled = true;
    }

    try {
        // Check if request already exists
        const { data: existingRequest } = await window.supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', toUserId)
            .eq('status', 'pending')
            .maybeSingle();

        if (existingRequest) {
            showInfo("Already Sent", `You've already sent a friend request to ${toUsername}`);
            if (button) {
                button.textContent = '✓ Sent';
                button.style.background = 'rgba(0, 122, 204, 0.2)';
                button.style.color = '#007acc';
                setTimeout(() => {
                    button.disabled = false;
                }, 1000);
            }
            return;
        }

        // Create friend request
        const { error } = await window.supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: toUserId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error("Error sending request:", error);
            showError("Request Failed", "Could not send friend request");
            if (button) {
                button.textContent = 'Add';
                button.disabled = false;
            }
            return;
        }

        // Update notifications badge
        await updateNotificationsBadge();

        showSuccess("Request Sent", `Your request has been sent to ${toUsername}!`);

        // Update button
        if (button) {
            button.textContent = '✓ Sent';
            button.disabled = true;
            button.style.background = 'rgba(0, 122, 204, 0.2)';
            button.style.color = '#007acc';
        }

        // Refresh search results to update UI
        loadSearchResults();

    } catch (error) {
        console.error("❌ Friend request error:", error);
        showError("Request Failed", "Please check your connection");
        if (button) {
            button.textContent = 'Add';
            button.disabled = false;
        }
    }
}

// Filter search results
function filterSearchResultsInternal() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput || !searchResults) return;

    const term = searchInput.value.toLowerCase();
    const users = searchResults.querySelectorAll('.search-result');
    
    if (term === '') {
        // If search is empty, show all results
        users.forEach(user => {
            user.style.display = 'flex';
        });
        return;
    }
    
    let hasResults = false;
    users.forEach(user => {
        const name = user.querySelector('.result-name').textContent.toLowerCase();
        if (name.includes(term)) {
            user.style.display = 'flex';
            hasResults = true;
        } else {
            user.style.display = 'none';
        }
    });
    
    // Show no results message if no matches
    if (!hasResults) {
        const container = searchResults;
        container.innerHTML = '<div class="no-results">No users found matching "' + term + '"</div>';
    }
}

// Make functions globally available
window.loadSearchResults = loadSearchResults;
window.loadNotifications = loadNotifications;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.sendFriendRequest = sendFriendRequest;
window.filterSearchResultsInternal = filterSearchResultsInternal;
window.initPage = initPage;
window.openChat = openChat;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initPage, 500);
});