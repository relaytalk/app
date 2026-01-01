// Home Page Script - OPTIMIZED & SECURE VERSION
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Relay Home Page Loaded");

// Current user and state
let currentUser = null;
let currentProfile = null;
let friendsChannel = null;
let requestsChannel = null;
let searchDebounceTimer = null;
let onlineStatus = true;

// Initialize home page
async function initHomePage() {
    console.log("Initializing home page...");

    // Check if user is logged in
    const { success, user } = await auth.getCurrentUser();

    if (!success || !user) {
        showNotification("Please login first!", "warning");
        setTimeout(() => {
            window.location.href = '../auth/index.html';
        }, 1500);
        return;
    }

    currentUser = user;
    console.log("Logged in as:", currentUser.email);

    // Hide initial empty state to prevent flicker
    hideEmptyState();

    // Get user profile
    await loadUserProfile();

    // Update UI
    updateWelcomeMessage();
    await loadFriends();
    await updateNotificationsBadge();

    // Set up real-time subscriptions
    setupRealtimeSubscriptions();

    // Set up event listeners
    setupEventListeners();

    // Set up network detection
    setupNetworkDetection();

    console.log("Home page initialized for:", currentProfile?.username);

    // Hide loading indicator
    setTimeout(() => {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 300);
        }
    }, 100);
}

// Hide initial empty state
function hideEmptyState() {
    const friendsList = document.getElementById('friendsList');
    if (friendsList && friendsList.querySelector('.empty-state')) {
        friendsList.innerHTML = '<div class="loading-spinner"></div>';
    }
}

// Load user profile
async function loadUserProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        currentProfile = profile;
        console.log("Profile loaded:", profile.username);

    } catch (error) {
        console.error("Error loading profile:", error);
        currentProfile = {
            username: sanitizeHTML(currentUser.user_metadata?.username || 'User'),
            full_name: sanitizeHTML(currentUser.user_metadata?.full_name || 'User'),
            avatar_url: currentUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=User&background=random`
        };
    }
}

// Sanitize HTML to prevent XSS
function sanitizeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update welcome message
function updateWelcomeMessage() {
    if (!currentProfile) return;

    const welcomeElement = document.getElementById('welcomeTitle');
    if (welcomeElement) {
        welcomeElement.innerHTML = `Welcome, ${sanitizeHTML(currentProfile.username)}!`;
    }
}

// Load friends list with pagination
async function loadFriends(limit = 50, offset = 0) {
    if (!currentUser) return;

    console.log("Loading friends for user:", currentUser.id);

    const container = document.getElementById('friendsList');
    if (!container) {
        console.error("Friends list container not found!");
        return;
    }

    try {
        // Get friend IDs with pagination
        const { data: friends, error, count } = await supabase
            .from('friends')
            .select('friend_id', { count: 'exact' })
            .eq('user_id', currentUser.id)
            .range(offset, offset + limit - 1);

        if (error) {
            console.log("Error loading friends:", error.message);
            showEmptyFriends(container);
            return;
        }

        console.log("Found friend IDs:", friends?.length || 0);

        if (!friends || friends.length === 0) {
            showEmptyFriends(container);
            return;
        }

        // Get profiles for each friend
        const friendIds = friends.map(f => f.friend_id);
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, status, last_seen, avatar_url')
            .in('id', friendIds);

        if (profilesError) {
            console.error("Error loading profiles:", profilesError);
            showEmptyFriends(container);
            return;
        }

        let html = '';
        profiles.forEach(profile => {
            const isOnline = profile.status === 'online';
            const lastSeen = profile.last_seen ? new Date(profile.last_seen) : new Date();
            const timeAgo = getTimeAgo(lastSeen);
            const firstLetter = profile.username ? profile.username.charAt(0).toUpperCase() : '?';
            const safeUsername = sanitizeHTML(profile.username || 'Unknown User');

            html += `
                <div class="friend-card" onclick="openChat('${profile.id}', '${safeUsername}')" 
                     role="button" tabindex="0" aria-label="Chat with ${safeUsername}">
                    <div class="friend-avatar" style="background: linear-gradient(45deg, #667eea, #764ba2);">
                        ${firstLetter}
                    </div>
                    <div class="friend-info">
                        <div class="friend-name">${safeUsername}</div>
                        <div class="friend-status" data-user-id="${profile.id}">
                            <span class="status-dot ${isOnline ? '' : 'offline'}"></span>
                            <span class="status-text">
                                ${isOnline ? 'Online' : 'Last seen ' + timeAgo}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        // Add load more button if there are more friends
        if (count && count > offset + limit) {
            html += `
                <div class="load-more-container">
                    <button class="btn-secondary" onclick="loadMoreFriends(${limit}, ${offset + limit})">
                        Load More Friends (${count - offset - limit} remaining)
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading friends:", error);
        showEmptyFriends(container);
    }
}

// Load more friends
window.loadMoreFriends = async function(limit, offset) {
    showLoadingState('#friendsList', 'Loading more friends...');
    await loadFriends(limit, offset);
};

function showEmptyFriends(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <p>No friends yet</p>
            <p style="font-size: 0.9rem; margin-top: 10px;">Search for users to add friends</p>
        </div>
    `;
}

// Show loading state
function showLoadingState(selector, message = 'Loading...') {
    const container = document.querySelector(selector);
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }
}

// Get time ago string (fixed)
function getTimeAgo(date) {
    if (!date || isNaN(new Date(date).getTime())) {
        return 'unknown';
    }

    const now = new Date();
    const past = new Date(date);
    
    // Don't show future times
    if (past > now) {
        return 'just now';
    }
    
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays/7)}w ago`;
    
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Open chat with friend
async function openChat(friendId, friendUsername = 'Friend') {
    console.log("Opening chat with:", friendId, friendUsername);

    // Redirect to chat page with friend ID
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
    if (!currentUser) return;

    // Remove old channels if they exist
    removeChannels();

    // Subscribe to friend status changes
    friendsChannel = supabase.channel('friend-status')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles'
        }, (payload) => {
            // Update friend status in UI if they're in our friends list
            const statusElement = document.querySelector(`.friend-status[data-user-id="${payload.new.id}"]`);
            if (statusElement) {
                const isOnline = payload.new.status === 'online';
                const timeAgo = getTimeAgo(payload.new.last_seen);
                
                const dot = statusElement.querySelector('.status-dot');
                const text = statusElement.querySelector('.status-text');
                
                if (dot) {
                    dot.className = isOnline ? 'status-dot' : 'status-dot offline';
                }
                if (text) {
                    text.textContent = isOnline ? 'Online' : 'Last seen ' + timeAgo;
                }
            }
        })
        .subscribe();

    // Subscribe to friend requests
    requestsChannel = supabase.channel('friend-requests')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${currentUser.id}`
        }, async () => {
            // Update badge and refresh notifications if modal is open
            await updateNotificationsBadge();
            
            const modal = document.getElementById('notificationsModal');
            if (modal && modal.style.display === 'flex') {
                await loadNotifications();
            }
            
            showNotification("New friend request!", "info");
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${currentUser.id}`
        }, async () => {
            await updateNotificationsBadge();
            
            const modal = document.getElementById('notificationsModal');
            if (modal && modal.style.display === 'flex') {
                await loadNotifications();
            }
        })
        .subscribe();
}

// Remove channels
function removeChannels() {
    if (friendsChannel) {
        supabase.removeChannel(friendsChannel);
        friendsChannel = null;
    }
    if (requestsChannel) {
        supabase.removeChannel(requestsChannel);
        requestsChannel = null;
    }
}

// Update notifications badge
async function updateNotificationsBadge() {
    try {
        const { data: notifications, error } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) {
            console.log("Friend requests error:", error.message);
            hideNotificationBadge();
            return;
        }

        const unreadCount = notifications?.length || 0;
        updateBadgeDisplay(unreadCount);

    } catch (error) {
        console.error("Error loading notifications:", error);
        hideNotificationBadge();
    }
}

function updateBadgeDisplay(count) {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'block';
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

// Open search modal
function openSearch() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        // Clear previous search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        loadSearchResults();
        
        // Add outside click handler
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // Add ESC key handler
        document.addEventListener('keydown', handleEscKey);
    }
}

// Open notifications modal
function openNotifications() {
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadNotifications();
        
        // Add outside click handler
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // Add ESC key handler
        document.addEventListener('keydown', handleEscKey);
    }
}

// Handle ESC key
function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
}

// Close modal
function closeModal() {
    const searchModal = document.getElementById('searchModal');
    const notificationsModal = document.getElementById('notificationsModal');

    if (searchModal) {
        searchModal.style.display = 'none';
        searchModal.onclick = null;
    }
    if (notificationsModal) {
        notificationsModal.style.display = 'none';
        notificationsModal.onclick = null;
    }
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleEscKey);
    
    // Clear search debounce timer
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

// Load search results with debounce
async function loadSearchResults(searchTerm = '') {
    const container = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchInput');

    if (!container) {
        console.error("Search results container not found!");
        return;
    }

    // Show loading
    showLoadingState('#searchResults', 'Searching users...');

    try {
        let query = supabase
            .from('profiles')
            .select('id, username, full_name')
            .neq('id', currentUser.id)
            .order('username');

        // Only fetch from server if search term provided
        if (searchTerm.trim()) {
            query = query.ilike('username', `%${searchTerm}%`);
        } else {
            // For empty search, maybe show recent searches or nothing
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>Type to search for users</p>
                </div>
            `;
            return;
        }

        const { data: users, error } = await query.limit(50);

        if (error) throw error;

        await displaySearchResults(users);

    } catch (error) {
        console.error("Error loading users:", error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>Error loading users</p>
                <p style="font-size: 0.9rem;">${error.message}</p>
            </div>
        `;
    }
}

// Debounced search function
function debounceSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    // Clear existing timer
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    // Set new timer
    searchDebounceTimer = setTimeout(() => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        loadSearchResults(searchTerm);
    }, 300); // 300ms debounce
}

// Display search results
async function displaySearchResults(users) {
    const container = document.getElementById('searchResults');

    if (!container) {
        console.error("Search results container not found!");
        return;
    }

    if (!users || users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>No users found</p>
            </div>
        `;
        return;
    }

    try {
        // Check friends and pending requests in single query
        const { data: friends } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        const { data: pendingRequests } = await supabase
            .from('friend_requests')
            .select('receiver_id, status')
            .eq('sender_id', currentUser.id)
            .in('status', ['pending', 'accepted', 'rejected']);

        const friendIds = friends?.map(f => f.friend_id) || [];
        const pendingMap = {};
        pendingRequests?.forEach(req => {
            pendingMap[req.receiver_id] = req.status;
        });

        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const requestStatus = pendingMap[user.id];
            const firstLetter = user.username.charAt(0).toUpperCase();
            const safeUsername = sanitizeHTML(user.username);
            const safeFullName = sanitizeHTML(user.full_name || '');

            let buttonHtml = '';
            if (isFriend) {
                buttonHtml = `
                    <button class="search-action-btn friend" disabled>
                        ✓ Friend
                    </button>
                `;
            } else if (requestStatus === 'pending') {
                buttonHtml = `
                    <button class="search-action-btn pending" disabled>
                        ⏳ Pending
                    </button>
                `;
            } else if (requestStatus === 'accepted') {
                buttonHtml = `
                    <button class="search-action-btn friend" disabled>
                        ✓ Friend
                    </button>
                `;
            } else if (requestStatus === 'rejected') {
                buttonHtml = `
                    <button class="search-action-btn" onclick="sendFriendRequest('${user.id}', '${safeUsername}')">
                        Add Friend
                    </button>
                `;
            } else {
                buttonHtml = `
                    <button class="search-action-btn" onclick="sendFriendRequest('${user.id}', '${safeUsername}')">
                        Add Friend
                    </button>
                `;
            }

            html += `
                <div class="search-result">
                    <div class="search-avatar">
                        ${firstLetter}
                    </div>
                    <div class="search-info">
                        <div class="search-name">${safeUsername}</div>
                        ${safeFullName ? `<div class="search-fullname">${safeFullName}</div>` : ''}
                    </div>
                    ${buttonHtml}
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error displaying results:", error);
    }
}

// Send friend request with loading state
async function sendFriendRequest(toUserId, toUsername) {
    if (!currentUser) return;

    const button = event?.target;
    const originalText = button?.innerHTML;
    
    // Show loading state on button
    if (button) {
        button.innerHTML = '<span class="loading-dots">Sending</span>';
        button.disabled = true;
    }

    try {
        // Check if already friends
        const { data: existingFriend } = await supabase
            .from('friends')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('friend_id', toUserId)
            .maybeSingle();

        if (existingFriend) {
            showNotification(`Already friends with ${toUsername}!`, "info");
            if (button) {
                button.innerHTML = '✓ Friend';
                button.disabled = true;
                button.classList.add('friend');
            }
            return;
        }

        // Check for any existing request (any status)
        const { data: existingRequest } = await supabase
            .from('friend_requests')
            .select('id, status')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', toUserId)
            .maybeSingle();

        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                showNotification(`Friend request already sent to ${toUsername}!`, "info");
                if (button) {
                    button.innerHTML = '⏳ Pending';
                    button.disabled = true;
                    button.classList.add('pending');
                }
            } else if (existingRequest.status === 'accepted') {
                showNotification(`Already friends with ${toUsername}!`, "info");
                if (button) {
                    button.innerHTML = '✓ Friend';
                    button.disabled = true;
                    button.classList.add('friend');
                }
            } else {
                // Rejected - can send again
                await createFriendRequest(toUserId);
                showNotification(`Friend request sent to ${toUsername}!`, "success");
                if (button) {
                    button.innerHTML = '⏳ Pending';
                    button.disabled = true;
                    button.classList.add('pending');
                }
            }
            return;
        }

        // Create new friend request
        await createFriendRequest(toUserId);
        showNotification(`Friend request sent to ${toUsername}!`, "success");
        if (button) {
            button.innerHTML = '⏳ Pending';
            button.disabled = true;
            button.classList.add('pending');
        }

    } catch (error) {
        console.error("Error sending friend request:", error);
        showNotification("Could not send friend request. Please try again.", "error");
        if (button && originalText) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
}

// Create friend request (helper)
async function createFriendRequest(toUserId) {
    const { error } = await supabase
        .from('friend_requests')
        .insert({
            sender_id: currentUser.id,
            receiver_id: toUserId,
            status: 'pending',
            created_at: new Date().toISOString()
        });

    if (error) throw error;
}

// Load notifications
async function loadNotifications() {
    const container = document.getElementById('notificationsList');

    if (!container) {
        console.error("Notifications container not found!");
        return;
    }

    showLoadingState('#notificationsList', 'Loading notifications...');

    try {
        // Get notifications with sender info using join
        const { data: notifications, error } = await supabase
            .from('friend_requests')
            .select(`
                id,
                sender_id,
                created_at,
                profiles!friend_requests_sender_id_fkey (username)
            `)
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.log("Notifications error:", error.message);
            showEmptyNotifications(container);
            return;
        }

        if (!notifications || notifications.length === 0) {
            showEmptyNotifications(container);
            return;
        }

        let html = '';
        notifications.forEach(notification => {
            const timeAgo = getTimeAgo(notification.created_at);
            const senderName = sanitizeHTML(notification.profiles?.username || 'Unknown User');
            const firstLetter = senderName.charAt(0).toUpperCase();

            html += `
                <div class="notification-item">
                    <div class="notification-avatar">
                        ${firstLetter}
                    </div>
                    <div class="notification-content">
                        <div class="notification-text">
                            <strong>${senderName}</strong> wants to be friends
                        </div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                    <div class="notification-actions">
                        <button class="notification-btn accept" 
                                onclick="acceptFriendRequest('${notification.id}', '${notification.sender_id}', '${senderName}')"
                                aria-label="Accept request from ${senderName}">
                            ✓
                        </button>
                        <button class="notification-btn decline" 
                                onclick="declineFriendRequestWithConfirm('${notification.id}', '${senderName}')"
                                aria-label="Decline request from ${senderName}">
                            ✗
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading notifications:", error);
        showEmptyNotifications(container);
    }
}

function showEmptyNotifications(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔔</div>
            <p>No notifications yet</p>
        </div>
    `;
}

// Accept friend request with transaction
async function acceptFriendRequest(requestId, senderId, senderName = 'User') {
    const button = event?.target;
    if (button) {
        button.innerHTML = '⏳';
        button.disabled = true;
    }

    try {
        // Use transaction via RPC if available, otherwise sequential
        // 1. Update friend request status
        const { error: updateError } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // 2. Check if friendship already exists
        const { data: existingFriendship } = await supabase
            .from('friends')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('friend_id', senderId)
            .maybeSingle();

        if (!existingFriendship) {
            // 3. Add to friends table (both directions)
            const { error: friendError1 } = await supabase
                .from('friends')
                .insert({
                    user_id: currentUser.id,
                    friend_id: senderId,
                    created_at: new Date().toISOString()
                });

            const { error: friendError2 } = await supabase
                .from('friends')
                .insert({
                    user_id: senderId,
                    friend_id: currentUser.id,
                    created_at: new Date().toISOString()
                });

            if (friendError1 || friendError2) {
                console.log("Friend insertion errors:", friendError1?.message, friendError2?.message);
            }
        }

        // 4. Update UI
        await loadNotifications();
        await loadFriends();
        await updateNotificationsBadge();

        showNotification(`You are now friends with ${senderName}!`, "success");

    } catch (error) {
        console.error("Error accepting friend request:", error);
        showNotification("Could not accept friend request.", "error");
        if (button) {
            button.innerHTML = '✓';
            button.disabled = false;
        }
    }
}

// Decline with confirmation
async function declineFriendRequestWithConfirm(requestId, senderName) {
    if (confirm(`Are you sure you want to decline the friend request from ${senderName}?`)) {
        await declineFriendRequest(requestId);
    }
}

// Decline friend request
async function declineFriendRequest(requestId) {
    const button = event?.target;
    if (button) {
        button.innerHTML = '⏳';
        button.disabled = true;
    }

    try {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (error) throw error;

        await loadNotifications();
        await updateNotificationsBadge();

        showNotification(`Friend request declined.`, "info");

    } catch (error) {
        console.error("Error declining friend request:", error);
        showNotification("Could not decline friend request.", "error");
        if (button) {
            button.innerHTML = '✗';
            button.disabled = false;
        }
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : type === 'success' ? '#28a745' : '#667eea'};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        z-index: 10000;
        font-weight: 500;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Setup network detection
function setupNetworkDetection() {
    window.addEventListener('online', () => {
        onlineStatus = true;
        showNotification("You're back online!", "success");
        // Refresh data
        setTimeout(() => {
            loadFriends();
            updateNotificationsBadge();
        }, 1000);
    });

    window.addEventListener('offline', () => {
        onlineStatus = false;
        showNotification("You're offline. Some features may not work.", "warning");
    });
}

// Setup event listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounceSearch);
    }

    // Page visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && onlineStatus) {
            // Refresh data when tab becomes visible
            setTimeout(() => {
                loadFriends();
                updateNotificationsBadge();
            }, 500);
        }
    });

    // Logout button (if exists)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = '../auth/index.html';
            } catch (error) {
                console.error("Error logging out:", error);
                showNotification("Error logging out. Please try again.", "error");
            }
        });
    }

    console.log("✅ Event listeners setup complete");
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    removeChannels();
});

// Make functions available globally
window.openSearch = openSearch;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequestWithConfirm = declineFriendRequestWithConfirm;
window.goToHome = goToHome;
window.openSettings = openSettings;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);