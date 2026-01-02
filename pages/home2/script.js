// Home Page Script with Real-Time Updates
console.log("✨ RelayTalk Home Page Loaded");

// Global variables
let currentUser = null;
let currentProfile = null;
let supabaseClient = null;
let realtimeSubscription = null;

// Initialize the home page
async function initHomePage() {
    console.log("🚀 Initializing home page...");
    
    try {
        // Initialize Supabase
        supabaseClient = window.supabase;
        if (!supabaseClient) {
            throw new Error("Supabase client not found");
        }

        // Check authentication
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        
        if (authError) {
            console.error("Auth error:", authError);
            redirectToLogin();
            return;
        }

        if (!session) {
            redirectToLogin();
            return;
        }

        currentUser = session.user;
        console.log("✅ Logged in as:", currentUser.email);

        // Load user profile
        await loadUserProfile();
        
        // Setup real-time subscriptions
        setupRealtimeSubscriptions();
        
        // Load initial data
        await Promise.all([
            loadChats(),
            updateNotificationsBadge()
        ]);
        
        // Update UI
        updateWelcomeMessage();
        
        // Setup event listeners
        setupEventListeners();
        
        // Hide loading screen
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);
        
        console.log("🎉 Home page initialization complete");
        
    } catch (error) {
        console.error("❌ Initialization error:", error);
        showError("Failed to initialize. Please refresh.");
    }
}

// Redirect to login
function redirectToLogin() {
    window.location.href = '../../auth/index.html';
}

// Load user profile
async function loadUserProfile() {
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            console.warn("Profile error, using defaults:", error.message);
            currentProfile = {
                username: currentUser.email.split('@')[0],
                full_name: 'User',
                avatar_url: null
            };
        } else {
            currentProfile = profile;
            console.log("📝 Profile loaded:", profile.username);
        }
        
        // Update avatar initial
        const avatarInitial = document.getElementById('avatarInitial');
        if (avatarInitial && currentProfile.username) {
            avatarInitial.textContent = currentProfile.username.charAt(0).toUpperCase();
        }
        
    } catch (error) {
        console.error("Error loading profile:", error);
        currentProfile = {
            username: 'User',
            full_name: 'User',
            avatar_url: null
        };
    }
}

// Update welcome message
function updateWelcomeMessage() {
    if (!currentProfile) return;
    
    const welcomeTitle = document.getElementById('welcomeTitle');
    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    
    if (welcomeTitle) {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        
        welcomeTitle.textContent = `${greeting}, ${currentProfile.username}!`;
    }
    
    if (welcomeSubtitle) {
        welcomeSubtitle.textContent = 'Your conversations are live and ready';
    }
}

// Load chats with friends
async function loadChats() {
    console.log("💬 Loading chats...");
    
    const container = document.getElementById('chatsList');
    if (!container) return;
    
    try {
        // Get user's friends
        const { data: friends, error: friendsError } = await supabaseClient
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (friendsError) {
            console.error("Friends error:", friendsError);
            showEmptyChats(container);
            return;
        }
        
        if (!friends || friends.length === 0) {
            showEmptyChats(container);
            return;
        }
        
        const friendIds = friends.map(f => f.friend_id);
        
        // Get profiles of friends
        const { data: profiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name, status, last_seen')
            .in('id', friendIds);
        
        if (profilesError) {
            console.error("Profiles error:", profilesError);
            showEmptyChats(container);
            return;
        }
        
        // Get last messages for each friend
        const chatsHtml = await Promise.all(
            profiles.map(async (profile) => {
                const lastMessage = await getLastMessage(profile.id);
                const unreadCount = await getUnreadCount(profile.id);
                const isOnline = profile.status === 'online';
                
                return createChatItem(profile, lastMessage, unreadCount, isOnline);
            })
        );
        
        // Sort by last message time (most recent first)
        container.innerHTML = chatsHtml.sort((a, b) => {
            const timeA = extractTime(a);
            const timeB = extractTime(b);
            return timeB - timeA;
        }).join('');
        
        // Add click events
        addChatClickEvents();
        
    } catch (error) {
        console.error("Error loading chats:", error);
        showEmptyChats(container);
    }
}

// Get last message with a friend
async function getLastMessage(friendId) {
    try {
        const { data: messages, error } = await supabaseClient
            .from('direct_messages')
            .select('content, created_at, sender_id')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error || !messages) {
            return { content: 'Start a conversation', created_at: null, sender_id: null };
        }
        
        return messages;
    } catch (error) {
        return { content: 'Start a conversation', created_at: null, sender_id: null };
    }
}

// Get unread message count
async function getUnreadCount(friendId) {
    try {
        const { count, error } = await supabaseClient
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('sender_id', friendId)
            .eq('read', false);
        
        if (error) return 0;
        return count || 0;
    } catch (error) {
        return 0;
    }
}

// Create chat item HTML
function createChatItem(profile, lastMessage, unreadCount, isOnline) {
    const timeAgo = lastMessage.created_at ? getTimeAgo(lastMessage.created_at) : '';
    const messagePreview = lastMessage.sender_id === currentUser.id 
        ? `You: ${lastMessage.content}`
        : lastMessage.content;
    
    const isUnread = unreadCount > 0;
    
    return `
        <div class="chat-item ${isUnread ? 'unread' : ''}" data-friend-id="${profile.id}">
            <div class="chat-avatar">
                <div class="avatar-circle">
                    ${profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
                </div>
                <div class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></div>
            </div>
            <div class="chat-info">
                <div class="chat-header">
                    <div class="chat-name">${profile.username || 'Unknown User'}</div>
                    <div class="chat-time">${timeAgo}</div>
                </div>
                <div class="chat-preview">
                    <div class="chat-message">${messagePreview}</div>
                    ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Extract time from chat item for sorting
function extractTime(html) {
    const match = html.match(/chat-time">([^<]+)</);
    if (!match) return 0;
    
    const timeStr = match[1];
    const now = new Date();
    
    if (timeStr.includes('just now')) return now.getTime();
    if (timeStr.includes('min')) return now.getTime() - parseInt(timeStr) * 60000;
    if (timeStr.includes('h')) return now.getTime() - parseInt(timeStr) * 3600000;
    if (timeStr.includes('d')) return now.getTime() - parseInt(timeStr) * 86400000;
    if (timeStr.includes('w')) return now.getTime() - parseInt(timeStr) * 604800000;
    
    return 0;
}

// Show empty chats state
function showEmptyChats(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="fas fa-comment-slash"></i>
            </div>
            <h3>No conversations yet</h3>
            <p>Start by adding friends or sending your first message!</p>
            <button class="btn-primary" onclick="window.location.href='subpages/search.html'">
                <i class="fas fa-user-plus"></i>
                Find Friends
            </button>
        </div>
    `;
}

// Add click events to chat items
function addChatClickEvents() {
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', function() {
            const friendId = this.dataset.friendId;
            const friendName = this.querySelector('.chat-name').textContent;
            openChat(friendId, friendName);
        });
    });
}

// Open chat with friend
async function openChat(friendId, friendName) {
    console.log("Opening chat with:", friendId, friendName);
    
    // Mark messages as read
    await markMessagesAsRead(friendId);
    
    // Store friend info in session storage
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendName
    }));
    
    // Redirect to chat page
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

// Mark messages as read
async function markMessagesAsRead(friendId) {
    try {
        await supabaseClient
            .from('direct_messages')
            .update({ read: true })
            .eq('sender_id', friendId)
            .eq('receiver_id', currentUser.id)
            .eq('read', false);
    } catch (error) {
        console.error("Error marking messages as read:", error);
    }
}

// Get time ago string
function getTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Update notifications badge
async function updateNotificationsBadge() {
    try {
        const { count, error } = await supabaseClient
            .from('friend_requests')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');
        
        if (error) {
            console.log("Friend requests error:", error.message);
            hideNotificationBadge();
            return;
        }
        
        const unreadCount = count || 0;
        
        // Update header badge
        const headerBadge = document.getElementById('headerNotificationBadge');
        if (headerBadge) {
            if (unreadCount > 0) {
                headerBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                headerBadge.style.display = 'flex';
            } else {
                headerBadge.style.display = 'none';
            }
        }
        
        // Update bottom nav badge
        const bottomBadge = document.getElementById('bottomNavBadge');
        if (bottomBadge) {
            if (unreadCount > 0) {
                bottomBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                bottomBadge.style.display = 'flex';
            } else {
                bottomBadge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error("Error updating notifications badge:", error);
        hideNotificationBadge();
    }
}

// Hide notification badge
function hideNotificationBadge() {
    const headerBadge = document.getElementById('headerNotificationBadge');
    const bottomBadge = document.getElementById('bottomNavBadge');
    
    if (headerBadge) headerBadge.style.display = 'none';
    if (bottomBadge) bottomBadge.style.display = 'none';
}

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
    if (!supabaseClient || !currentUser) return;
    
    // Subscribe to online status changes
    const statusChannel = supabaseClient.channel('online-status')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=neq.${currentUser.id}`
        }, (payload) => {
            console.log('Status update:', payload.new);
            updateFriendStatus(payload.new.id, payload.new.status);
        })
        .subscribe();
    
    // Subscribe to new messages
    const messagesChannel = supabaseClient.channel('new-messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('New message received:', payload.new);
            handleNewMessage(payload.new);
        })
        .subscribe();
    
    // Subscribe to friend requests
    const requestsChannel = supabaseClient.channel('friend-requests')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('New friend request:', payload.new);
            handleNewFriendRequest(payload.new);
        })
        .subscribe();
    
    realtimeSubscription = { statusChannel, messagesChannel, requestsChannel };
    console.log("📡 Real-time subscriptions established");
}

// Update friend status in UI
function updateFriendStatus(friendId, status) {
    const chatItems = document.querySelectorAll(`.chat-item[data-friend-id="${friendId}"]`);
    
    chatItems.forEach(item => {
        const statusDot = item.querySelector('.status-dot');
        if (statusDot) {
            statusDot.className = 'status-dot ' + (status === 'online' ? 'status-online' : 'status-offline');
        }
    });
}

// Handle new message
async function handleNewMessage(message) {
    // Update notifications badge
    await updateNotificationsBadge();
    
    // Refresh chats to show new message
    await loadChats();
    
    // Show notification
    showMessageNotification(message);
}

// Show message notification
function showMessageNotification(message) {
    // Check if we have Notification permission
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
        // Get sender name
        const senderName = 'New message'; // You would fetch this from your data
        
        new Notification(senderName, {
            body: message.content,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
        });
    }
}

// Handle new friend request
function handleNewFriendRequest(request) {
    // Update notifications badge
    updateNotificationsBadge();
    
    // Show toast notification
    showToast('New friend request received!', 'info');
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Show error message
function showError(message) {
    showToast(message, 'error');
}

// Setup event listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Refresh chats button
    const refreshBtn = document.getElementById('refreshChats');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('rotating');
            await loadChats();
            setTimeout(() => {
                refreshBtn.classList.remove('rotating');
            }, 1000);
        });
    }
    
    // New chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', openNewChatModal);
    }
    
    // New chat modal search
    const newChatSearch = document.getElementById('newChatSearch');
    if (newChatSearch) {
        newChatSearch.addEventListener('input', searchFriendsForNewChat);
    }
    
    // Logout handler (if needed)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#logoutBtn')) {
            handleLogout();
        }
    });
    
    // Pull to refresh
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        
        if (diff > 100 && window.scrollY === 0) {
            // Pull to refresh
            const refreshBtn = document.getElementById('refreshChats');
            if (refreshBtn) {
                refreshBtn.click();
            }
        }
    });
}

// Open new chat modal
async function openNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Load friends for modal
    await loadFriendsForNewChat();
}

// Close modal
function closeModal() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Load friends for new chat modal
async function loadFriendsForNewChat() {
    const container = document.getElementById('friendsListModal');
    if (!container) return;
    
    try {
        // Get user's friends
        const { data: friends, error: friendsError } = await supabaseClient
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (friendsError) {
            console.error("Friends error:", friendsError);
            showEmptyChats(container);
            return;
        }
        
        if (!friends || friends.length === 0) {
            showEmptyChats(container);
            return;
        }
        
        const friendIds = friends.map(f => f.friend_id);
        
        // Get profiles of friends
        const { data: profiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name, status, last_seen')
            .in('id', friendIds);
        
        if (profilesError) {
            console.error("Profiles error:", profilesError);
            showEmptyChats(container);
            return;
        }
        
        // Get last messages for each friend
        const chatsHtml = await Promise.all(
            profiles.map(async (profile) => {
                const lastMessage = await getLastMessage(profile.id);
                const unreadCount = await getUnreadCount(profile.id);
                const isOnline = profile.status === 'online';
                
                return createChatItem(profile, lastMessage, unreadCount, isOnline);
            })
        );
        
        // Sort by last message time (most recent first)
        container.innerHTML = chatsHtml.sort((a, b) => {
            const timeA = extractTime(a);
            const timeB = extractTime(b);
            return timeB - timeA;
        }).join('');
        
        // Add click events
        addChatClickEvents();
        
    } catch (error) {
        console.error("Error loading chats:", error);
        showEmptyChats(container);
    }
}

// Get last message with a friend
async function getLastMessage(friendId) {
    try {
        const { data: messages, error } = await supabaseClient
            .from('direct_messages')
            .select('content, created_at, sender_id')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error || !messages) {
            return { content: 'Start a conversation', created_at: null, sender_id: null };
        }
        
        return messages;
    } catch (error) {
        return { content: 'Start a conversation', created_at: null, sender_id: null };
    }
}

// Get unread message count
async function getUnreadCount(friendId) {
    try {
        const { count, error } = await supabaseClient
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('sender_id', friendId)
            .eq('read', false);
        
        if (error) return 0;
        return count || 0;
    } catch (error) {
        return 0;
    }
}

// Create chat item HTML
function createChatItem(profile, lastMessage, unreadCount, isOnline) {
    const timeAgo = lastMessage.created_at ? getTimeAgo(lastMessage.created_at) : '';
    const messagePreview = lastMessage.sender_id === currentUser.id 
        ? `You: ${lastMessage.content}`
        : lastMessage.content;
    
    const isUnread = unreadCount > 0;
    
    return `
        <div class="chat-item ${isUnread ? 'unread' : ''}" data-friend-id="${profile.id}">
            <div class="chat-avatar">
                <div class="avatar-circle">
                    ${profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
                </div>
                <div class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></div>
            </div>
            <div class="chat-info">
                <div class="chat-header">
                    <div class="chat-name">${profile.username || 'Unknown User'}</div>
                    <div class="chat-time">${timeAgo}</div>
                </div>
                <div class="chat-preview">
                    <div class="chat-message">${messagePreview}</div>
                    ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Extract time from chat item for sorting
function extractTime(html) {
    const match = html.match(/chat-time">([^<]+)</);
    if (!match) return 0;
    
    const timeStr = match[1];
    const now = new Date();
    
    if (timeStr.includes('just now')) return now.getTime();
    if (timeStr.includes('min')) return now.getTime() - parseInt(timeStr) * 60000;
    if (timeStr.includes('h')) return now.getTime() - parseInt(timeStr) * 3600000;
    if (timeStr.includes('d')) return now.getTime() - parseInt(timeStr) * 86400000;
    if (timeStr.includes('w')) return now.getTime() - parseInt(timeStr) * 604800000;
    
    return 0;
}

// Show empty chats state
function showEmptyChats(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="fas fa-comment-slash"></i>
            </div>
            <h3>No conversations yet</h3>
            <p>Start by adding friends or sending your first message!</p>
            <button class="btn-primary" onclick="window.location.href='subpages/search.html'">
                <i class="fas fa-user-plus"></i>
                Find Friends
            </button>
        </div>
    `;
}

// Add click events to chat items
function addChatClickEvents() {
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', function() {
            const friendId = this.dataset.friendId;
            const friendName = this.querySelector('.chat-name').textContent;
            openChat(friendId, friendName);
        });
    });
}

// Open chat with friend
async function openChat(friendId, friendName) {
    console.log("Opening chat with:", friendId, friendName);
    
    // Mark messages as read
    await markMessagesAsRead(friendId);
    
    // Store friend info in session storage
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendName
    }));
    
    // Redirect to chat page
    window.location.href = `../chats/index.html?friendId=${friendId}`;
}

// Mark messages as read
async function markMessagesAsRead(friendId) {
    try {
        await supabaseClient
            .from('direct_messages')
            .update({ read: true })
            .eq('sender_id', friendId)
            .eq('receiver_id', currentUser.id)
            .eq('read', false);
    } catch (error) {
        console.error("Error marking messages as read:", error);
    }
}

// Get time ago string
function getTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Update notifications badge
async function updateNotificationsBadge() {
    try {
        const { count, error } = await supabaseClient
            .from('friend_requests')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');
        
        if (error) {
            console.log("Friend requests error:", error.message);
            hideNotificationBadge();
            return;
        }
        
        const unreadCount = count || 0;
        
        // Update header badge
        const headerBadge = document.getElementById('headerNotificationBadge');
        if (headerBadge) {
            if (unreadCount > 0) {
                headerBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                headerBadge.style.display = 'flex';
            } else {
                headerBadge.style.display = 'none';
            }
        }
        
        // Update bottom nav badge
        const bottomBadge = document.getElementById('bottomNavBadge');
        if (bottomBadge) {
            if (unreadCount > 0) {
                bottomBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                bottomBadge.style.display = 'flex';
            } else {
                bottomBadge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error("Error updating notifications badge:", error);
        hideNotificationBadge();
    }
}

// Hide notification badge
function hideNotificationBadge() {
    const headerBadge = document.getElementById('headerNotificationBadge');
    const bottomBadge = document.getElementById('bottomNavBadge');
    
    if (headerBadge) headerBadge.style.display = 'none';
    if (bottomBadge) bottomBadge.style.display = 'none';
}

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
    if (!supabaseClient || !currentUser) return;
    
    // Subscribe to online status changes
    const statusChannel = supabaseClient.channel('online-status')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=neq.${currentUser.id}`
        }, (payload) => {
            console.log('Status update:', payload.new);
            updateFriendStatus(payload.new.id, payload.new.status);
        })
        .subscribe();
    
    // Subscribe to new messages
    const messagesChannel = supabaseClient.channel('new-messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('New message received:', payload.new);
            handleNewMessage(payload.new);
        })
        .subscribe();
    
    // Subscribe to friend requests
    const requestsChannel = supabaseClient.channel('friend-requests')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('New friend request:', payload.new);
            handleNewFriendRequest(payload.new);
        })
        .subscribe();
    
    realtimeSubscription = { statusChannel, messagesChannel, requestsChannel };
    console.log("📡 Real-time subscriptions established");
}

// Update friend status in UI
function updateFriendStatus(friendId, status) {
    const chatItems = document.querySelectorAll(`.chat-item[data-friend-id="${friendId}"]`);
    
    chatItems.forEach(item => {
        const statusDot = item.querySelector('.status-dot');
        if (statusDot) {
            statusDot.className = 'status-dot ' + (status === 'online' ? 'status-online' : 'status-offline');
        }
    });
}

// Handle new message
async function handleNewMessage(message) {
    // Update notifications badge
    await updateNotificationsBadge();
    
    // Refresh chats to show new message
    await loadChats();
    
    // Show notification
    showMessageNotification(message);
}

// Show message notification
function showMessageNotification(message) {
    // Check if we have Notification permission
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
        // Get sender name
        const senderName = 'New message'; // You would fetch this from your data
        
        new Notification(senderName, {
            body: message.content,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
        });
    }
}

// Handle new friend request
function handleNewFriendRequest(request) {
    // Update notifications badge
    updateNotificationsBadge();
    
    // Show toast notification
    showToast('New friend request received!', 'info');
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Show error message
function showError(message) {
    showToast(message, 'error');
}

// Setup event listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Refresh chats button
    const refreshBtn = document.getElementById('refreshChats');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('rotating');
            await loadChats();
            setTimeout(() => {
                refreshBtn.classList.remove('rotating');
            }, 1000);
        });
    }
    
    // New chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', openNewChatModal);
    }
    
    // New chat modal search
    const newChatSearch = document.getElementById('newChatSearch');
    if (newChatSearch) {
        newChatSearch.addEventListener('input', searchFriendsForNewChat);
    }
    
    // Logout handler (if needed)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#logoutBtn')) {
            handleLogout();
        }
    });
    
    // Pull to refresh
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        
        if (diff > 100 && window.scrollY === 0) {
            // Pull to refresh
            const refreshBtn = document.getElementById('refreshChats');
            if (refreshBtn) {
                refreshBtn.click();
            }
        }
    });
}

// Open new chat modal
async function openNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Load friends for modal
    await loadFriendsForNewChat();
}

// Close modal
function closeModal() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Load friends for new chat modal
async function loadFriendsForNewChat() {
    const container = document.getElementById('friendsListModal');
    if (!container) return;
    
    try {
        // Get user's friends
        const { data: friends, error } = await supabaseClient
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (error || !friends || friends.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>No friends yet. Add some friends first!</p>
                </div>
            `;
            return;
        }
        
        const friendIds = friends.map(f => f.friend_id);
        
        // Get profiles of friends
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name, status')
            .in('id', friendIds);
        
        if (!profiles || profiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>No friends found</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        profiles.forEach(profile => {
            const isOnline = profile.status === 'online';
            
            html += `
                <div class="friend-item-modal" data-friend-id="${profile.id}">
                    <div class="friend-avatar-modal">
                        ${profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div class="friend-info-modal">
                        <h4>${profile.username || 'Unknown User'}</h4>
                        <p>${isOnline ? 'Online' : 'Offline'}</p>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click events
        document.querySelectorAll('.friend-item-modal').forEach(item => {
            item.addEventListener('click', function() {
                const friendId = this.dataset.friendId;
                const friendName = this.querySelector('h4').textContent;
                closeModal();
                openChat(friendId, friendName);
            });
        });
        
    } catch (error) {
        console.error("Error loading friends for modal:", error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <p>Error loading friends</p>
            </div>
        `;
    }
}

// Search friends for new chat
async function searchFriendsForNewChat() {
    const searchInput = document.getElementById('newChatSearch');
    const container = document.getElementById('friendsListModal');
    
    if (!searchInput || !container) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    try {
        // Get user's friends
        const { data: friends } = await supabaseClient
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);
        
        if (!friends || friends.length === 0) return;
        
        const friendIds = friends.map(f => f.friend_id);
               // Search in profiles
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, username, full_name, status')
            .in('id', friendIds)
            .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
        
        if (!profiles || profiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>No friends match your search</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        profiles.forEach(profile => {
            const isOnline = profile.status === 'online';
            
            html += `
                <div class="friend-item-modal" data-friend-id="${profile.id}">
                    <div class="friend-avatar-modal">
                        ${profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div class="friend-info-modal">
                        <h4>${profile.username || 'Unknown User'}</h4>
                        <p>${isOnline ? 'Online' : 'Offline'}</p>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click events
        document.querySelectorAll('.friend-item-modal').forEach(item => {
            item.addEventListener('click', function() {
                const friendId = this.dataset.friendId;
                const friendName = this.querySelector('h4').textContent;
                closeModal();
                openChat(friendId, friendName);
            });
        });
        
    } catch (error) {
        console.error("Error searching friends:", error);
    }
}

// Handle logout
async function handleLogout() {
    try {
        // Clean up real-time subscriptions
        if (realtimeSubscription) {
            Object.values(realtimeSubscription).forEach(channel => {
                if (channel) channel.unsubscribe();
            });
        }
        
        // Sign out
        await supabaseClient.auth.signOut();
        
        // Clear session storage
        sessionStorage.clear();
        
        // Redirect to login
        window.location.href = '../../auth/index.html';
        
    } catch (error) {
        console.error("Error logging out:", error);
        showError("Error logging out. Please try again.");
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initHomePage);

// Make functions available globally
window.openChat = openChat;
window.closeModal = closeModal;
window.openNewChatModal = openNewChatModal;