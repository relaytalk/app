// Friends Page Script - WITH ABSOLUTE PATHS AND CALL FUNCTIONALITY
import { auth } from '/app/utils/auth.js'
import { supabase } from '/app/utils/supabase.js'

console.log("✨ Friends Page Loaded");

// ==================== ABSOLUTE PATHS CONFIGURATION ====================
const PATHS = {
    // Absolute paths from root
    HOME: '/app/pages/home/index.html',
    LOGIN: '/app/pages/login/index.html',  
    SIGNUP: '/app/pages/auth/index.html',
    CHATS: '/app/pages/chats/index.html',
    FRIENDS: '/app/pages/home/friends/index.html',
    PHONE: '/app/pages/phone/index.html',
    PHONE_CALL: '/app/pages/phone/call.html'
};
// ==================== END PATHS CONFIG ====================
import presenceTracker from '/app/utils/presence.js';

// In initFriendsPage():
async function initFriendsPage() {
    // ... auth code ...
    
    currentUser = user;
    
    // Start presence tracking
    await presenceTracker.start(currentUser.id);
    
    // ... rest of code ...
}







// Current user
let currentUser = null;
let currentProfile = null;
let allFriends = [];

// Toast Notification System
class ToastNotification {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.createToastContainer();
        }
    }

    createToastContainer() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.id = 'toastContainer';
        document.body.prepend(this.container);
    }

    show(options) {
        const { title = '', message = '', type = 'info', duration = 4000 } = options;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = type === 'success' ? '✨' : type === 'error' ? '❌' : '💬';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
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

    success(title, message = '') {
        return this.show({ title, message, type: 'success' });
    }

    error(title, message = '') {
        return this.show({ title, message, type: 'error' });
    }

    info(title, message = '') {
        return this.show({ title, message, type: 'info' });
    }
}

const toast = new ToastNotification();

// Initialize friends page
async function initFriendsPage() {
    console.log("Initializing friends page...");
    console.log("Using absolute paths:", PATHS);

    // Set up loading timeout safety
    const loadingTimeout = setTimeout(() => {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
            console.log("Safety timeout: Hid loading indicator");
        }
    }, 8000);

    try {
        const { success, user } = await auth.getCurrentUser();  

        if (!success || !user) {  
            clearTimeout(loadingTimeout);
            showLoginPrompt();
            return;  
        }  

        currentUser = user;  
        console.log("✅ Authenticated as:", currentUser.email);  

        // Load friends
        await loadFriendsList();

        // Set up search
        setupSearch();

        // Hide loading
        clearTimeout(loadingTimeout);
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

    } catch (error) {
        console.error("Init error:", error);
        clearTimeout(loadingTimeout);
        toast.error("Error", "Failed to load page");

        // Hide loading on error
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Show login prompt
function showLoginPrompt() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="login-prompt">
            <div class="login-icon">🔒</div>
            <h2 class="login-title">Login Required</h2>
            <p class="login-subtitle">Please login to view your friends and messages</p>
            <div class="login-buttons">
                <button class="login-btn" onclick="goToLogin()">
                    <i class="fas fa-sign-in-alt"></i> Login
                </button>
                <button class="signup-btn" onclick="goToSignup()">
                    <i class="fas fa-user-plus"></i> Sign Up
                </button>
            </div>
        </div>
    `;

    // Hide loading
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// ==================== NAVIGATION USING ABSOLUTE PATHS ====================

function goToLogin() {
    window.location.href = PATHS.LOGIN;
}

function goToSignup() {
    window.location.href = PATHS.SIGNUP;
}

function goToHome() {
    window.location.href = PATHS.HOME;
}

function goToFriends() {
    window.location.href = PATHS.FRIENDS;
}

// Load friends list
async function loadFriendsList(searchTerm = '') {
    if (!currentUser) return;

    const container = document.getElementById('friendsContainer');  
    if (!container) return;  

    try {  
        // Show loading skeleton
        showLoadingSkeleton(container);

        // Get friend IDs  
        const { data: friends, error } = await supabase  
            .from('friends')  
            .select('friend_id')  
            .eq('user_id', currentUser.id);  

        if (error) throw error;  

        if (!friends || friends.length === 0) {  
            showEmptyFriends(container);  
            allFriends = [];
            return;  
        }  

        // Get profiles for each friend  
        const friendIds = friends.map(f => f.friend_id);  
        const { data: profiles, error: profilesError } = await supabase  
            .from('profiles')  
            .select('id, username, status, last_seen, avatar_url')  
            .in('id', friendIds);  

        if (profilesError) throw profilesError;  

        // Get unread message counts
        const unreadCounts = await getUnreadMessageCounts(friendIds);

        // Store all friends for search filtering
        allFriends = profiles.map(profile => ({
            ...profile,
            unreadCount: unreadCounts[profile.id] || 0
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
        updateFriendsStats(filteredFriends);

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

        displayFriendsCleanStyle(filteredFriends, container);

    } catch (error) {  
        console.error("Error loading friends:", error);  
        showErrorState(container, error.message);  
    }
}

// Show loading skeleton
function showLoadingSkeleton(container) {
    let html = '';
    for (let i = 0; i < 8; i++) {
        html += `
            <div class="friend-skeleton">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                    <div class="skeleton-name"></div>
                    <div class="skeleton-status"></div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// Get unread message counts
async function getUnreadMessageCounts(friendIds) {
    const unreadCounts = {};

    try {
        const { data: unreadMessages, error } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('receiver_id', currentUser.id)
            .in('sender_id', friendIds)
            .eq('read', false);

        if (!error && unreadMessages) {
            unreadMessages.forEach(msg => {
                unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
            });
        }
    } catch (error) {
        console.log("Note: Could not load unread counts", error.message);
    }

    return unreadCounts;
}

// Update friends stats
function updateFriendsStats(friends) {
    const totalFriends = document.getElementById('totalFriends');
    const onlineFriends = document.getElementById('onlineFriends');

    if (totalFriends) totalFriends.textContent = friends.length;
    if (onlineFriends) {
        const onlineCount = friends.filter(f => f.status === 'online').length;
        onlineFriends.textContent = onlineCount;
    }
}

// Display friends in CLEAN style WITH CALL BUTTONS
function displayFriendsCleanStyle(friends, container) {
    // Sort: online first, then by unread count, then by name
    friends.sort((a, b) => {
        // Online first
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;

        // More unread messages first
        if (a.unreadCount > b.unreadCount) return -1;
        if (a.unreadCount < b.unreadCount) return 1;

        // Alphabetical
        return a.username.localeCompare(b.username);
    });

    let html = '';  
    friends.forEach(friend => {  
        const isOnline = friend.status === 'online';  
        const lastSeen = friend.last_seen ? new Date(friend.last_seen) : new Date();  
        const timeAgo = getTimeAgo(lastSeen);  

        // Get ONLY FIRST LETTER (uppercase)
        const firstLetter = friend.username ? friend.username.charAt(0).toUpperCase() : '?';  

        // Simple avatar color
        const avatarColor = '#667eea';

        // Phone icon SVG
        const phoneIconSVG = `<svg class="phone-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="white" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
        </svg>`;

        html += `  
            <div class="friend-item-clean" onclick="openChat('${friend.id}', '${friend.username}')">  
                <div class="friend-avatar-clean" style="background: ${avatarColor};">  
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
                    <div class="friend-actions" style="display: flex; align-items: center; gap: 10px;">
                        ${friend.unreadCount > 0 ? `  
                            <div class="unread-badge-clean">  
                                ${friend.unreadCount > 9 ? '9+' : friend.unreadCount}  
                            </div>  
                        ` : ''}
                        <button class="call-button ${isOnline ? '' : 'offline'}" 
                                onclick="startCall('${friend.id}', '${friend.username}', event)"
                                ${!isOnline ? 'disabled' : ''}
                                title="${isOnline ? 'Call ' + friend.username : 'Friend is offline'}">
                            ${phoneIconSVG}
                        </button>
                    </div>
                </div>  
            </div>  
        `;  
    });  

    container.innerHTML = html;  
}

function showEmptyFriends(container) {
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

function showErrorState(container, errorMessage) {
    container.innerHTML = `  
        <div class="empty-state">  
            <div class="empty-icon">⚠️</div>  
            <h3 class="empty-title">Connection Error</h3>  
            <p class="empty-desc">${errorMessage || 'Could not load friends'}</p>  
            <button class="search-btn" onclick="loadFriendsList()" style="margin-top: 20px;">
                <i class="fas fa-sync"></i> Try Again
            </button>
        </div>  
    `;
}

// ==================== CALL FUNCTIONALITY ====================

// Start a call with friend
async function startCall(friendId, friendName, event) {
    if (event) {
        event.stopPropagation(); // Prevent opening chat
        event.preventDefault();
    }
    
    const isOnline = await checkFriendOnline(friendId);
    
    if (!isOnline) {
        toast.info("Friend Offline", `${friendName} is currently offline`);
        return;
    }
    
    // Show call options modal
    showCallOptions(friendId, friendName);
}

// Check if friend is online
async function checkFriendOnline(friendId) {
    try {
        const { data: presence } = await supabase
            .from('user_presence')
            .select('is_online')
            .eq('user_id', friendId)
            .single();
            
        return presence?.is_online || false;
    } catch (error) {
        console.log("Error checking online status:", error);
        return false;
    }
}

// Show call options modal
function showCallOptions(friendId, friendName) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('callOptionsModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'callOptionsModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content call-options-modal">
                <div class="call-modal-header">
                    <div class="call-modal-avatar">${friendName.charAt(0).toUpperCase()}</div>
                    <div class="call-modal-info">
                        <h3>Call ${friendName}</h3>
                        <p>Choose call type</p>
                    </div>
                </div>
                
                <div class="call-modal-options">
                    <button class="call-option voice-call-option" onclick="initiateVoiceCall('${friendId}', '${friendName}')">
                        <i class="fas fa-phone"></i>
                        <span>Voice Call</span>
                    </button>
                    <button class="call-option video-call-option" onclick="initiateVideoCall('${friendId}', '${friendName}')">
                        <i class="fas fa-video"></i>
                        <span>Video Call</span>
                    </button>
                    <button class="call-option message-option" onclick="openChat('${friendId}', '${friendName}')">
                        <i class="fas fa-comment"></i>
                        <span>Send Message</span>
                    </button>
                </div>
                
                <div class="call-modal-actions">
                    <button class="modal-close-btn" onclick="closeCallOptions()">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add styles for call modal
        if (!document.querySelector('#callOptionsStyles')) {
            const styles = document.createElement('style');
            styles.id = 'callOptionsStyles';
            styles.textContent = `
                .call-options-modal {
                    max-width: 400px;
                    background: rgba(26, 26, 46, 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 20px;
                }
                
                .call-modal-header {
                    text-align: center;
                    padding: 30px 20px;
                }
                
                .call-modal-avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    margin: 0 auto 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: bold;
                    color: white;
                }
                
                .call-modal-info h3 {
                    color: white;
                    font-size: 1.5rem;
                    margin-bottom: 5px;
                }
                
                .call-modal-info p {
                    color: #a0a0c0;
                    font-size: 0.9rem;
                }
                
                .call-modal-options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 0 20px 20px;
                }
                
                .call-option {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 18px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 15px;
                    color: white;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    -webkit-tap-highlight-color: transparent;
                }
                
                .call-option:active {
                    background: rgba(255,255,255,0.1);
                    transform: scale(0.98);
                }
                
                .call-option i {
                    font-size: 1.3rem;
                }
                
                .voice-call-option i {
                    color: #4CAF50;
                }
                
                .video-call-option i {
                    color: #667eea;
                }
                
                .message-option i {
                    color: #FF9500;
                }
                
                .call-modal-actions {
                    padding: 20px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                
                .modal-close-btn {
                    width: 100%;
                    padding: 15px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 15px;
                    color: white;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    -webkit-tap-highlight-color: transparent;
                }
                
                .modal-close-btn:active {
                    background: rgba(255,255,255,0.1);
                    transform: scale(0.98);
                }
            `;
            document.head.appendChild(styles);
        }
    }
    
    // Update modal content
    modal.querySelector('.call-modal-avatar').textContent = friendName.charAt(0).toUpperCase();
    modal.querySelector('.call-modal-info h3').textContent = `Call ${friendName}`;
    
    // Update button onclick handlers
    modal.querySelector('.voice-call-option').onclick = () => initiateVoiceCall(friendId, friendName);
    modal.querySelector('.video-call-option').onclick = () => initiateVideoCall(friendId, friendName);
    modal.querySelector('.message-option').onclick = () => openChat(friendId, friendName);
    
    // Show modal
    modal.style.display = 'flex';
}

// Close call options modal
function closeCallOptions() {
    const modal = document.getElementById('callOptionsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initiate voice call
function initiateVoiceCall(friendId, friendName) {
    closeCallOptions();
    
    // Create call record in database
    createCallRecord(friendId, 'voice').then(callId => {
        if (callId) {
            // Navigate to call page
            window.location.href = `${PATHS.PHONE_CALL}?type=outgoing&callId=${callId}&contactId=${friendId}&name=${encodeURIComponent(friendName)}`;
        }
    });
}

// Initiate video call
function initiateVideoCall(friendId, friendName) {
    closeCallOptions();
    
    // Create call record in database
    createCallRecord(friendId, 'video').then(callId => {
        if (callId) {
            // Navigate to call page (with video flag)
            window.location.href = `${PATHS.PHONE_CALL}?type=outgoing&callId=${callId}&contactId=${friendId}&name=${encodeURIComponent(friendName)}&video=true`;
        }
    });
}

// Create call record in database
async function createCallRecord(friendId, callType) {
    if (!currentUser) return null;
    
    try {
        const roomId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const { data: call, error } = await supabase
            .from('calls')
            .insert({
                room_id: roomId,
                caller_id: currentUser.id,
                receiver_id: friendId,
                status: 'ringing',
                call_type: callType,
                initiated_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) throw error;
        
        // Send notification to friend
        sendCallNotification(friendId, call.id);
        
        toast.success("Calling", `Calling your friend...`);
        return call.id;
        
    } catch (error) {
        console.error("Error creating call record:", error);
        toast.error("Call Failed", "Could not initiate call");
        return null;
    }
}

// Send call notification to friend
async function sendCallNotification(friendId, callId) {
    try {
        // Create notification for friend
        await supabase
            .from('notifications')
            .insert({
                user_id: friendId,
                type: 'call',
                title: 'Incoming Call',
                body: `${currentUser.email?.split('@')[0] || 'Someone'} is calling you`,
                action_url: `${PATHS.PHONE_CALL}?type=incoming&callId=${callId}`,
                metadata: {
                    call_id: callId,
                    caller_id: currentUser.id,
                    call_type: 'voice'
                }
            });
            
    } catch (error) {
        console.log("Notification not sent:", error.message);
    }
}

// ==================== CHAT FUNCTIONALITY ====================

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

// Set up search functionality
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

// Open chat with friend
async function openChat(friendId, friendUsername = 'Friend') {
    console.log("Opening chat with:", friendId);

    // Mark messages as read when opening chat
    await markMessagesAsRead(friendId);

    // Store friend info
    sessionStorage.setItem('currentChatFriend', JSON.stringify({  
        id: friendId,  
        username: friendUsername  
    }));  

    // Use absolute path
    window.location.href = `${PATHS.CHATS}?friendId=${friendId}`;
}

// Mark messages as read
async function markMessagesAsRead(friendId) {
    try {
        await supabase
            .from('messages')
            .update({ read: true })
            .eq('receiver_id', currentUser.id)
            .eq('sender_id', friendId)
            .eq('read', false);

        // Update unread count locally
        const friend = allFriends.find(f => f.id === friendId);
        if (friend) {
            friend.unreadCount = 0;
            displayFriendsCleanStyle(allFriends, document.getElementById('friendsContainer'));
        }
    } catch (error) {
        console.log("Could not mark messages as read:", error.message);
    }
}

// ==================== MODAL FUNCTIONS ====================

// Search modal functions
function openSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        loadSearchResults();
    }
}

function openNotifications() {
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadNotifications();
    }
}

function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });
}

async function loadSearchResults() {
    try {
        if (!currentUser) return;

        const container = document.getElementById('searchResults');
        if (!container) return;

        // Get all users except current user
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username')
            .neq('id', currentUser.id)
            .limit(20);

        if (error) throw error;

        if (!users || users.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 30px 20px;">
                    <div class="empty-icon">👥</div>
                    <p>No users found</p>
                </div>
            `;
            return;
        }

        // Display users
        let html = '';
        users.forEach(user => {
            const firstLetter = user.username.charAt(0).toUpperCase();
            html += `
                <div class="search-result">
                    <div class="search-avatar" style="background: #667eea;">${firstLetter}</div>
                    <div class="search-info">
                        <div class="search-name">${user.username}</div>
                    </div>
                    <button class="send-request-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">
                        Add Friend
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Search error:", error);
        toast.error("Search", "Could not load users");
    }
}

async function sendFriendRequest(toUserId, toUsername, button) {
    if (!currentUser) return;

    button.textContent = 'Sending...';
    button.disabled = true;

    try {
        const { error } = await supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: toUserId,
                status: 'pending'
            });

        if (error) throw error;

        button.textContent = '✓ Sent';
        button.classList.add('sent');
        toast.success("Request Sent", `Friend request sent to ${toUsername}`);

    } catch (error) {
        console.error("Send request error:", error);
        button.textContent = 'Add Friend';
        button.disabled = false;
        toast.error("Error", "Could not send request");
    }
}

async function loadNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container || !currentUser) return;

    try {
        const { data: requests, error } = await supabase
            .from('friend_requests')
            .select('id, sender_id, created_at')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) throw error;

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
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', senderIds);

        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => profileMap[p.id] = p.username);
        }

        let html = '';
        requests.forEach(notification => {
            const senderName = profileMap[notification.sender_id] || 'Unknown';
            const firstLetter = senderName.charAt(0).toUpperCase();
            const timeAgo = getTimeAgo(new Date(notification.created_at));
            
            html += `  
                <div class="notification-item">  
                    <div class="notification-avatar" style="background: #667eea;">${firstLetter}</div>
                    <div class="notification-content">  
                        <div class="notification-text">  
                            <div class="notification-title">${senderName} wants to be friends</div>  
                            <div class="notification-time">${timeAgo}</div>  
                        </div>  
                        <div class="notification-actions">  
                            <button class="accept-btn" onclick="acceptRequest('${notification.id}', '${notification.sender_id}', this)">  
                                Accept  
                            </button>  
                            <button class="decline-btn" onclick="declineRequest('${notification.id}', this)">  
                                Decline  
                            </button>  
                        </div>  
                    </div>  
                </div>  
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Notifications error:", error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <div class="empty-icon">⚠️</div>
                <p>Error loading notifications</p>
            </div>
        `;
    }
}

async function acceptRequest(requestId, senderId, button) {
    button.textContent = 'Accepting...';
    button.disabled = true;

    try {
        // Update request status
        await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        // Add to friends table
        await supabase
            .from('friends')
            .insert([
                { user_id: currentUser.id, friend_id: senderId },
                { user_id: senderId, friend_id: currentUser.id }
            ]);

        button.textContent = '✓ Accepted';
        toast.success("Friend Added", "You are now friends!");

        // Reload friends list
        setTimeout(() => {
            loadFriendsList();
            loadNotifications();
        }, 1000);

    } catch (error) {
        console.error("Accept error:", error);
        button.textContent = 'Accept';
        button.disabled = false;
        toast.error("Error", "Could not accept request");
    }
}

async function declineRequest(requestId, button) {
    button.textContent = 'Declining...';
    button.disabled = true;

    try {
        await supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        button.textContent = '✗ Declined';
        toast.info("Request Declined", "Friend request declined");

        setTimeout(() => loadNotifications(), 500);

    } catch (error) {
        console.error("Decline error:", error);
        button.textContent = 'Decline';
        button.disabled = false;
        toast.error("Error", "Could not decline request");
    }
}

// ==================== GLOBAL FUNCTIONS ====================

window.goToHome = goToHome;
window.goToFriends = goToFriends;
window.goToLogin = goToLogin;
window.goToSignup = goToSignup;
window.openSearchModal = openSearchModal;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptRequest = acceptRequest;
window.declineRequest = declineRequest;

// Call functions
window.startCall = startCall;
window.showCallOptions = showCallOptions;
window.closeCallOptions = closeCallOptions;
window.initiateVoiceCall = initiateVoiceCall;
window.initiateVideoCall = initiateVideoCall;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initFriendsPage);