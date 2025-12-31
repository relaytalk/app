// Home Page Script - UPDATED WITH FIXES
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Luster Home Page Loaded");

// Current user
let currentUser = null;
let currentProfile = null;

// Initialize home page
async function initHomePage() {
    console.log("Initializing home page...");

    // Check if user is logged in
    const { success, user } = await auth.getCurrentUser();

    if (!success || !user) {
        alert("Please login first!");
        window.location.href = '../auth/index.html';
        return;
    }

    currentUser = user;
    console.log("Logged in as:", currentUser.email);

    // Get user profile
    await loadUserProfile();

    // Update UI
    updateWelcomeMessage();
    await loadFriends();
    await updateNotificationsBadge();

    // Set up event listeners
    setupEventListeners();

    console.log("Home page initialized for:", currentProfile?.username);
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
        console.log("Profile loaded:", profile);

    } catch (error) {
        console.error("Error loading profile:", error);
        currentProfile = {
            username: currentUser.user_metadata?.username || 'User',
            full_name: currentUser.user_metadata?.full_name || 'User',
            avatar_url: currentUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=User&background=random`
        };
    }
}

// Update welcome message
function updateWelcomeMessage() {
    if (!currentProfile) return;

    const welcomeElement = document.getElementById('welcomeTitle');
    if (welcomeElement) {
        welcomeElement.textContent = `Welcome, ${currentProfile.username}!`;
    }

    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar && currentProfile.avatar_url) {
        userAvatar.src = currentProfile.avatar_url;
    }
}

// Load friends list
async function loadFriends() {
    if (!currentUser) return;

    console.log("Loading friends for user:", currentUser.id);

    const container = document.getElementById('friendsList');
    if (!container) return;

    try {
        // Get friends
        const { data: friends, error } = await supabase
            .from('friends')
            .select(`
                friend_id,
                profiles:friend_id (
                    username,
                    full_name,
                    avatar_url,
                    status,
                    last_seen
                )
            `)
            .eq('user_id', currentUser.id);

        if (error) {
            console.log("Friends query error (table might not exist yet):", error.message);
            showEmptyFriends(container);
            return;
        }

        console.log("Found friends:", friends?.length || 0);

        if (!friends || friends.length === 0) {
            showEmptyFriends(container);
            return;
        }

        let html = '';
        friends.forEach(friend => {
            const profile = friend.profiles;
            if (!profile) return;

            const isOnline = profile.status === 'online';
            const lastSeen = profile.last_seen ? new Date(profile.last_seen) : new Date();
            const timeAgo = getTimeAgo(lastSeen);
            const firstLetter = profile.username ? profile.username.charAt(0).toUpperCase() : '?';

            html += `
                <div class="friend-card" onclick="openChat('${friend.friend_id}')">
                    <div class="friend-avatar" style="background: linear-gradient(45deg, #667eea, #764ba2);">
                        ${firstLetter}
                    </div>
                    <div class="friend-info">
                        <div class="friend-name">${profile.username || 'Unknown User'}</div>
                        <div class="friend-status">
                            <span class="status-dot ${isOnline ? '' : 'offline'}"></span>
                            ${isOnline ? 'Online' : 'Last seen ' + timeAgo}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading friends:", error);
        showEmptyFriends(container);
    }
}

function showEmptyFriends(container) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <p>No friends yet</p>
            <p style="font-size: 0.9rem; margin-top: 10px;">Search for users to add friends</p>
        </div>
    `;
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
    if (diffDays < 30) return `${Math.floor(diffDays/7)}w ago`;
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Open chat with friend - SIMPLIFIED VERSION
async function openChat(friendId) {
    console.log("Opening chat with friend:", friendId);

    try {
        // SIMPLE: Create new conversation every time
        const { data: newConversation, error: createError } = await supabase
            .from('conversations')
            .insert({ is_group: false })
            .select()
            .single();

        if (createError) {
            console.error("Error creating conversation:", createError);
            
            // Create conversations table if doesn't exist
            if (createError.message.includes('relation "conversations" does not exist')) {
                alert("Chat feature not set up yet. Creating tables...");
                await setupChatTables();
                openChat(friendId); // Retry
                return;
            }
            throw createError;
        }

        const conversationId = newConversation.id;
        console.log("Created conversation:", conversationId);

        // Add participants
        const { error: participantError } = await supabase
            .from('participants')
            .insert([
                { conversation_id: conversationId, user_id: currentUser.id },
                { conversation_id: conversationId, user_id: friendId }
            ]);

        if (participantError) throw participantError;

        // Redirect to chat page
        window.location.href = `../chats/index.html?conversation=${conversationId}`;

    } catch (error) {
        console.error("Error opening chat:", error);
        alert("Chat feature not ready yet. Please try again later.");
    }
}

// Setup chat tables if they don't exist
async function setupChatTables() {
    try {
        // Create conversations table
        const { error: convError } = await supabase.rpc('create_conversations_table');
        if (convError && !convError.message.includes('already exists')) {
            console.error("Error creating conversations table:", convError);
        }

        // Create participants table
        const { error: partError } = await supabase.rpc('create_participants_table');
        if (partError && !partError.message.includes('already exists')) {
            console.error("Error creating participants table:", partError);
        }

        console.log("Chat tables created/verified");
    } catch (error) {
        console.error("Error setting up tables:", error);
    }
}

// Update notifications badge
async function updateNotificationsBadge() {
    try {
        const { data: notifications, error } = await supabase
            .from('friend_requests')
            .select('*')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) {
            console.log("Friend requests table might not exist:", error.message);
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
    if (badge) badge.style.display = 'none';
}

// Open search modal
function openSearch() {
    document.getElementById('searchModal').style.display = 'flex';
    loadSearchResults();
}

// Open notifications modal
function openNotifications() {
    document.getElementById('notificationsModal').style.display = 'flex';
    loadNotifications();
}

// Close modal
function closeModal() {
    document.getElementById('searchModal').style.display = 'none';
    document.getElementById('notificationsModal').style.display = 'none';
}

// Load search results
async function loadSearchResults() {
    const container = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchInput');

    try {
        const { data: allUsers, error } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .neq('id', currentUser.id);

        if (error) throw error;

        if (!allUsers || allUsers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <p>No other users found</p>
                </div>
            `;
            return;
        }

        await displaySearchResults(allUsers);

        searchInput.oninput = async function() {
            const searchTerm = this.value.toLowerCase().trim();
            if (searchTerm === '') {
                await displaySearchResults(allUsers);
                return;
            }

            const filteredUsers = allUsers.filter(user => 
                user.username.toLowerCase().includes(searchTerm) ||
                (user.full_name && user.full_name.toLowerCase().includes(searchTerm))
            );
            await displaySearchResults(filteredUsers);
        };

        searchInput.focus();

    } catch (error) {
        console.error("Error loading users:", error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>Error loading users</p>
            </div>
        `;
    }
}

// Display search results
async function displaySearchResults(users) {
    const container = document.getElementById('searchResults');

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
        // Check friends
        const { data: friends, error: friendError } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        const friendIds = friends?.map(f => f.friend_id) || [];

        // Check pending requests
        const { data: pendingRequests, error: requestError } = await supabase
            .from('friend_requests')
            .select('receiver_id, status')
            .eq('sender_id', currentUser.id)
            .eq('status', 'pending');

        const pendingIds = pendingRequests?.map(r => r.receiver_id) || [];

        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const requestSent = pendingIds.includes(user.id);

            html += `
                <div class="search-result">
                    <div class="search-avatar" style="background: linear-gradient(45deg, #667eea, #764ba2);">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="search-info">
                        <div class="search-name">${user.username}</div>
                        <div class="search-username">${user.full_name || ''}</div>
                    </div>
                    ${isFriend ? `
                        <button class="send-request-btn sent" disabled>
                            ✓ Friend
                        </button>
                    ` : requestSent ? `
                        <button class="send-request-btn sent" disabled>
                            ✓ Sent
                        </button>
                    ` : `
                        <button class="send-request-btn" onclick="sendFriendRequest('${user.id}', '${user.username}')">
                            Add Friend
                        </button>
                    `}
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error checking friend status:", error);
    }
}

// Send friend request - FIXED VERSION
async function sendFriendRequest(toUserId, toUsername) {
    if (!currentUser) return;

    try {
        // Check if request already exists
        const { data: existingRequest, error: checkError } = await supabase
            .from('friend_requests')
            .select('*')
            .eq('sender_id', currentUser.id)
            .eq('receiver_id', toUserId)
            .eq('status', 'pending')
            .maybeSingle();

        if (existingRequest) {
            alert(`Friend request already sent to ${toUsername}!`);
            return;
        }

        // Create friend request
        const { error } = await supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: toUserId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        if (error) {
            // If table doesn't exist, create it
            if (error.message.includes('relation "friend_requests" does not exist')) {
                await createFriendRequestsTable();
                await sendFriendRequest(toUserId, toUsername); // Retry
                return;
            }
            throw error;
        }

        // Update UI
        loadSearchResults();
        updateNotificationsBadge();

        alert(`Friend request sent to ${toUsername}!`);

    } catch (error) {
        console.error("Error sending friend request:", error);
        alert("Could not send friend request. Please try again.");
    }
}

// Create friend_requests table if it doesn't exist
async function createFriendRequestsTable() {
    console.log("Creating friend_requests table...");
    
    // Run SQL to create table
    const { error } = await supabase.rpc('create_friend_requests_table');
    
    if (error) {
        console.error("Error creating table:", error);
        // Fallback: Try direct SQL (if you have service role)
        alert("Setting up database... Please refresh and try again.");
    }
}

// Load notifications - SIMPLIFIED
async function loadNotifications() {
    const container = document.getElementById('notificationsList');

    try {
        const { data: notifications, error } = await supabase
            .from('friend_requests')
            .select(`
                id,
                sender_id,
                created_at,
                profiles:sender_id (
                    username
                )
            `)
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.log("Notifications error (table might not exist):", error.message);
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
            const senderName = notification.profiles?.username || 'Unknown User';

            html += `
                <div class="notification-item">
                    <div class="notification-avatar">
                        ${senderName.charAt(0).toUpperCase()}
                    </div>
                    <div class="notification-content">
                        <strong>${senderName}</strong> wants to be friends
                        <small>${timeAgo}</small>
                    </div>
                    <div class="notification-actions">
                        <button class="btn-small btn-success" onclick="acceptFriendRequest('${notification.id}', '${notification.sender_id}')">
                            ✓
                        </button>
                        <button class="btn-small btn-danger" onclick="declineFriendRequest('${notification.id}')">
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

// Accept friend request - FIXED VERSION
async function acceptFriendRequest(requestId, senderId) {
    console.log("Accepting request:", requestId, "from:", senderId);

    try {
        // 1. Update friend request status
        const { error: updateError } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (updateError) {
            console.error("Error updating request:", updateError);
            throw updateError;
        }

        // 2. Add to friends table (both directions)
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
            console.error("Friend errors:", friendError1, friendError2);
            
            // If friends table doesn't exist, create it
            if (friendError1?.message.includes('relation "friends" does not exist') ||
                friendError2?.message.includes('relation "friends" does not exist')) {
                await createFriendsTable();
                await acceptFriendRequest(requestId, senderId); // Retry
                return;
            }
            throw friendError1 || friendError2;
        }

        // 3. Update UI
        await loadNotifications();
        await loadFriends();
        await updateNotificationsBadge();

        alert(`You are now friends!`);

    } catch (error) {
        console.error("Error accepting friend request:", error);
        alert("Could not accept friend request. The database might need setup.");
    }
}

// Create friends table if it doesn't exist
async function createFriendsTable() {
    console.log("Creating friends table...");
    const { error } = await supabase.rpc('create_friends_table');
    if (error) {
        console.error("Error creating friends table:", error);
    }
}

// Decline friend request
async function declineFriendRequest(requestId) {
    try {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (error) throw error;

        await loadNotifications();
        await updateNotificationsBadge();

        alert(`Friend request declined.`);

    } catch (error) {
        console.error("Error declining friend request:", error);
        alert("Could not decline friend request.");
    }
}

// Set up event listeners
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = '../auth/index.html';
            } catch (error) {
                console.error("Error logging out:", error);
                alert("Error logging out. Please try again.");
            }
        });
    }

    // Close modals when clicking outside
    window.onclick = function(event) {
        const searchModal = document.getElementById('searchModal');
        const notificationsModal = document.getElementById('notificationsModal');

        if (event.target === searchModal) {
            closeModal();
        }
        if (event.target === notificationsModal) {
            closeModal();
        }
    };

    // Escape key closes modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
}

// Make functions available globally
window.openSearch = openSearch;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);