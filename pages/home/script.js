// Home Page Script - UPDATED FOR SUPABASE
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Luster Home Page Loaded (Supabase Version)");

// Current user
let currentUser = null;
let currentProfile = null;

// Initialize home page
async function initHomePage() {
    console.log("Initializing home page with Supabase...");

    // Check if user is logged in with Supabase
    const { success, user } = await auth.getCurrentUser();
    
    if (!success || !user) {
        // No user found, redirect to auth
        alert("Please login first!");
        window.location.href = '../auth/index.html';
        return;
    }

    currentUser = user;
    console.log("Logged in as:", currentUser.email);

    // Get user profile from database
    await loadUserProfile();
    
    // Update UI with user data
    updateWelcomeMessage();
    await loadFriends();
    await updateNotificationsBadge();

    // Set up event listeners
    setupEventListeners();

    // Listen for real-time updates
    setupRealtimeListeners();

    console.log("Home page initialized for:", currentProfile?.username);
}

// Load user profile from Supabase
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
        // Create basic profile if not exists
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

    // Update welcome title
    const welcomeElement = document.getElementById('welcomeTitle');
    if (welcomeElement) {
        welcomeElement.textContent = `Welcome, ${currentProfile.username}!`;
    }
    
    // Update user avatar if exists
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar && currentProfile.avatar_url) {
        userAvatar.src = currentProfile.avatar_url;
    }
}

// Load friends list from Supabase
async function loadFriends() {
    if (!currentUser) return;

    console.log("Loading friends for user:", currentUser.id);

    const container = document.getElementById('friendsList');
    if (!container) return;

    try {
        // Get friends from Supabase (from friends table)
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

        if (error) throw error;

        console.log("Found friends:", friends?.length || 0);

        if (!friends || friends.length === 0) {
            // Show empty state
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <p>No friends yet</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Search for users to add friends</p>
                </div>
            `;
            return;
        }

        let html = '';
        friends.forEach(friend => {
            const profile = friend.profiles;
            if (!profile) return;

            console.log("Processing friend:", profile.username);

            // Check online status
            const isOnline = profile.status === 'online';
            const lastSeen = profile.last_seen ? new Date(profile.last_seen) : new Date();
            const timeAgo = getTimeAgo(lastSeen);

            // Get first letter for avatar
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
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>Error loading friends</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Please try again later</p>
            </div>
        `;
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
    if (diffDays < 30) return `${Math.floor(diffDays/7)}w ago`;
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Open chat with friend
async function openChat(friendId) {
    console.log("Opening chat with friend:", friendId);

    try {
        // Check if conversation exists or create one
        const { data: existingConversation, error: checkError } = await supabase
            .from('participants')
            .select('conversation_id')
            .eq('user_id', currentUser.id)
            .in('conversation_id', 
                supabase.from('participants')
                    .select('conversation_id')
                    .eq('user_id', friendId)
            )
            .single();

        let conversationId;

        if (checkError || !existingConversation) {
            // Create new conversation
            const { data: newConversation, error: createError } = await supabase
                .from('conversations')
                .insert({ is_group: false })
                .select()
                .single();

            if (createError) throw createError;

            conversationId = newConversation.id;

            // Add both users as participants
            await supabase.from('participants').insert([
                { conversation_id: conversationId, user_id: currentUser.id },
                { conversation_id: conversationId, user_id: friendId }
            ]);
        } else {
            conversationId = existingConversation.conversation_id;
        }

        // Redirect to chat page
        window.location.href = `../chat/index.html?conversation=${conversationId}`;
        
    } catch (error) {
        console.error("Error opening chat:", error);
        alert("Could not open chat. Please try again.");
    }
}

// Update notifications badge from Supabase
async function updateNotificationsBadge() {
    try {
        const { data: notifications, error } = await supabase
            .from('friend_requests')
            .select('*')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) throw error;

        const unreadCount = notifications?.length || 0;

        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
        
    } catch (error) {
        console.error("Error loading notifications:", error);
    }
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

// Load search results from Supabase
async function loadSearchResults() {
    const container = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchInput');

    try {
        // Get all users except current user
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

        // Display all users initially
        await displaySearchResults(allUsers);

        // Add search functionality
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

        // Focus on search input
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
        // Check which users are already friends
        const { data: friends, error } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        const friendIds = friends?.map(f => f.friend_id) || [];

        // Check pending friend requests
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

// Send friend request via Supabase
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
            .single();

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
                status: 'pending'
            });

        if (error) throw error;

        // Update UI
        loadSearchResults();
        updateNotificationsBadge();

        // Show success message
        alert(`Friend request sent to ${toUsername}!`);
        
    } catch (error) {
        console.error("Error sending friend request:", error);
        alert("Could not send friend request. Please try again.");
    }
}

// Load notifications from Supabase
async function loadNotifications() {
    const container = document.getElementById('notificationsList');

    try {
        const { data: notifications, error } = await supabase
            .from('friend_requests')
            .select(`
                *,
                sender:profiles!friend_requests_sender_id_fkey (
                    username,
                    full_name
                )
            `)
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }

        let html = '';
        notifications.forEach(notification => {
            const timeAgo = getTimeAgo(notification.created_at);

            html += `
                <div class="search-result">
                    <div class="search-avatar" style="background: linear-gradient(45deg, #667eea, #764ba2);">
                        ${notification.sender.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="search-info">
                        <div class="search-name">${notification.sender.username}</div>
                        <div class="search-username">Wants to be your friend</div>
                        <div style="color: #a0a0c0; font-size: 0.8rem; margin-top: 5px;">${timeAgo}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="accept-btn" onclick="acceptFriendRequest('${notification.id}', '${notification.sender_id}')">
                            Accept
                        </button>
                        <button class="decline-btn" onclick="declineFriendRequest('${notification.id}')">
                            Decline
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading notifications:", error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>Error loading notifications</p>
            </div>
        `;
    }
}

// Accept friend request
async function acceptFriendRequest(requestId, senderId) {
    try {
        // Update friend request status
        const { error: updateError } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // Add to friends table (both directions)
        const { error: friendError1 } = await supabase
            .from('friends')
            .insert({ user_id: currentUser.id, friend_id: senderId });

        const { error: friendError2 } = await supabase
            .from('friends')
            .insert({ user_id: senderId, friend_id: currentUser.id });

        if (friendError1 || friendError2) {
            throw friendError1 || friendError2;
        }

        // Update UI
        loadNotifications();
        loadFriends();
        updateNotificationsBadge();

        alert(`You are now friends!`);
        
    } catch (error) {
        console.error("Error accepting friend request:", error);
        alert("Could not accept friend request. Please try again.");
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

        // Update UI
        loadNotifications();
        updateNotificationsBadge();

        alert(`Friend request declined.`);
        
    } catch (error) {
        console.error("Error declining friend request:", error);
        alert("Could not decline friend request. Please try again.");
    }
}

// Setup realtime listeners
function setupRealtimeListeners() {
    // Listen for new friend requests
    supabase
        .channel('friend-requests')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${currentUser.id}` },
            () => {
                console.log("New friend request received!");
                updateNotificationsBadge();
            }
        )
        .subscribe();
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