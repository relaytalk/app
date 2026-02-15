// friends.js - COMPLETE VERSION with call receiving AND chat functionality preserved

import { initializeSupabase, supabase as supabaseClient } from '../../../utils/supabase.js';

let supabase = null;
let currentUser = null;
let allFriends = [];
let filteredFriends = [];

// Call listener variables
let callListenerInitialized = false;
let audioPlayer = null;
let callSubscription = null;
let notificationShowing = false;

async function initFriendsPage() {
    console.log('Loading friends...');

    try {
        supabase = await initializeSupabase();

        if (!supabase || !supabase.auth) {
            throw new Error('Supabase not initialized');
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session) {
            window.location.href = '../login/index.html';
            return;
        }

        currentUser = session.user;
        console.log('✅ Logged in as:', currentUser.email);

        await loadFriends();

        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.classList.add('hidden');

        // Initialize call listener for incoming calls (SAME as call-app index.html)
        initializeCallListener();

    } catch (error) {
        console.error('Init error:', error);
        showError('Failed to load friends: ' + error.message);
    }
}

// ==================== CALL LISTENER FUNCTIONS (copied from call-app index.html) ====================

function initializeCallListener() {
    if (!supabase || !currentUser || callListenerInitialized) return;
    
    console.log('📞 Initializing call listener for friends page:', currentUser.username);
    callListenerInitialized = true;
    
    setupRingtone();
    setupIncomingCallListener();
    checkForExistingCalls();
}

function setupRingtone() {
    try {
        audioPlayer = new Audio();
        audioPlayer.loop = true;
        audioPlayer.volume = 0.5;
        audioPlayer.src = 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAA8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PA=='
    } catch (e) {
        console.log('Ringtone setup failed:', e);
    }
}

function playRingtone() {
    if (audioPlayer) {
        audioPlayer.play().catch(e => console.log('Audio play failed:', e));
    }
}

function stopRingtone() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
}

function setupIncomingCallListener() {
    if (!supabase || !currentUser) return;

    console.log('Setting up call listener for user:', currentUser.id);

    callSubscription = supabase
        .channel(`calls-friends-${currentUser.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 Incoming call detected on friends page!', payload.new);

            if (payload.new.status === 'ringing') {
                handleIncomingCall(payload.new);
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('Call updated on friends page:', payload.new.status);

            if (payload.new.status === 'cancelled' || payload.new.status === 'ended') {
                hideIncomingCallNotification();
                stopRingtone();
            }
        })
        .subscribe((status) => {
            console.log('Call listener status on friends page:', status);
        });
}

async function checkForExistingCalls() {
    try {
        const { data: calls } = await supabase
            .from('calls')
            .select('*')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'ringing')
            .order('created_at', { ascending: false })
            .limit(1);

        if (calls && calls.length > 0) {
            console.log('Found existing ringing call on friends page');
            handleIncomingCall(calls[0]);
        }
    } catch (error) {
        console.error('Error checking existing calls:', error);
    }
}

async function handleIncomingCall(call) {
    // Don't show if already on a call page
    if (window.location.pathname.includes('/call/')) {
        return;
    }

    if (notificationShowing) return;

    const caller = await getCallerInfo(call.caller_id);

    showIncomingCallNotification(call, caller);
    playRingtone();

    sessionStorage.setItem('incomingCall', JSON.stringify({
        id: call.id,
        roomName: call.room_name,
        callerId: call.caller_id,
        callerName: caller?.username || 'Unknown'
    }));
}

async function getCallerInfo(callerId) {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();

        return data || { username: 'Unknown', avatar_url: null };
    } catch (error) {
        return { username: 'Unknown', avatar_url: null };
    }
}

function showIncomingCallNotification(call, caller) {
    hideIncomingCallNotification();
    notificationShowing = true;

    // Add animation styles if not already present
    if (!document.getElementById('callAnimationStyles')) {
        const style = document.createElement('style');
        style.id = 'callAnimationStyles';
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateY(-100%); }
                to { transform: translateY(0); }
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    const notification = document.createElement('div');
    notification.id = 'incomingCallNotification';
    notification.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #007acc;
        color: white;
        padding: 16px 20px;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const avatar = caller?.avatar_url 
        ? `<img src="${caller.avatar_url}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid white;">`
        : `<div style="width: 44px; height: 44px; border-radius: 50%; background: white; color: #007acc; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">${caller?.username?.charAt(0).toUpperCase() || '?'}</div>`;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
            ${avatar}
            <div>
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">${caller?.username || 'Incoming Call'}</div>
                <div style="font-size: 13px; opacity: 0.9;">🔊 Incoming voice call...</div>
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="acceptCallBtn" style="background: white; border: none; color: #28a745; width: 44px; height: 44px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;">
                <i class="fas fa-phone-alt"></i>
            </button>
            <button id="declineCallBtn" style="background: white; border: none; color: #dc3545; width: 44px; height: 44px; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-phone-slash"></i>
            </button>
        </div>
    `;

    document.body.prepend(notification);

    document.getElementById('acceptCallBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await acceptCall(call);
    });

    document.getElementById('declineCallBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await declineCall(call);
    });

    // Auto-hide after 30 seconds
    setTimeout(() => {
        if (notificationShowing) {
            hideIncomingCallNotification();
            stopRingtone();
        }
    }, 30000);
}

async function acceptCall(call) {
    stopRingtone();
    hideIncomingCallNotification();

    try {
        await supabase
            .from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', call.id);

        // Open call in new tab
        const callUrl = `../../call/index.html?incoming=true&room=${call.room_name}&callerId=${call.caller_id}&callId=${call.id}`;
        window.open(callUrl, '_blank');
    } catch (error) {
        console.error('Error accepting call:', error);
    }
}

async function declineCall(call) {
    stopRingtone();
    hideIncomingCallNotification();

    try {
        await supabase
            .from('calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', call.id);

        sessionStorage.removeItem('incomingCall');
    } catch (error) {
        console.error('Error declining call:', error);
    }
}

function hideIncomingCallNotification() {
    const existing = document.getElementById('incomingCallNotification');
    if (existing) {
        existing.remove();
        notificationShowing = false;
    }
}

// ==================== ORIGINAL FRIENDS PAGE FUNCTIONS (PRESERVED) ====================

async function loadFriends() {
    try {
        if (!currentUser || !supabase) return;

        const { data: friendsData, error: friendsError } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        if (friendsError) throw friendsError;

        if (!friendsData || friendsData.length === 0) {
            showEmptyState();
            return;
        }

        const friendIds = friendsData.map(f => f.friend_id);

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, status, last_seen')
            .in('id', friendIds)
            .order('username');

        if (profilesError) throw profilesError;

        allFriends = profiles || [];
        filteredFriends = [...allFriends];
        renderFriendsList();

    } catch (error) {
        console.error('Load error:', error);
        showEmptyState();
    }
}

function renderFriendsList() {
    const container = document.getElementById('friendsList');
    if (!container) return;

    if (!filteredFriends || filteredFriends.length === 0) {
        showEmptyState();
        return;
    }

    let html = '';

    filteredFriends.forEach(friend => {
        const initial = friend.username ? friend.username.charAt(0).toUpperCase() : '?';
        const online = friend.status === 'online';
        const lastSeen = friend.last_seen ? formatLastSeen(friend.last_seen) : 'Never';

        html += `
            <div class="friend-item">
                <div class="friend-avatar" onclick="openChat('${friend.id}', '${friend.username}')" style="cursor:pointer;">
                    ${friend.avatar_url 
                        ? `<img src="${friend.avatar_url}" alt="${friend.username}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                        : `<span style="color:white; font-size:1.3rem; font-weight:600;">${initial}</span>`
                    }
                    <span class="status-indicator-clean ${online ? 'online' : 'offline'}"></span>
                </div>
                <div class="friend-info-clean" onclick="openChat('${friend.id}', '${friend.username}')" style="cursor:pointer; flex:1;">
                    <div class="friend-name-status">
                        <div class="friend-name-clean">${friend.username || 'User'}</div>
                        <div class="friend-status-clean">
                            ${online ? 'Online' : `Last seen ${lastSeen}`}
                        </div>
                    </div>
                </div>
                <!-- CALL BUTTON - Opens in new tab -->
                <button class="call-friend-btn" onclick="startCall('${friend.id}', '${friend.username}', event)" title="Call ${friend.username}">
                    <i class="fas fa-phone"></i>
                </button>
                <i class="fas fa-chevron-right" style="color:#cbd5e1; margin-left:5px;" onclick="openChat('${friend.id}', '${friend.username}')"></i>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Start call in new tab
window.startCall = function(friendId, friendName, event) {
    event.stopPropagation(); // Prevent opening chat
    
    const callUrl = `../../call/index.html?friendId=${friendId}&friendName=${encodeURIComponent(friendName)}`;
    window.open(callUrl, '_blank');
    
    showToast('success', `Calling ${friendName}...`);
};

function formatLastSeen(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 60000);

    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
    return time.toLocaleDateString();
}

// Search friends
window.searchFriends = function() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    if (!input) return;

    const term = input.value.toLowerCase().trim();

    if (clearBtn) clearBtn.style.display = term ? 'flex' : 'none';

    filteredFriends = term 
        ? allFriends.filter(f => f.username?.toLowerCase().includes(term))
        : [...allFriends];

    renderFriendsList();
};

// Clear search
window.clearSearch = function() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        window.searchFriends();
    }
};

// Show empty state
function showEmptyState() {
    const container = document.getElementById('friendsList');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3>No friends yet</h3>
            <p>Add friends to start calling and chatting</p>
            <button class="add-friends-btn" onclick="openSearch()">
                <i class="fas fa-user-plus"></i> Add Friends
            </button>
        </div>
    `;
}

// Show error
function showError(message) {
    const container = document.getElementById('friendsList');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">❌</div>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="add-friends-btn" onclick="location.reload()">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;
}

// ORIGINAL CHAT FUNCTION - PRESERVED
window.openChat = function(friendId, friendName) {
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendName
    }));
    window.location.href = `../chats/index.html?friendId=${friendId}`;
};

// Search users to add
window.searchUsers = async function() {
    if (!supabase || !currentUser) return;

    const input = document.getElementById('userSearchInput');
    const container = document.getElementById('searchResults');
    if (!input || !container) return;

    const term = input.value.toLowerCase().trim();

    if (!term) {
        container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-search" style="font-size:2rem;color:#cbd5e1;margin-bottom:10px;"></i><p>Search for friends to add</p></div>`;
        return;
    }

    try {
        const { data: friends } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        const friendIds = friends?.map(f => f.friend_id) || [];

        const { data: pending } = await supabase
            .from('friend_requests')
            .select('receiver_id')
            .eq('sender_id', currentUser.id)
            .eq('status', 'pending');

        const pendingIds = pending?.map(r => r.receiver_id) || [];

        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .neq('id', currentUser.id)
            .ilike('username', `%${term}%`)
            .limit(20);

        if (error) throw error;

        if (!users || users.length === 0) {
            container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-user-slash" style="font-size:2rem;color:#cbd5e1;margin-bottom:10px;"></i><p>No users found</p></div>`;
            return;
        }

        let html = '';
        users.forEach(user => {
            const isFriend = friendIds.includes(user.id);
            const isPending = pendingIds.includes(user.id);
            const initial = user.username?.charAt(0).toUpperCase() || '?';

            html += `
                <div class="search-result-item">
                    <div class="search-result-avatar" style="background: linear-gradient(45deg, #007acc, #00b4d8);">
                        ${user.avatar_url 
                            ? `<img src="${user.avatar_url}" alt="${user.username}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                            : `<span style="color:white; font-size:1.2rem; font-weight:600;">${initial}</span>`
                        }
                    </div>
                    <div class="search-result-info">
                        <div class="search-result-name">${user.username}</div>
                        <div class="search-result-username">@${user.username}</div>
                    </div>
                    ${isFriend 
                        ? '<button class="add-friend-btn added" disabled>✓ Friends</button>'
                        : isPending
                        ? '<button class="add-friend-btn added" disabled>⏳ Sent</button>'
                        : `<button class="add-friend-btn" onclick="sendFriendRequest('${user.id}', '${user.username}', this)">+ Add</button>`
                    }
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `<div class="empty-search" style="text-align:center;padding:30px;"><i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i><p>Error searching users</p></div>`;
    }
};

// Send friend request
window.sendFriendRequest = async function(userId, username, btn) {
    try {
        btn.disabled = true;
        btn.textContent = 'Sending...';

        const { error } = await supabase
            .from('friend_requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: userId,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        if (error) throw error;

        btn.textContent = '✓ Sent';
        btn.classList.add('added');
        showToast('success', `Friend request sent to ${username}`);

    } catch (error) {
        console.error('Request error:', error);
        btn.disabled = false;
        btn.textContent = '+ Add';
        showToast('error', 'Failed to send request');
    }
};

// Toast
function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    let color = type === 'success' ? '#22c55e' : '#ef4444';

    toast.innerHTML = `
        <i class="fas fa-${icon}" style="color:${color};"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Navigation
window.goToHome = () => window.location.href = '../index.html';
window.openSearch = () => {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('userSearchInput')?.focus(), 100);
    }
};
window.closeModal = () => {
    document.getElementById('searchModal').style.display = 'none';
};

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopRingtone();
    if (callSubscription) {
        callSubscription.unsubscribe();
    }
    hideIncomingCallNotification();
});

// Start
document.addEventListener('DOMContentLoaded', initFriendsPage);
