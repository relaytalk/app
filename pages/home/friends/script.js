// friends/script.js - COMPLETE FIXED VERSION
console.log('✨ Friends Page Loaded');

// Toast Notification System
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

// Wait for Supabase
async function waitForSupabase() {
    console.log('⏳ Waiting for Supabase...');
    
    if (window.supabase) {
        console.log('✅ Supabase already loaded');
        return true;
    }
    
    try {
        await import('../../utils/supabase.js');
        
        let attempts = 0;
        while (!window.supabase && attempts < 25) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (window.supabase) {
            console.log('✅ Supabase loaded successfully');
            return true;
        } else {
            console.error('❌ Supabase failed to load');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error loading Supabase:', error);
        return false;
    }
}

// Simple auth check
async function checkAuth() {
    try {
        if (!window.supabase?.auth) {
            console.log('Auth not ready');
            return { success: false, message: 'Auth not ready' };
        }
        
        const { data, error } = await window.supabase.auth.getUser();
        
        if (error) {
            console.log('Auth error:', error.message);
            return { success: false, message: 'Authentication error' };
        }
        
        if (data.user) {
            console.log('✅ User authenticated:', data.user.email);
            return { success: true, user: data.user };
        } else {
            console.log('❌ No user found');
            return { success: false, message: 'Not logged in' };
        }
        
    } catch (error) {
        console.error('Auth check error:', error);
        return { success: false, message: 'Auth check failed' };
    }
}

let currentUser = null;
let allFriends = [];

// Initialize friends page
async function initFriendsPage() {
    console.log('👥 Initializing friends page...');
    
    // Show loading
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    try {
        // Step 1: Wait for Supabase
        const supabaseReady = await waitForSupabase();
        if (!supabaseReady) {
            toast.error("Connection Error", "Cannot connect to server");
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }
        
        // Step 2: Check authentication
        const authResult = await checkAuth();
        if (!authResult.success) {
            console.log('User not authenticated:', authResult.message);
            
            toast.info("Login Required", "Please login to view friends");
            
            setTimeout(() => {
                window.location.href = '../auth/index.html';
            }, 1500);
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }
        
        // Step 3: Set current user
        currentUser = authResult.user;
        console.log('✅ User:', currentUser.email);
        
        // Hide loading
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Step 4: Load friends
        await loadFriendsList();
        
        // Step 5: Setup search
        setupSearch();
        
        console.log('✅ Friends page initialized');
        
        // Welcome toast
        setTimeout(() => {
            toast.success("Friends Loaded", "Your friends circle is ready!");
        }, 500);
        
    } catch (error) {
        console.error('❌ Friends page init failed:', error);
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        toast.error("Loading Error", "Failed to load friends");
        
        // Show error state
        const container = document.getElementById('friendsContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3 class="empty-title">Connection Error</h3>
                    <p class="empty-desc">Failed to load friends. Please try again.</p>
                    <button class="search-btn" onclick="initFriendsPage()" style="margin-top: 20px;">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// Load friends list
async function loadFriendsList(searchTerm = '') {
    if (!currentUser || !window.supabase) {
        showErrorState('Not logged in');
        return;
    }
    
    const container = document.getElementById('friendsContainer');
    if (!container) return;
    
    try {
        // Show loading
        container.innerHTML = `
            <div class="friend-skeleton">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                    <div class="skeleton-name"></div>
                    <div class="skeleton-status"></div>
                </div>
            </div>
            <div class="friend-skeleton">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                    <div class="skeleton-name"></div>
                    <div class="skeleton-status"></div>
                </div>
            </div>
            <div class="friend-skeleton">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                    <div class="skeleton-name"></div>
                    <div class="skeleton-status"></div>
                </div>
            </div>
        `;
        
        // Get friend IDs
        const { data: friends, error } = await window.supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (error) {
            console.error('Friends load error:', error);
            showEmptyFriends();
            return;
        }
        
        if (!friends || friends.length === 0) {
            showEmptyFriends();
            allFriends = [];
            updateStats([]);
            return;
        }
        
        // Get profiles for each friend
        const friendIds = friends.map(f => f.friend_id);
        const { data: profiles, error: profilesError } = await window.supabase
            .from('profiles')
            .select('id, username, status, last_seen, avatar_url')
            .in('id', friendIds);
        
        if (profilesError) {
            console.error('Profiles load error:', profilesError);
            showEmptyFriends();
            return;
        }
        
        // Store all friends
        allFriends = profiles.map(profile => ({
            ...profile,
            unreadCount: 0
        }));
        
        // Filter by search term
        let filteredFriends = allFriends;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredFriends = allFriends.filter(friend => 
                friend.username.toLowerCase().includes(term)
            );
        }
        
        // Update stats
        updateStats(filteredFriends);
        
        // Display friends
        if (filteredFriends.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3 class="empty-title">No Friends Found</h3>
                    <p class="empty-desc">Try a different search term</p>
                </div>
            `;
            return;
        }
        
        displayFriends(filteredFriends);
        
    } catch (error) {
        console.error('❌ Error loading friends:', error);
        showErrorState(error.message);
    }
}

// Display friends
function displayFriends(friends) {
    const container = document.getElementById('friendsContainer');
    if (!container) return;
    
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
        const firstLetter = friend.username ? friend.username.charAt(0).toUpperCase() : '?';
        
        html += `
            <div class="friend-item-clean" onclick="openChat('${friend.id}', '${friend.username}')">
                <div class="friend-avatar-clean" style="background: #667eea;">
                    ${firstLetter}
                    <span class="status-indicator-clean ${isOnline ? 'online' : 'offline'}"></span>
                </div>
                <div class="friend-info-clean">
                    <div class="friend-name-status">
                        <div class="friend-name-clean">${friend.username}</div>
                        <div class="friend-status-clean">
                            ${isOnline ? 'Online' : 'Last seen ' + timeAgo}
                        </div>
                    </div>
                    ${friend.unreadCount > 0 ? `
                        <div class="unread-badge-clean">
                            ${friend.unreadCount > 9 ? '9+' : friend.unreadCount}
                        </div>
                    ` : ''}
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
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3 class="empty-title">No Friends Yet</h3>
            <p class="empty-desc">Add friends to start chatting</p>
            <button class="search-btn" onclick="openSearchModal()" style="margin-top: 20px;">
                <i class="fas fa-search"></i> Find Friends
            </button>
        </div>
    `;
}

// Show error state
function showErrorState(message) {
    const container = document.getElementById('friendsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3 class="empty-title">Connection Error</h3>
            <p class="empty-desc">${message || 'Could not load friends'}</p>
            <button class="search-btn" onclick="loadFriendsList()" style="margin-top: 20px;">
                <i class="fas fa-sync"></i> Try Again
            </button>
        </div>
    `;
}

// Update stats
function updateStats(friends) {
    const totalFriends = document.getElementById('totalFriends');
    const onlineFriends = document.getElementById('onlineFriends');
    
    if (totalFriends) {
        totalFriends.textContent = friends.length;
    }
    
    if (onlineFriends) {
        const onlineCount = friends.filter(f => f.status === 'online').length;
        onlineFriends.textContent = onlineCount;
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

// Setup search
function setupSearch() {
    const searchInput = document.getElementById('searchFriendsInput');
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const searchTerm = this.value.trim();
        
        searchTimeout = setTimeout(() => {
            loadFriendsList(searchTerm);
        }, 300);
    });
}

// Search friends
function searchFriends() {
    const searchInput = document.getElementById('searchFriendsInput');
    if (!searchInput) return;
    
    loadFriendsList(searchInput.value.trim());
}

// Open chat
async function openChat(friendId, friendUsername = 'Friend') {
    console.log('Opening chat with:', friendId);
    
    toast.info("Opening Chat", `Connecting with ${friendUsername}...`);
    
    // Store friend info
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendUsername
    }));
    
    // Redirect to chat page
    setTimeout(() => {
        window.location.href = `../chats/index.html?friendId=${friendId}`;
    }, 800);
}

// Search modal functions
function openSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        loadSearchResults();
    }
}

async function loadSearchResults() {
    const container = document.getElementById('searchResults');
    if (!container || !currentUser || !window.supabase) return;
    
    try {
        container.innerHTML = `
            <div class="empty-state" style="padding: 30px 20px;">
                <div class="empty-icon">⏳</div>
                <p>Loading users...</p>
            </div>
        `;
        
        // Get all users except current user
        const { data: users, error } = await window.supabase
            .from('profiles')
            .select('id, username')
            .neq('id', currentUser.id)
            .limit(20);
        
        if (error) {
            console.error('Search error:', error);
            container.innerHTML = `
                <div class="empty-state" style="padding: 30px 20px;">
                    <div class="empty-icon">⚠️</div>
                    <p>Error loading users</p>
                </div>
            `;
            return;
        }
        
        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 30px 20px;">
                    <div class="empty-icon">👥</div>
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        // Get current friends
        const { data: friends } = await window.supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        const friendIds = friends?.map(f => f.friend_id) || [];
        
        // Display users
        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const firstLetter = user.username.charAt(0).toUpperCase();
            
            html += `
                <div class="search-result">
                    <div class="search-avatar" style="background: #667eea;">${firstLetter}</div>
                    <div class="search-info">
                        <div class="search-name">${user.username}</div>
                    </div>
                    ${isFriend ? `
                        <button class="send-request-btn sent" disabled>
                            ✓ Friend
                        </button>
                    ` : `
                        <button class="send-request-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">
                            Add Friend
                        </button>
                    `}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Search error:', error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 30px 20px;">
                <div class="empty-icon">⚠️</div>
                <p>Search failed</p>
            </div>
        `;
    }
}

// Send friend request
async function sendFriendRequest(toUserId, toUsername, button) {
    if (!currentUser || !window.supabase) {
        toast.error("Error", "Cannot send request");
        return;
    }
    
    if (button) {
        button.textContent = 'Sending...';
        button.disabled = true;
    }
    
    try {
        const { error } = await window.supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: toUserId,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        
        if (error) {
            console.error('Request error:', error);
            toast.error("Request Failed", "Could not send request");
            if (button) {
                button.textContent = 'Add Friend';
                button.disabled = false;
            }
            return;
        }
        
        toast.success("Request Sent", `Friend request sent to ${toUsername}`);
        
        if (button) {
            button.textContent = '✓ Sent';
            button.classList.add('sent');
        }
        
        // Update search results
loadSearchResults();
        
    } catch (error) {
        console.error('❌ Request error:', error);
        toast.error("Error", "Could not send request");
        if (button) {
            button.textContent = 'Add Friend';
            button.disabled = false;
        }
    }
}

// Notifications
function openNotifications() {
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadNotifications();
    }
}

async function loadNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container || !currentUser || !window.supabase) return;
    
    try {
        const { data: requests, error } = await window.supabase
            .from('friend_requests')
            .select('id, sender_id, created_at')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');
        
        if (error) {
            console.error('Notifications error:', error);
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-icon">⚠️</div>
                    <p>Error loading notifications</p>
                </div>
            `;
            return;
        }
        
        if (!requests || requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-icon">🔔</div>
                    <p>No notifications</p>
                </div>
            `;
            return;
        }
        
        // Get sender usernames
        const senderIds = requests.map(r => r.sender_id);
        const { data: profiles } = await window.supabase
            .from('profiles')
            .select('id, username')
            .in('id', senderIds);
        
        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => profileMap[p.id] = p.username);
        }
        
        let html = '';
        requests.forEach(request => {
            const timeAgo = getTimeAgo(request.created_at);
            const senderName = profileMap[request.sender_id] || 'Unknown User';
            const firstLetter = senderName.charAt(0).toUpperCase();
            
            html += `
                <div class="notification-item">
                    <div class="notification-avatar" style="background: #667eea;">${firstLetter}</div>
                    <div class="notification-content">
                        <div class="notification-text">
                            <div class="notification-title">${senderName} wants to be friends</div>
                            <div class="notification-time">${timeAgo}</div>
                        </div>
                        <div class="notification-actions">
                            <button class="accept-btn" onclick="acceptRequest('${request.id}', '${request.sender_id}', this)">
                                Accept
                            </button>
                            <button class="decline-btn" onclick="declineRequest('${request.id}', this)">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Notifications error:', error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <div class="empty-icon">⚠️</div>
                <p>Failed to load notifications</p>
            </div>
        `;
    }
}

// Accept request
async function acceptRequest(requestId, senderId, button) {
    if (!currentUser || !window.supabase) {
        toast.error("Error", "Cannot accept request");
        return;
    }
    
    if (button) {
        button.textContent = 'Accepting...';
        button.disabled = true;
    }
    
    try {
        // Update request status
        await window.supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);
        
        // Add to friends table
        await window.supabase
            .from('friends')
            .insert([
                { user_id: currentUser.id, friend_id: senderId },
                { user_id: senderId, friend_id: currentUser.id }
            ]);
        
        toast.success("Friend Added", "You are now friends!");
        
        if (button) {
            button.textContent = '✓ Accepted';
            button.style.background = 'rgba(40, 167, 69, 0.3)';
        }
        
        // Reload friends list and notifications
        setTimeout(() => {
            loadFriendsList();
            loadNotifications();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Accept error:', error);
        toast.error("Error", "Could not accept request");
        
        if (button) {
            button.textContent = 'Accept';
            button.disabled = false;
        }
    }
}

// Decline request
async function declineRequest(requestId, button) {
    if (!currentUser || !window.supabase) {
        toast.error("Error", "Cannot decline request");
        return;
    }
    
    if (button) {
        button.textContent = 'Declining...';
        button.disabled = true;
    }
    
    try {
        await window.supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);
        
        toast.info("Request Declined", "Friend request declined");
        
        if (button) {
            button.textContent = '✗ Declined';
            button.style.background = 'rgba(220, 53, 69, 0.3)';
        }
        
        setTimeout(() => loadNotifications(), 500);
        
    } catch (error) {
        console.error('❌ Decline error:', error);
        toast.error("Error", "Could not decline request");
        
        if (button) {
            button.textContent = 'Decline';
            button.disabled = false;
        }
    }
}

// Close modal
function closeModal() {
    const searchModal = document.getElementById('searchModal');
    const notificationsModal = document.getElementById('notificationsModal');
    
    if (searchModal) searchModal.style.display = 'none';
    if (notificationsModal) notificationsModal.style.display = 'none';
}

// Navigation
function goToHome() {
    window.location.href = '../home/index.html';
}

function goToFriends() {
    // Already on friends page
    console.log('Already on friends page');
}

// Global functions
window.openSearchModal = openSearchModal;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptRequest = acceptRequest;
window.declineRequest = declineRequest;
window.goToHome = goToHome;
window.goToFriends = goToFriends;
window.searchFriends = searchFriends;

// Initialize on load
document.addEventListener('DOMContentLoaded', initFriendsPage);