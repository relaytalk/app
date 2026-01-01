// Chat Page Script - SIMPLIFIED FOR FRIENDS MESSAGING
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Luster Chat Page Loaded");

let currentUser = null;
let chatFriend = null;
let messages = [];

// Initialize chat page
async function initChatPage() {
    console.log("Initializing chat page...");

    // Check if user is logged in
    const { success, user } = await auth.getCurrentUser();

    if (!success || !user) {
        alert("Please login first!");
        window.location.href = '../auth/index.html';
        return;
    }

    currentUser = user;
    console.log("Logged in as:", currentUser.email);

    // Get friend ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friendId');

    if (!friendId) {
        alert("No friend selected!");
        window.location.href = '../home/index.html';
        return;
    }

    // Load friend data
    await loadFriendData(friendId);

    // Load messages
    await loadMessages(friendId);

    // Set up event listeners
    setupEventListeners();

    // Setup real-time listener
    setupRealtimeListener(friendId);

    console.log("Chat page initialized");
}

// Load friend data
async function loadFriendData(friendId) {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', friendId)
            .single();

        if (error) throw error;

        chatFriend = profile;
        console.log("Chatting with:", profile.username);

        // Update UI
        updateChatHeader();

    } catch (error) {
        console.error("Error loading friend:", error);
        alert("Error loading friend data!");
        window.location.href = '../home/index.html';
    }
}

// Update chat header
function updateChatHeader() {
    if (!chatFriend) return;

    // Update friend name
    const chatUserName = document.getElementById('chatUserName');
    if (chatUserName) {
        chatUserName.textContent = chatFriend.username;
    }

    // Update avatar
    const chatUserAvatar = document.getElementById('chatUserAvatar');
    if (chatUserAvatar) {
        if (chatFriend.avatar_url) {
            chatUserAvatar.innerHTML = `<img src="${chatFriend.avatar_url}" alt="${chatFriend.username}" style="width:100%;height:100%;border-radius:50%;">`;
        } else {
            // Fallback: first letter
            const firstLetter = chatFriend.username.charAt(0).toUpperCase();
            chatUserAvatar.textContent = firstLetter;
            chatUserAvatar.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
        }
    }

    // Update status
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');

    if (statusText && statusDot) {
        const isOnline = chatFriend.status === 'online';
        statusText.textContent = isOnline ? 'Online' : 'Offline';
        statusDot.className = isOnline ? 'status-dot' : 'status-dot offline';
    }
}

// Load messages (direct messages between two users)
async function loadMessages(friendId) {
    if (!currentUser || !friendId) return;

    try {
        // Get messages where current user is sender OR receiver
        const { data: allMessages, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        messages = allMessages || [];
        console.log("Loaded", messages.length, "messages");

        // Display messages
        displayMessages();

        // Scroll to bottom
        setTimeout(() => {
            scrollToBottom();
        }, 100);

        // Mark unread messages as read
        markMessagesAsRead(friendId);

    } catch (error) {
        console.error("Error loading messages:", error);
        messages = [];
        displayMessages();
    }
}

// Display messages
function displayMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-chat">
                <div class="empty-chat-icon">💬</div>
                <h3>No messages yet</h3>
                <p style="margin-top: 10px;">Start the conversation!</p>
            </div>
        `;
        return;
    }

    let html = '';
    let lastDate = null;

    messages.forEach((message) => {
        const messageDate = new Date(message.created_at).toDateString();
        if (messageDate !== lastDate) {
            html += `
                <div class="date-separator">
                    <span>${formatDate(message.created_at)}</span>
                </div>
            `;
            lastDate = messageDate;
        }

        const isSent = message.sender_id === currentUser.id;
        const time = formatTime(message.created_at);

        html += `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-content">
                    ${message.content || ''}
                </div>
                <div class="message-time">
                    ${time}
                    ${isSent ? `
                        <div class="message-status">
                            ${message.is_read ? '✓✓' : '✓'}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Format date for separator
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

// Format time for message
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }).toLowerCase();
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !chatFriend) return;

    try {
        // Create message in Supabase
        const { data: newMessage, error } = await supabase
            .from('messages')
            .insert({
                sender_id: currentUser.id,
                receiver_id: chatFriend.id,
                content: text,
                is_read: false,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Add to local messages array
        messages.push(newMessage);

        // Clear input
        input.value = '';
        input.style.height = 'auto';
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.disabled = true;

        // Display messages
        displayMessages();

        // Scroll to bottom
        scrollToBottom();

        console.log("Message sent");

    } catch (error) {
        console.error("Error sending message:", error);
        alert("Could not send message. Please try again.");
    }
}

// Mark messages as read
async function markMessagesAsRead(friendId) {
    try {
        // Mark all unread messages from this friend as read
        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', friendId)
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);

    } catch (error) {
        console.error("Error marking messages as read:", error);
    }
}

// Setup real-time listener for new messages
function setupRealtimeListener(friendId) {
    if (!friendId || !currentUser) return;

    // Listen for new messages
    supabase
        .channel(`chat:${currentUser.id}:${friendId}`)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `or(and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id}),and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}))`
            },
            (payload) => {
                console.log("New message:", payload.new);

                // Add to messages array if not already there
                if (!messages.some(m => m.id === payload.new.id)) {
                    messages.push(payload.new);
                    displayMessages();
                    scrollToBottom();

                    // Mark as read if it's from friend
                    if (payload.new.sender_id === friendId) {
                        supabase
                            .from('messages')
                            .update({ is_read: true })
                            .eq('id', payload.new.id);
                    }
                }
            }
        )
        .subscribe();
}

// Handle key press
function handleKeyPress(event) {
    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById('messageInput');

    if (sendBtn) {
        sendBtn.disabled = !input || input.value.trim() === '';
    }

    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (input && input.value.trim()) {
            sendMessage();
        }
    }
}

// Auto-resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = textarea.value.trim() === '';
    }
}

// Scroll to bottom
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// Go back to home
function goBack() {
    window.location.href = '../home/index.html';
}

// Show user info modal
function showUserInfo() {
    if (!chatFriend) return;

    const modal = document.getElementById('userInfoModal');
    const content = document.getElementById('userInfoContent');

    if (!modal || !content) return;

    const isOnline = chatFriend.status === 'online';

    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; margin: 0 auto 15px;">
                ${chatFriend.username.charAt(0).toUpperCase()}
            </div>
            <h3 style="margin-bottom: 5px;">${chatFriend.username}</h3>
            <p style="color: #a0a0c0; margin-bottom: 10px;">${chatFriend.full_name || ''}</p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span class="status-dot ${isOnline ? '' : 'offline'}" style="margin: 0;"></span>
                <span>${isOnline ? 'Online' : 'Offline'}</span>
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
            <button class="action-btn accept-btn" onclick="startVoiceCall()" style="width: 100%;">
                🎤 Voice Call
            </button>
            <button class="action-btn secondary" onclick="viewSharedMedia()" style="width: 100%;">
                📷 Shared Media
            </button>
            <button class="action-btn decline-btn" onclick="blockUser()" style="width: 100%;">
                🚫 Block User
            </button>
        </div>
    `;

    modal.style.display = 'flex';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('userInfoModal');
    if (modal) modal.style.display = 'none';
}

// Set up event listeners
function setupEventListeners() {
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('userInfoModal');
        if (modal && event.target === modal) {
            closeModal();
        }
    };

    // Escape key closes modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });

    // Auto-focus on message input
    setTimeout(() => {
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }, 500);
}

// Placeholder functions
function attachFile() {
    alert("File attachment coming soon!");
}

function startVoiceCall() {
    alert("Voice call coming soon!");
    closeModal();
}

function viewSharedMedia() {
    alert("Shared media coming soon!");
    closeModal();
}

function blockUser() {
    if (chatFriend && confirm(`Block ${chatFriend.username}?`)) {
        alert(`${chatFriend.username} has been blocked.`);
        closeModal();
        goBack();
    }
}

function clearChat() {
    if (!chatFriend || !confirm("Clear all messages?")) return;
    alert("Clear chat feature coming soon!");
}

// Make functions available globally
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.autoResize = autoResize;
window.goBack = goBack;
window.showUserInfo = showUserInfo;
window.closeModal = closeModal;
window.attachFile = attachFile;
window.clearChat = clearChat;
window.startVoiceCall = startVoiceCall;
window.viewSharedMedia = viewSharedMedia;
window.blockUser = blockUser;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initChatPage);