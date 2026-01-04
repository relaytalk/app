// /app/pages/home/friends/script.js - COMPLETE WITH INCOMING CALLS
console.log("✨ Friends Page Loaded");

// ==================== PATHS CONFIG ====================
const PATHS = {
    HOME: '/app/pages/home/index.html',
    LOGIN: '/app/pages/login/index.html',  
    SIGNUP: '/app/pages/auth/index.html',
    CHATS: '/app/pages/chats/index.html',
    FRIENDS: '/app/pages/home/friends/index.html',
    PHONE: '/app/pages/phone/index.html',
    PHONE_CALL: '/app/pages/phone/call.html'
};

// ==================== INITIALIZE SUPABASE ====================
let supabase;
let auth;
let presenceTracker;

async function initializeModules() {
    try {
        // Get supabase from window
        if (window.supabase) {
            supabase = window.supabase;
            console.log("✅ Using window.supabase");
        } else {
            const supabaseModule = await import('/app/utils/supabase.js');
            supabase = supabaseModule.supabase;
            console.log("✅ Loaded supabase from module");
        }
        
        const authModule = await import('/app/utils/auth.js');
        auth = authModule.auth;
        
        const presenceModule = await import('/app/utils/presence.js');
        presenceTracker = presenceModule.default;
        
        console.log("✅ All modules loaded");
        return true;
    } catch (error) {
        console.error("❌ Failed to load modules:", error);
        return false;
    }
}

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let allFriends = [];
let presenceChannel = null;
let incomingCallChannel = null;
let currentIncomingCall = null;

// ==================== TOAST SYSTEM ====================
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

    success(title, message = '') { return this.show({ title, message, type: 'success' }); }
    error(title, message = '') { return this.show({ title, message, type: 'error' }); }
    info(title, message = '') { return this.show({ title, message, type: 'info' }); }
}

const toast = new ToastNotification();

// ==================== PAGE INITIALIZATION ====================
async function initFriendsPage() {
    console.log("🚀 Initializing friends page...");

    const loadingTimeout = setTimeout(() => {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }, 8000);

    try {
        const modulesLoaded = await initializeModules();
        if (!modulesLoaded) {
            toast.error("Error", "Failed to load app modules");
            return;
        }

        const { success, user } = await auth.getCurrentUser();  
        if (!success || !user) {  
            clearTimeout(loadingTimeout);
            showLoginPrompt();
            return;  
        }  

        currentUser = user;  
        console.log("✅ Authenticated as:", currentUser.email);  

        await presenceTracker.start(currentUser.id);
        await loadFriendsList();
        setupSearch();
        setupFriendPresenceListener();
        setupIncomingCallListener();

        clearTimeout(loadingTimeout);
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        // Fix buttons after load
        setTimeout(() => {
            fixAllCallButtons();
        }, 1000);

    } catch (error) {
        console.error("❌ Init error:", error);
        clearTimeout(loadingTimeout);
        toast.error("Error", "Failed to load page");
        
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// ==================== PRESENCE FUNCTIONS ====================
function setupFriendPresenceListener() {
    if (!currentUser || !allFriends.length) return;
    
    const friendIds = allFriends.map(f => f.id).join(',');
    if (!friendIds) return;
    
    presenceChannel = supabase
        .channel(`friends-presence-${currentUser.id}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'user_presence',
                filter: `user_id=in.(${friendIds})`
            },
            (payload) => {
                const friend = allFriends.find(f => f.id === payload.new.user_id);
                if (friend) {
                    friend.is_online = payload.new.is_online;
                    friend.last_seen = payload.new.last_seen;
                    updateFriendOnlineStatus(friend.id, payload.new.is_online);
                }
            }
        )
        .subscribe((status) => {
            console.log(`📡 Friend presence channel: ${status}`);
        });
}

function updateFriendOnlineStatus(friendId, isOnline) {
    const friendItems = document.querySelectorAll('.friend-item-clean');
    
    friendItems.forEach(item => {
        const avatar = item.querySelector('.friend-avatar-clean');
        const userId = avatar?.dataset?.userId;
        
        if (userId === friendId) {
            const statusIndicator = item.querySelector('.status-indicator-clean');
            const statusText = item.querySelector('.friend-status-clean');
            const callButton = item.querySelector('.call-button');
            
            if (statusIndicator) {
                statusIndicator.className = `status-indicator-clean ${isOnline ? 'online' : 'offline'}`;
            }
            
            if (statusText) {
                statusText.textContent = isOnline ? 'Online' : getTimeAgo(new Date());
            }
            
            if (callButton) {
                callButton.classList.toggle('offline', !isOnline);
                callButton.title = isOnline ? 
                    `Call ${item.querySelector('.friend-name-clean')?.textContent}` : 
                    `Call ${item.querySelector('.friend-name-clean')?.textContent} (offline - will ring when back online)`;
            }
        }
    });
}

// ==================== INCOMING CALL NOTIFICATION SYSTEM ====================
function setupIncomingCallListener() {
    if (!currentUser) return;
    
    console.log("🔔 Setting up incoming call listener for user:", currentUser.id);
    
    // 1. Listen for real-time call invitations
    incomingCallChannel = supabase
        .channel(`call-invitations-${currentUser.id}`)
        .on('broadcast', { event: 'call_invitation' }, (payload) => {
            console.log("📨 Received call invitation:", payload);
            handleIncomingCall(payload.payload);
        })
        .on('broadcast', { event: 'call_cancelled' }, (payload) => {
            console.log("📞 Call cancelled:", payload);
            if (currentIncomingCall && currentIncomingCall.callId === payload.payload.callId) {
                hideIncomingCallNotification();
                toast.info("Call Ended", "Caller hung up");
            }
        })
        .subscribe((status) => {
            console.log(`📡 Call invitation channel: ${status}`);
        });
    
    // 2. Also listen for database changes (backup)
    supabase
        .channel(`db-calls-${currentUser.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, async (payload) => {
            const call = payload.new;
            if (call.status === 'ringing') {
                console.log("📞 Database call detected:", call);
                await showIncomingCallFromDB(call);
            }
        })
        .subscribe();
}

async function showIncomingCallFromDB(call) {
    try {
        const { data: caller } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', call.caller_id)
            .single();
        
        if (caller) {
            const callData = {
                callId: call.id,
                callerId: call.caller_id,
                callerUsername: caller.username,
                callerAvatar: caller.avatar_url,
                roomId: call.room_id,
                callType: call.call_type,
                timestamp: Date.now(),
                isInitiator: false
            };
            
            showIncomingCallNotification(callData);
        }
    } catch (error) {
        console.error("Error showing incoming call from DB:", error);
    }
}

function handleIncomingCall(callData) {
    console.log("🔔 Handling incoming call:", callData);
    currentIncomingCall = callData;
    showIncomingCallNotification(callData);
}

function showIncomingCallNotification(callData) {
    hideIncomingCallNotification();
    
    console.log("🔔 Showing incoming call notification for:", callData.callerUsername);
    
    const notification = document.createElement('div');
    notification.id = 'incomingCallNotification';
    notification.className = 'incoming-call-notification';
    
    const firstLetter = callData.callerUsername.charAt(0).toUpperCase();
    
    notification.innerHTML = `
        <div class="call-notification-content">
            <div class="caller-avatar-notification">${firstLetter}</div>
            <div class="call-notification-info">
                <div class="caller-name-notification">${callData.callerUsername}</div>
                <div class="call-status-notification">Incoming ${callData.callType || 'voice'} call...</div>
            </div>
            <div class="call-notification-actions">
                <button class="accept-call-btn" onclick="acceptIncomingCall('${callData.callId}')">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="decline-call-btn" onclick="declineIncomingCall('${callData.callId}')">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
        <audio id="incomingCallRingtone" loop>
            <source src="https://assets.mixkit.co/active_storage/sfx/266/266-preview.mp3" type="audio/mpeg">
        </audio>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        .incoming-call-notification {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 26, 46, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(102, 126, 234, 0.3);
            border-radius: 20px;
            padding: 20px;
            width: 90%;
            max-width: 400px;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease;
        }
        
        @keyframes slideDown {
            from { transform: translate(-50%, -100%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
        
        .call-notification-content {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .caller-avatar-notification {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(45deg, #667eea, #764ba2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            font-weight: bold;
            color: white;
            flex-shrink: 0;
        }
        
        .call-notification-info {
            flex-grow: 1;
        }
        
        .caller-name-notification {
            font-size: 1.2rem;
            font-weight: 600;
            color: white;
            margin-bottom: 5px;
        }
        
        .call-status-notification {
            font-size: 0.9rem;
            color: #a0a0c0;
        }
        
        .call-notification-actions {
            display: flex;
            gap: 10px;
            flex-shrink: 0;
        }
        
        .accept-call-btn, .decline-call-btn {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            color: white;
            font-size: 1.2rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }
        
        .accept-call-btn:active, .decline-call-btn:active {
            transform: scale(0.95);
        }
        
        .accept-call-btn {
            background: linear-gradient(45deg, #4cd964, #5ac8fa);
        }
        
        .decline-call-btn {
            background: linear-gradient(45deg, #ff3b30, #ff5e3a);
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    const ringtone = document.getElementById('incomingCallRingtone');
    if (ringtone) {
        ringtone.volume = 0.5;
        ringtone.play().catch(e => console.log("Could not play ringtone:", e));
    }
    
    setTimeout(() => {
        if (document.getElementById('incomingCallNotification')) {
            autoDeclineCall(callData.callId);
        }
    }, 30000);
}

function hideIncomingCallNotification() {
    const notification = document.getElementById('incomingCallNotification');
    if (notification) notification.remove();
    
    const ringtone = document.getElementById('incomingCallRingtone');
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    
    currentIncomingCall = null;
}

window.acceptIncomingCall = async function(callId) {
    console.log("✅ Accepting call:", callId);
    
    if (!callId) {
        toast.error("Error", "No call ID provided");
        return;
    }
    
    try {
        const { error } = await supabase
            .from('calls')
            .update({
                status: 'active',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', callId);
        
        if (error) throw error;
        
        hideIncomingCallNotification();
        
        const callData = {
            callId: callId,
            isInitiator: false,
            timestamp: Date.now()
        };
        
        sessionStorage.setItem('incomingCall', JSON.stringify(callData));
        window.location.href = `${PATHS.PHONE_CALL}?call=${callId}&incoming=true`;
        
    } catch (error) {
        console.error("❌ Error accepting call:", error);
        toast.error("Error", "Failed to accept call");
        hideIncomingCallNotification();
    }
};

window.declineIncomingCall = async function(callId) {
    console.log("❌ Declining call:", callId);
    
    try {
        const { error } = await supabase
            .from('calls')
            .update({
                status: 'rejected',
                ended_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', callId);
        
        if (error) throw error;
        
        if (currentIncomingCall) {
            await supabase
                .channel(`call-invitations-${currentIncomingCall.callerId}`)
                .send({
                    type: 'broadcast',
                    event: 'call_cancelled',
                    payload: {
                        callId: callId,
                        reason: 'rejected'
                    }
                });
        }
        
        toast.info("Call Declined", "You declined the call");
        
    } catch (error) {
        console.error("Error declining call:", error);
    } finally {
        hideIncomingCallNotification();
    }
};

async function autoDeclineCall(callId) {
    console.log("⏰ Auto-declining call:", callId);
    
    try {
        await supabase
            .from('calls')
            .update({
                status: 'missed',
                ended_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', callId);
        
        if (currentIncomingCall) {
            await supabase
                .channel(`call-invitations-${currentIncomingCall.callerId}`)
                .send({
                    type: 'broadcast',
                    event: 'call_cancelled',
                    payload: {
                        callId: callId,
                        reason: 'missed'
                    }
                });
        }
        
    } catch (error) {
        console.error("Error auto-declining call:", error);
    } finally {
        hideIncomingCallNotification();
    }
}

// ==================== FIX ALL CALL BUTTONS ====================
function fixAllCallButtons() {
    console.log("🔧 Fixing all call buttons...");
    
    document.querySelectorAll('.call-button').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('onclick');
        
        btn.addEventListener('click', function(e) {
            handleCallButtonClick(this, e);
        });
        
        const friendName = btn.closest('.friend-item-clean')?.querySelector('.friend-name-clean')?.textContent;
        if (friendName) {
            btn.title = `Call ${friendName}`;
        }
    });
    
    console.log("✅ All call buttons fixed and enabled!");
}

function handleCallButtonClick(button, event) {
    event.stopPropagation();
    event.preventDefault();
    
    const friendItem = button.closest('.friend-item-clean');
    const friendId = friendItem?.querySelector('.friend-avatar-clean')?.dataset?.userId;
    const friendName = friendItem?.querySelector('.friend-name-clean')?.textContent;
    const isOnline = !button.classList.contains('offline');
    
    console.log("📞 Call button clicked:", { friendName, friendId, isOnline });
    
    if (!friendId || !friendName) {
        toast.error("Error", "Could not find friend information");
        return;
    }
    
    if (isOnline) {
        toast.info("Calling", `Starting call with ${friendName}...`);
    } else {
        toast.info("Calling", `Calling ${friendName} (offline - they'll see missed call when back online)`);
    }
    
    startCallDirect(friendId, friendName, isOnline);
}

// ==================== DIRECT CALL FUNCTION ====================
async function startCallDirect(friendId, friendName, isOnline) {
    try {
        const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const { data: call, error } = await supabase
            .from('calls')
            .insert({
                room_id: roomId,
                caller_id: currentUser.id,
                receiver_id: friendId,
                call_type: 'voice',
                status: isOnline ? 'ringing' : 'missed',
                initiated_at: new Date().toISOString(),
                ended_at: !isOnline ? new Date().toISOString() : null
            })
            .select()
            .single();
        
        if (error) console.error("Call creation error:", error);
        
        // ✅ CRITICAL: Send real-time invitation to friend
        if (isOnline) {
            try {
                // Get caller username
                const { data: callerProfile } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', currentUser.id)
                    .single();
                
                await supabase
                    .channel(`call-invitations-${friendId}`)
                    .send({
                        type: 'broadcast',
                        event: 'call_invitation',
                        payload: {
                            callId: call?.id,
                            roomId: roomId,
                            callerId: currentUser.id,
                            callerUsername: callerProfile?.username || currentUser.email,
                            callType: 'voice',
                            timestamp: Date.now()
                        }
                    });
                
                console.log("✅ Call invitation sent to:", friendId);
            } catch (inviteError) {
                console.log("Note: Could not send real-time invitation:", inviteError.message);
            }
        }
        
        const callData = {
            callId: call?.id,
            roomId: roomId,
            friendId: friendId,
            friendName: friendName,
            userId: currentUser.id,
            isOnline: isOnline,
            timestamp: Date.now(),
            isInitiator: true
        };
        
        sessionStorage.setItem('callData', JSON.stringify(callData));
        localStorage.setItem('callData', JSON.stringify(callData));
        
        console.log("📦 Call data stored:", callData);
        
        const callUrl = `${PATHS.PHONE_CALL}?friend=${friendId}&name=${encodeURIComponent(friendName)}&room=${roomId}&online=${isOnline}`;
        
        setTimeout(() => {
            window.location.href = callUrl;
        }, 500);
        
    } catch (error) {
        console.error("❌ Call failed:", error);
        toast.error("Call Failed", "Could not start call");
    }
}

// ==================== NAVIGATION ====================
window.goToLogin = () => window.location.href = PATHS.LOGIN;
window.goToSignup = () => window.location.href = PATHS.SIGNUP;
window.goToHome = () => window.location.href = PATHS.HOME;
window.goToFriends = () => window.location.href = PATHS.FRIENDS;
window.goToChats = () => window.location.href = PATHS.CHATS;

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
}

// ==================== CHAT FUNCTIONS ====================
window.openChat = async (friendId, friendUsername) => {
    console.log("💬 Opening chat with:", friendUsername, friendId);
    
    try {
        const friendData = {
            id: friendId,
            username: friendUsername,
            timestamp: Date.now()
        };
        
        sessionStorage.setItem('currentChatFriend', JSON.stringify(friendData));
        localStorage.setItem('currentChatFriend', JSON.stringify(friendData));
        
        const chatUrl = `${PATHS.CHATS}?friend=${friendId}&name=${encodeURIComponent(friendUsername)}`;
        window.location.href = chatUrl;
        
    } catch (error) {
        console.error("❌ Error opening chat:", error);
        toast.error("Error", "Failed to open chat");
    }
};

// ==================== MODAL FUNCTIONS ====================
window.openNotifications = () => {
    const modal = document.getElementById('notificationsModal');
    if (modal) modal.style.display = 'block';
};

window.closeModal = () => {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => modal.style.display = 'none');
};

// ==================== FRIEND LIST FUNCTIONS ====================
async function loadFriendsList(searchTerm = '') {
    if (!currentUser) return;
    
    const container = document.getElementById('friendsContainer');  
    if (!container) return;  
    
    try {  
        showLoadingSkeleton(container);
        
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
        
        const friendIds = friends.map(f => f.friend_id);  
        const { data: profiles, error: profilesError } = await supabase  
            .from('profiles')  
            .select('id, username, avatar_url')  
            .in('id', friendIds);  
        
        if (profilesError) throw profilesError;  
        
        const presencePromises = profiles.map(async (profile) => {
            try {
                const status = await presenceTracker.checkOnlineStatus(profile.id);
                return { 
                    ...profile, 
                    is_online: status.online,
                    last_seen: status.lastSeen 
                };
            } catch {
                return { 
                    ...profile, 
                    is_online: false,
                    last_seen: null 
                };
            }
        });
        
        const profilesWithPresence = await Promise.all(presencePromises);
        const unreadCounts = await getUnreadMessageCounts(friendIds);
        
        allFriends = profilesWithPresence.map(profile => ({
            ...profile,
            unreadCount: unreadCounts[profile.id] || 0
        }));
        
        let filteredFriends = allFriends;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredFriends = allFriends.filter(friend => 
                friend.username.toLowerCase().includes(term)
            );
        }
        
        updateFriendsStats(filteredFriends);
        
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

function showLoadingSkeleton(container) {
    let html = '';
    for (let i = 0; i < 6; i++) {
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

function updateFriendsStats(friends) {
    const totalFriends = document.getElementById('totalFriends');
    const onlineFriends = document.getElementById('onlineFriends');
    
    if (totalFriends) totalFriends.textContent = friends.length;
    if (onlineFriends) {
        const onlineCount = friends.filter(f => f.is_online).length;
        onlineFriends.textContent = onlineCount;
    }
}

function displayFriendsCleanStyle(friends, container) {
    friends.sort((a, b) => {
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        if (a.unreadCount > b.unreadCount) return -1;
        if (a.unreadCount < b.unreadCount) return 1;
        return a.username.localeCompare(b.username);
    });
    
    let html = '';  
    friends.forEach(friend => {  
        const isOnline = friend.is_online || false;  
        const firstLetter = friend.username ? friend.username.charAt(0).toUpperCase() : '?';  
        const avatarColor = '#667eea';
        
        const phoneIconSVG = `<svg class="phone-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="white" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
        </svg>`;
        
        html += `  
            <div class="friend-item-clean" onclick="openChat('${friend.id}', '${friend.username}')">  
                <div class="friend-avatar-clean" style="background: ${avatarColor};" data-user-id="${friend.id}">  
                    ${firstLetter}
                    <span class="status-indicator-clean ${isOnline ? 'online' : 'offline'}"></span>
                </div>  
                <div class="friend-info-clean">  
                    <div class="friend-name-status">  
                        <div class="friend-name-clean">${friend.username}</div>  
                        <div class="friend-status-clean">  
                            ${isOnline ? 'Online' : getTimeAgo(new Date(friend.last_seen || new Date()))}  
                        </div>  
                    </div>  
                    <div class="friend-actions" style="display: flex; align-items: center; gap: 10px;">
                        ${friend.unreadCount > 0 ? `  
                            <div class="unread-badge-clean">  
                                ${friend.unreadCount > 9 ? '9+' : friend.unreadCount}  
                            </div>  
                        ` : ''}
                        <button class="call-button ${isOnline ? '' : 'offline'}" 
                                title="Call ${friend.username}">
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
            <p class="empty-desc">Add friends to start chatting!</p>
        </div>
    `;
}

function showErrorState(container, errorMsg) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3 class="empty-title">Error Loading Friends</h3>
            <p class="empty-desc">${errorMsg}</p>
            <button onclick="loadFriendsList()" style="margin-top: 15px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 10px;">Retry</button>
        </div>
    `;
}

// ==================== UTILITY FUNCTIONS ====================
function getTimeAgo(date) {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function setupSearch() {
    const searchInput = document.getElementById('searchFriendsInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        loadFriendsList(e.target.value);
    });
}

// ==================== CLEANUP ====================
window.addEventListener('beforeunload', async () => {
    if (currentUser) {
        await presenceTracker.stop();
    }
    
    if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
    }
    
    if (incomingCallChannel) {
        supabase.removeChannel(incomingCallChannel);
    }
});

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', initFriendsPage);