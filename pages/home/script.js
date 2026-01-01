// Home Page Script - FINAL WORKING VERSION
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
        window.location.href = '../auth/index.html';
        return;
    }

    currentUser = user;

    // Load data
    await loadUserProfile();
    updateWelcomeMessage();
    await loadFriends();
    await updateNotificationsBadge();

    setupEventListeners();
}

// Load user profile
async function loadUserProfile() {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        currentProfile = profile;

    } catch {
        currentProfile = {
            username: 'User'
        };
    }
}

// Update welcome message
function updateWelcomeMessage() {
    const welcomeElement = document.getElementById('welcomeTitle');
    if (welcomeElement && currentProfile) {
        welcomeElement.textContent = `Welcome, ${currentProfile.username}!`;
    }
}

// Load friends list
async function loadFriends() {
    const container = document.getElementById('friendsList');
    if (!container) return;

    try {
        const { data: friends } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', currentUser.id);

        if (!friends || friends.length === 0) {
            showEmptyFriends(container);
            return;
        }

        const friendIds = friends.map(f => f.friend_id);

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, status, last_seen')
            .in('id', friendIds);

        // 🔥 REMOVE LOADING TEXT
        const loadingText = document.getElementById('loadingText');
        if (loadingText) loadingText.remove();

        let html = '';
        profiles.forEach(profile => {
            const firstLetter = profile.username.charAt(0).toUpperCase();
            html += `
                <div class="friend-card" onclick="openChat('${profile.id}', '${profile.username}')">
                    <div class="friend-avatar">${firstLetter}</div>
                    <div class="friend-info">
                        <div class="friend-name">${profile.username}</div>
                        <div class="friend-status">
                            <span class="status-dot ${profile.status === 'online' ? '' : 'offline'}"></span>
                            ${profile.status === 'online' ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch {
        showEmptyFriends(container);
    }
}

function showEmptyFriends(container) {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.remove();

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">👥</div>
            <p>No friends yet</p>
            <p style="font-size:0.9rem;margin-top:10px;">Search for users to add friends</p>
        </div>
    `;
}

// Notifications badge
async function updateNotificationsBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    const { data } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending');

    badge.style.display = data && data.length ? 'block' : 'none';
    badge.textContent = data?.length || '';
}

// Navigation helpers
function openChat(id, username) {
    sessionStorage.setItem('currentChatFriend', JSON.stringify({ id, username }));
    window.location.href = `../chats/index.html?friendId=${id}`;
}

function openSearch() {
    document.getElementById('searchModal').style.display = 'flex';
}

function openNotifications() {
    document.getElementById('notificationsModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('searchModal').style.display = 'none';
    document.getElementById('notificationsModal').style.display = 'none';
}

function setupEventListeners() {
    console.log("Event listeners ready");
}

// Make global
window.openSearch = openSearch;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.openChat = openChat;

// Init
document.addEventListener('DOMContentLoaded', initHomePage);