// friends.js - DEBUG VERSION

import { initializeSupabase, supabase as supabaseClient } from '../../../utils/supabase.js';

let supabase = null;
let currentUser = null;
let allFriends = [];
let filteredFriends = [];

// Call listener variables
let audioPlayer = null;
let callSubscription = null;
let notificationShowing = false;

async function initFriendsPage() {
    console.log('🚀 Friends page initializing...');

    try {
        supabase = await initializeSupabase();
        console.log('1️⃣ Supabase initialized:', !!supabase);

        if (!supabase || !supabase.auth) {
            throw new Error('Supabase not initialized');
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('2️⃣ Session exists:', !!session);

        if (error) throw error;

        if (!session) {
            console.log('❌ No session, redirecting to login');
            window.location.href = '../login/index.html';
            return;
        }

        currentUser = session.user;
        console.log('3️⃣ Current user:', {
            email: currentUser.email,
            id: currentUser.id,
            metadata: currentUser.user_metadata
        });

        await loadFriends();

        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.classList.add('hidden');

        // Initialize call listener
        initializeCallListener();

        // TEST: Manually check for calls every 5 seconds
        setInterval(() => {
            console.log('🔍 Manual check for calls...');
            checkForExistingCalls();
        }, 5000);

    } catch (error) {
        console.error('❌ Init error:', error);
        showError('Failed to load friends: ' + error.message);
    }
}

// ==================== CALL LISTENER FUNCTIONS ====================

function initializeCallListener() {
    if (!supabase || !currentUser) {
        console.log('❌ Cannot initialize call listener: missing supabase or user');
        return;
    }
    
    const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'User';
    console.log('📞 Initializing call listener for:', username);
    console.log('📞 User ID:', currentUser.id);
    
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
        console.log('🔔 Ringtone setup complete');
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

    console.log('📡 Setting up Realtime subscription...');
    console.log('📡 Channel:', `calls-friends-${currentUser.id}`);
    console.log('📡 Filter: receiver_id =', currentUser.id);

    // Test if we can query the calls table
    testDatabaseConnection();

    callSubscription = supabase
        .channel(`calls-friends-${currentUser.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('🔥🔥🔥 INCOMING CALL DETECTED! 🔥🔥🔥');
            console.log('📞 Full payload:', payload);
            console.log('📞 Call data:', payload.new);
            console.log('📞 Caller ID:', payload.new.caller_id);
            console.log('📞 Status:', payload.new.status);
            console.log('📞 Room:', payload.new.room_name);

            if (payload.new.status === 'ringing') {
                console.log('✅ This is a ringing call - showing notification');
                handleIncomingCall(payload.new);
            } else {
                console.log('❌ Not a ringing call, status:', payload.new.status);
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 Call updated:', payload.new.status);
        })
        .subscribe((status) => {
            console.log('📡 Subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Successfully subscribed!');
                
                // After subscribing, do another check
                setTimeout(() => {
                    console.log('🔍 Post-subscription check for calls...');
                    checkForExistingCalls();
                }, 2000);
            } else if (status === 'CHANNEL_ERROR') {
                console.log('❌ Channel error - check Supabase realtime is enabled');
            } else if (status === 'TIMED_OUT') {
                console.log('⏰ Subscription timed out');
            } else if (status === 'CLOSED') {
                console.log('🔒 Subscription closed');
            }
        });
}

async function testDatabaseConnection() {
    try {
        console.log('🧪 Testing database connection...');
        
        // Test 1: Can we query profiles?
        const { data: profileTest, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);
        
        console.log('🧪 Profiles query:', profileError ? '❌ Failed' : '✅ Success', profileError || '');
        
        // Test 2: Can we query calls?
        const { data: callsTest, error: callsError } = await supabase
            .from('calls')
            .select('id')
            .limit(1);
        
        console.log('🧪 Calls query:', callsError ? '❌ Failed' : '✅ Success', callsError || '');
        
        // Test 3: Check if realtime is enabled for calls table
        console.log('🧪 Checking if calls table exists and is accessible');
        
    } catch (e) {
        console.log('🧪 Test failed:', e);
    }
}

async function checkForExistingCalls() {
    try {
        console.log('🔍 Checking for existing ringing calls at:', new Date().toLocaleTimeString());
        
        const { data: calls, error } = await supabase
            .from('calls')
            .select('*')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'ringing')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.log('🔍 Query error:', error);
            return;
        }

        console.log(`🔍 Found ${calls?.length || 0} ringing calls`);
        
        if (calls && calls.length > 0) {
            console.log('🔍 Ringing calls:', calls);
            
            // Filter out self-calls
            const validCalls = calls.filter(call => call.caller_id !== currentUser.id);
            
            if (validCalls.length > 0) {
                console.log('🔍 Valid incoming call found!', validCalls[0]);
                handleIncomingCall(validCalls[0]);
            } else {
                console.log('🔍 All ringing calls are self-calls, ignoring');
            }
        }
    } catch (error) {
        console.error('Error checking existing calls:', error);
    }
}

async function handleIncomingCall(call) {
    console.log('📞 HANDLING INCOMING CALL:', call);
    
    // Don't show if already on a call page
    if (window.location.pathname.includes('/call/')) {
        console.log('📞 Already on call page, not showing notification');
        return;
    }

    if (notificationShowing) {
        console.log('📞 Notification already showing');
        return;
    }

    console.log('📞 Getting caller info for ID:', call.caller_id);
    const caller = await getCallerInfo(call.caller_id);
    console.log('📞 Caller info:', caller);

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
        const { data, error } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();

        if (error) {
            console.log('📞 Error getting caller info:', error);
            return { username: 'Unknown', avatar_url: null };
        }
        
        return data || { username: 'Unknown', avatar_url: null };
    } catch (error) {
        console.log('📞 Exception getting caller info:', error);
        return { username: 'Unknown', avatar_url: null };
    }
}

function showIncomingCallNotification(call, caller) {
    console.log('🔔 SHOWING NOTIFICATION for call from:', caller?.username);
    
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
        console.log('✅ Accept button clicked');
        await acceptCall(call);
    });

    document.getElementById('declineCallBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        console.log('❌ Decline button clicked');
        await declineCall(call);
    });

    // Auto-hide after 30 seconds
    setTimeout(() => {
        if (notificationShowing) {
            console.log('⏰ Auto-hiding notification after 30 seconds');
            hideIncomingCallNotification();
            stopRingtone();
        }
    }, 30000);
}

async function acceptCall(call) {
    console.log('📞 Accepting call:', call.id);
    stopRingtone();
    hideIncomingCallNotification();

    try {
        const { error } = await supabase
            .from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', call.id);

        if (error) {
            console.log('❌ Error updating call:', error);
            return;
        }

        console.log('✅ Call updated to active, opening new tab');
        const callUrl = `../../call/index.html?incoming=true&room=${call.room_name}&callerId=${call.caller_id}&callId=${call.id}`;
        window.open(callUrl, '_blank');
    } catch (error) {
        console.error('Error accepting call:', error);
    }
}

async function declineCall(call) {
    console.log('📞 Declining call:', call.id);
    stopRingtone();
    hideIncomingCallNotification();

    try {
        const { error } = await supabase
            .from('calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', call.id);

        if (error) {
            console.log('❌ Error declining call:', error);
            return;
        }

        console.log('✅ Call declined');
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
        console.log('🔔 Notification hidden');
    }
}

// ==================== ORIGINAL FRIENDS PAGE FUNCTIONS ====================

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
        const lastSeen = friend.last_seen ? formatLastSeen(friend.lastSeen) : 'Never';

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
                <button class="call-friend-btn" onclick="startCall('${friend.id}', '${friend.username}', event)" title="Call ${friend.username}">
                    <i class="fas fa-phone"></i>
                </button>
                <i class="fas fa-chevron-right" style="color:#cbd5e1; margin-left:5px;" onclick="openChat('${friend.id}', '${friend.username}')"></i>
            </div>
        `;
    });

    container.innerHTML = html;
}

window.startCall = function(friendId, friendName, event) {
    event.stopPropagation();
    
    if (friendId === currentUser.id) {
        showToast('error', 'You cannot call yourself');
        return;
    }
    
    console.log('📞 Starting call to:', friendName);
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

window.clearSearch = function() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        window.searchFriends();
    }
};

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

window.openChat = function(friendId, friendName) {
    console.log('💬 Opening chat with:', friendName);
    sessionStorage.setItem('currentChatFriend', JSON.stringify({
        id: friendId,
        username: friendName
    }));
    window.location.href = `../chats/index.html?friendId=${friendId}`;
};

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

window.addEventListener('beforeunload', function() {
    stopRingtone();
    if (callSubscription) {
        callSubscription.unsubscribe();
    }
    hideIncomingCallNotification();
});

document.addEventListener('DOMContentLoaded', initFriendsPage);


// Add this new function
async function debugAllCalls() {
    try {
        console.log('🔍 DEBUG: Checking ALL calls for receiver...');
        
        const { data: allCalls, error } = await supabase
            .from('calls')
            .select('*')
            .eq('receiver_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.log('🔍 DEBUG Error:', error);
            return;
        }

        console.log(`🔍 DEBUG: Found ${allCalls?.length || 0} total calls for this user`);
        
        if (allCalls && allCalls.length > 0) {
            console.log('🔍 DEBUG: All calls:', allCalls.map(c => ({
                id: c.id,
                status: c.status,
                caller: c.caller_id,
                created: c.created_at
            })));
        } else {
            console.log('🔍 DEBUG: No calls found at all for this user');
            
            // Also check if user exists in profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('id', currentUser.id)
                .single();
                
            console.log('🔍 DEBUG: User profile exists?', profile ? '✅' : '❌', profile);
        }
    } catch (e) {
        console.log('🔍 DEBUG Exception:', e);
    }
}

// Call it right after subscription
// In the subscription success callback, add this line:
setTimeout(() => debugAllCalls(), 3000);
