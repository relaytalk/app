import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Chat Loaded");

let currentUser = null;
let chatFriend = null;
let chatChannel = null;
let statusChannel = null;
let isLoadingMessages = false;
let currentMessages = [];
let isSending = false; // 🎯 FIX 2: Double sending prevention
let isTyping = false; // 🎯 FIX 3: Typing indicator
let typingTimeout = null;
let friendTyping = false;
let friendTypingTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check auth
        const { success, user } = await auth.getCurrentUser();
        if (!success || !user) {
            showLoginAlert();
            return;
        }

        currentUser = user;
        console.log("Current User:", user.id);

        // Get friend ID
        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');

        if (!friendId) {
            showCustomAlert("No friend selected!", "😕", "Error", () => {
                window.location.href = '../home/index.html';
            });
            return;
        }

        // Load friend
        const { data: friend, error: friendError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', friendId)
            .single();

        if (friendError) throw friendError;

        chatFriend = friend;
        document.getElementById('chatUserName').textContent = friend.username;
        document.getElementById('chatUserAvatar').textContent = friend.username.charAt(0).toUpperCase();

        // Update friend status in UI
        updateFriendStatus(friend.status);

        // Load old messages
        await loadOldMessages(friendId);

        // Setup realtime
        setupRealtime(friendId);

        // 🎯 FIX 3: Setup typing listener
        setupTypingListener();
        updateInputListener();

        console.log("✅ Chat ready!");

    } catch (error) {
        console.error("Init error:", error);
        showCustomAlert("Error loading chat: " + error.message, "❌", "Error", () => {
            window.location.href = '../home/index.html';
        });
    }
});

// 🎯 FIX 3: Typing functions
function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        sendTypingStatus(true);
    }
    
    // Clear existing timeout
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeout = setTimeout(() => {
        isTyping = false;
        sendTypingStatus(false);
    }, 2000);
}

// Send typing status via Supabase
async function sendTypingStatus(isTyping) {
    try {
        await supabase
            .channel(`typing:${currentUser.id}:${chatFriend.id}`)
            .send({
                type: 'broadcast',
                event: 'typing',
                payload: {
                    userId: currentUser.id,
                    friendId: chatFriend.id,
                    isTyping: isTyping,
                    timestamp: Date.now()
                }
            });
    } catch (error) {
        console.log("Typing status error:", error);
    }
}

// Listen for friend's typing
function setupTypingListener() {
    supabase
        .channel(`typing:${chatFriend.id}:${currentUser.id}`)
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload.userId === chatFriend.id) {
                showTypingIndicator(payload.payload.isTyping);
            }
        })
        .subscribe();
}

// Show/hide typing indicator
function showTypingIndicator(show) {
    const indicator = document.getElementById('typingIndicator');
    
    if (!indicator) {
        // Create indicator if it doesn't exist
        const container = document.getElementById('messagesContainer');
        if (container) {
            const typingHTML = `
                <div id="typingIndicator" class="typing-indicator" style="display: none;">
                    <div class="typing-dots">
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', typingHTML);
        }
    }
    
    const indicatorElement = document.getElementById('typingIndicator');
    if (indicatorElement) {
        indicatorElement.style.display = show ? 'flex' : 'none';
        
        if (show) {
            // Auto-hide after 3 seconds (in case we miss the stop signal)
            if (friendTypingTimeout) clearTimeout(friendTypingTimeout);
            friendTypingTimeout = setTimeout(() => {
                indicatorElement.style.display = 'none';
            }, 3000);
        }
    }
}

// Update input event listener
function updateInputListener() {
    const input = document.getElementById('messageInput');
    if (input) {
        input.addEventListener('input', handleTyping);
    }
}

// SOUND EFFECTS 🎵
function playSentSound() {
    try {
        const audio = new Audio('sent.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log("Sound play failed:", e));
    } catch (error) {
        console.log("Sound error:", error);
    }
}

function playReceivedSound() {
    try {
        const audio = new Audio('recieve.mp3'); // Fixed spelling
        audio.volume = 0.3;
        audio.play().catch(e => console.log("Sound play failed:", e));
    } catch (error) {
        console.log("Sound error:", error);
    }
}

function showLoginAlert() {
    const alertOverlay = document.getElementById('customAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertConfirm = document.getElementById('alertConfirm');
    const alertCancel = document.getElementById('alertCancel');

    alertIcon.textContent = "🔐";
    alertTitle.textContent = "Login Required";
    alertMessage.textContent = "Please login or signup to continue chatting!";

    alertCancel.style.display = 'inline-block';

    alertConfirm.textContent = "Login";
    alertConfirm.className = "alert-btn confirm";
    alertConfirm.onclick = () => {
        alertOverlay.style.display = 'none';
        window.location.href = '../login/index.html';
    };

    alertCancel.textContent = "Signup";
    alertCancel.className = "alert-btn cancel";
    alertCancel.onclick = () => {
        alertOverlay.style.display = 'none';
        window.location.href = '../auth/index.html';
    };

    alertOverlay.style.display = 'flex';
}

async function loadOldMessages(friendId) {
    if (isLoadingMessages) return;
    isLoadingMessages = true;

    try {
        console.log("Loading messages for friend:", friendId);

        const { data: messages, error } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Query error:", error);
            throw error;
        }

        console.log("Loaded", messages?.length || 0, "messages");
        currentMessages = messages || [];

        showMessages(currentMessages);

    } catch (error) {
        console.error("Load error:", error);
        showMessages([]);
    } finally {
        isLoadingMessages = false;
    }
}

function showMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    console.log("Showing", messages?.length || 0, "messages");

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="empty-chat">
                <div class="empty-chat-icon">💬</div>
                <h3>No messages yet</h3>
                <p style="margin-top: 10px;">Say hello to start the conversation!</p>
            </div>
        `;
        return;
    }

    let html = '';
    let lastDate = '';

    messages.forEach(msg => {
        const isSent = msg.sender_id === currentUser.id;
        const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        const date = new Date(msg.created_at).toLocaleDateString();

        if (date !== lastDate) {
            html += `<div class="date-separator"><span>${date}</span></div>`;
            lastDate = date;
        }

        html += `
            <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}">
                <div class="message-content">${msg.content || ''}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    });

    html += `<div style="height: 10px;"></div>`;
    container.innerHTML = html;
    setTimeout(() => scrollToBottom(), 150);
}

// 🎯 FIX 4: Improved scroll-to-bottom
function scrollToBottom(instant = false) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const lastMessage = container.lastElementChild;
    if (lastMessage) {
        if (instant) {
            lastMessage.scrollIntoView({ behavior: 'instant', block: 'end' });
        } else {
            // Smooth scroll only if user is near bottom
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            
            if (isNearBottom) {
                lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }
}

// 🎯 FIX 4: Improved addMessageToUI with duplicate prevention
function addMessageToUI(message, isFromRealtime = false) {
    const container = document.getElementById('messagesContainer');
    if (!container || !message) return;

    if (container.querySelector('.empty-chat')) {
        container.innerHTML = '';
    }

    const isSent = message.sender_id === currentUser.id;
    const time = new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    const messageHTML = `
        <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message.id}">
            <div class="message-content">${message.content || ''}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', messageHTML);
    
    // 🎯 FIX: Check for duplicate before adding to array
    const isDuplicate = currentMessages.some(msg => msg.id === message.id);
    if (!isDuplicate) {
        currentMessages.push(message);
    }

    // Scroll to bottom if:
    // 1. It's our own message (sent)
    // 2. OR we're near the bottom already
    // 3. OR it's from realtime and we're not actively scrolling up
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    
    if (isSent || isNearBottom || isFromRealtime) {
        setTimeout(() => scrollToBottom(!isFromRealtime), 50);
    }
}

function updateFriendStatus(status) {
    const isOnline = status === 'online';
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');

    if (isOnline) {
        statusText.textContent = "Online";
        statusText.style.color = "#28a745";
        statusDot.className = "status-dot";
        statusDot.style.boxShadow = "0 0 8px #28a745";
    } else {
        statusText.textContent = "Offline";
        statusText.style.color = "#6c757d";
        statusDot.className = "status-dot offline";
        statusDot.style.boxShadow = "none";
    }
}

function setupRealtime(friendId) {
    console.log("🔧 Setting up realtime for friend:", friendId);

    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
    }

    // 🎯 FIX 5: Updated realtime listener to prevent duplicates
    chatChannel = supabase.channel(`dm:${currentUser.id}:${friendId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages'
        }, (payload) => {
            console.log("📨 Realtime INSERT detected:", payload.new);

            const newMsg = payload.new;

            // Filter messages more strictly
            const isOurMessage = 
                (newMsg.sender_id === currentUser.id && newMsg.receiver_id === friendId) ||
                (newMsg.sender_id === friendId && newMsg.receiver_id === currentUser.id);

            if (isOurMessage) {
                // Check if message is already in UI (by ID)
                const existingMessage = document.querySelector(`[data-message-id="${newMsg.id}"]`);
                
                if (!existingMessage) {
                    console.log("✅ Adding new message to UI (from realtime)");
                    addMessageToUI(newMsg, true);

                    // Play received sound if message is from friend
                    if (newMsg.sender_id === friendId) {
                        playReceivedSound();
                        
                        // Only flash title if window is not focused
                        if (!document.hasFocus()) {
                            const originalTitle = document.title;
                            document.title = "💬 " + chatFriend.username;
                            setTimeout(() => document.title = originalTitle, 1000);
                        }
                    }
                } else {
                    console.log("🔄 Message already in UI, skipping:", newMsg.id);
                }
            }
        })
        .subscribe();

    statusChannel = supabase.channel(`status:${friendId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${friendId}`
        }, (payload) => {
            console.log("🔄 Friend status updated:", payload.new.status);

            if (payload.new.id === friendId) {
                chatFriend.status = payload.new.status;
                updateFriendStatus(payload.new.status);

                // Show status change notification
                if (payload.new.status === 'online') {
                    showToast(`${chatFriend.username} is now online`, "🟢", 2000);
                } else {
                    showToast(`${chatFriend.username} is now offline`, "⚫", 2000);
                }
            }
        })
        .subscribe();

    console.log("✅ Realtime active");
}

// 🎯 FIX 2: Updated sendMessage with double sending prevention
async function sendMessage() {
    // Prevent double sending
    if (isSending) {
        console.log("🔄 Message already being sent, skipping...");
        return;
    }
    
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !chatFriend) {
        showToast("Please type a message!", "⚠️");
        return;
    }

    isSending = true; // Lock sending
    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.innerHTML;

    try {
        console.log("📤 Sending message to:", chatFriend.id);

        // Disable button and show loading
        sendBtn.innerHTML = '<div class="typing-dots"><div></div><div></div><div></div></div>';
        sendBtn.disabled = true;

        const { data, error } = await supabase
            .from('direct_messages')
            .insert({
                sender_id: currentUser.id,
                receiver_id: chatFriend.id,
                content: text,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        console.log("✅ Message sent to database:", data.id);

        // Play sent sound 🎵
        playSentSound();

        // Clear input but keep focus
        input.value = '';
        input.style.height = 'auto';
        
        // Short delay before re-enabling
        setTimeout(() => {
            input.focus();
            isSending = false;
            sendBtn.innerHTML = originalText;
            sendBtn.disabled = false;
        }, 300);

        // Don't add message here - let realtime handle it
        // This prevents duplicates

    } catch (error) {
        console.error("Send failed:", error);
        showCustomAlert("Failed to send message: " + error.message, "❌", "Error");
        
        // Re-enable on error
        isSending = false;
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    }
}

function handleKeyPress(event) {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

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

function autoResize(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 100);
    textarea.style.height = newHeight + 'px';

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.disabled = textarea.value.trim() === '';
    }
}

function showCustomAlert(message, icon = "⚠️", title = "Alert", onConfirm = null) {
    const alertOverlay = document.getElementById('customAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertConfirm = document.getElementById('alertConfirm');
    const alertCancel = document.getElementById('alertCancel');

    alertIcon.textContent = icon;
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertCancel.style.display = 'none';

    alertConfirm.textContent = "OK";
    alertConfirm.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    alertOverlay.style.display = 'flex';
}

function showConfirmAlert(message, icon = "❓", title = "Confirm", onConfirm, onCancel = null) {
    const alertOverlay = document.getElementById('customAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertConfirm = document.getElementById('alertConfirm');
    const alertCancel = document.getElementById('alertCancel');

    alertIcon.textContent = icon;
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertCancel.style.display = 'inline-block';

    alertConfirm.textContent = "Yes";
    alertConfirm.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    alertCancel.textContent = "No";
    alertCancel.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onCancel) onCancel();
    };

    alertOverlay.style.display = 'flex';
}

function showToast(message, icon = "ℹ️", duration = 3000) {
    const toast = document.getElementById('customToast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');

    toastIcon.textContent = icon;
    toastMessage.textContent = message;
    toast.style.display = 'flex';

    setTimeout(() => toast.style.display = 'none', duration);
}

function goBack() {
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
    }
    window.location.href = '../home/index.html';
}

window.showUserInfo = function() {
    if (!chatFriend) {
        showToast("User information not available", "⚠️");
        return;
    }

    const modal = document.getElementById('userInfoModal');
    const content = document.getElementById('userInfoContent');
    const isOnline = chatFriend.status === 'online';

    content.innerHTML = `
        <div class="user-info-avatar">
            ${chatFriend.username.charAt(0).toUpperCase()}
        </div>
        <div class="user-info-details">
            <h3 class="user-info-name">${chatFriend.full_name || chatFriend.username}</h3>
            <p class="user-info-username">@${chatFriend.username}</p>
            <div class="user-info-status ${isOnline ? '' : 'offline'}">
                <span class="status-dot ${isOnline ? '' : 'offline'}"></span>
                ${isOnline ? 'Online' : 'Offline'}
            </div>
        </div>
        <div class="user-info-actions">
            <button class="info-action-btn primary" onclick="startVoiceCall()">
                🎤 Voice Call
            </button>
            <button class="info-action-btn secondary" onclick="viewSharedMedia()">
                📷 Shared Media
            </button>
            <button class="info-action-btn danger" onclick="blockUserPrompt()">
                🚫 Block User
            </button>
        </div>
    `;

    modal.style.display = 'flex';
};

window.closeModal = function() {
    document.getElementById('userInfoModal').style.display = 'none';
};

window.startVoiceCall = function() {
    showToast("Voice call feature coming soon!", "📞");
};

window.viewSharedMedia = function() {
    showToast("Shared media feature coming soon!", "📷");
};

window.blockUserPrompt = function() {
    showConfirmAlert(
        `Are you sure you want to block ${chatFriend.username}?`,
        "🚫",
        "Block User",
        () => {
            showToast("User blocked!", "✅");
            setTimeout(goBack, 1000);
        }
    );
};

window.clearChatPrompt = async function() {
    showConfirmAlert(
        "Are you sure you want to clear all messages?",
        "🗑️",
        "Clear Chat",
        async () => {
            try {
                const friendId = new URLSearchParams(window.location.search).get('friendId');
                const { error } = await supabase
                    .from('direct_messages')
                    .delete()
                    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);

                if (error) throw error;

                showToast("Chat cleared!", "✅");
                currentMessages = [];
                showMessages([]);
            } catch (error) {
                console.error("Clear chat error:", error);
                showCustomAlert("Error clearing chat", "❌", "Error");
            }
        }
    );
};

// Make functions global
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.autoResize = autoResize;
window.goBack = goBack;
window.showCustomAlert = showCustomAlert;
window.showConfirmAlert = showConfirmAlert;
window.showToast = showToast;

/* Responsive Design for Chat Page - ADJUSTED FOR BIGGER SIZES */

/* Large Desktop */
@media (max-width: 1440px) {
    .message {
        max-width: 75%;
    }
}

/* Desktop */
@media (max-width: 1200px) {
    .message {
        max-width: 78%;
    }
}

/* Small Desktop / Large Tablet */
@media (max-width: 1024px) {
    .chat-header {
        padding: 16px 18px; /* Adjusted */
        height: 76px; /* Adjusted */
    }

    .main-content {
        margin-top: 76px; /* Adjusted */
        margin-bottom: 92px; /* Adjusted */
        height: calc(100vh - 168px); /* Adjusted */
    }

    .messages-container {
        padding: 18px 18px 60px 18px; /* Adjusted */
    }

    .message {
        max-width: 80%;
    }

    .message-input-wrapper {
        padding: 14px 18px 17px 18px; /* Adjusted */
        height: 90px; /* Adjusted */
    }
}

/* Tablet Landscape */
@media (max-width: 900px) {
    .message {
        max-width: 82%;
    }
}

/* Tablet Portrait */
@media (max-width: 768px) {
    .chat-header {
        padding: 14px 16px; /* Adjusted */
        height: 72px; /* Adjusted */
    }

    .main-content {
        margin-top: 72px; /* Adjusted */
        margin-bottom: 88px; /* Adjusted */
        height: calc(100vh - 160px); /* Adjusted */
    }

    .messages-container {
        padding: 16px 16px 55px 16px; /* Adjusted */
    }

    .message-input-wrapper {
        padding: 12px 16px 15px 16px; /* Adjusted */
        height: 85px; /* Adjusted */
    }

    .message-input {
        padding: 12px 16px; /* Adjusted */
        min-height: 46px; /* Adjusted */
        border-radius: 22px; /* Adjusted */
        font-size: 16px !important;
    }

    .send-btn {
        width: 46px; /* Adjusted */
        height: 46px; /* Adjusted */
        font-size: 1.1rem; /* Adjusted */
    }

    .message {
        max-width: 85%;
        padding: 12px 16px; /* Adjusted */
    }

    .chat-user-avatar {
        width: 46px; /* Adjusted */
        height: 46px; /* Adjusted */
    }

    .custom-alert {
        padding: 24px; /* Adjusted */
        max-width: 340px; /* Adjusted */
    }
}

/* Mobile Landscape */
@media (max-width: 667px) and (orientation: landscape) {
    .chat-header {
        height: 66px; /* Adjusted */
        padding: 12px 15px; /* Adjusted */
    }

    .main-content {
        margin-top: 66px; /* Adjusted */
        margin-bottom: 75px; /* Adjusted */
        height: calc(100vh - 141px); /* Adjusted */
    }

    .messages-container {
        padding: 12px 15px 40px 15px; /* Adjusted */
    }

    .message-input-wrapper {
        height: 75px; /* Adjusted */
        padding: 10px 15px 13px 15px; /* Adjusted */
    }

    .message-input {
        min-height: 44px; /* Adjusted */
        padding: 10px 14px; /* Adjusted */
    }

    .send-btn {
        width: 44px; /* Adjusted */
        height: 44px; /* Adjusted */
    }
}

/* Mobile Portrait */
@media (max-width: 600px) {
    .chat-header {
        padding: 12px 14px; /* Adjusted */
        height: 66px; /* Adjusted */
    }

    .main-content {
        margin-top: 66px; /* Adjusted */
        margin-bottom: 82px; /* Adjusted */
        height: calc(100vh - 148px); /* Adjusted */
    }

    .messages-container {
        padding: 14px 14px 50px 14px; /* Adjusted */
    }

    .message-input-wrapper {
        padding: 10px 14px 13px 14px; /* Adjusted */
        height: 80px; /* Adjusted */
    }

    .message-input-container {
        gap: 12px; /* Adjusted */
    }

    .message {
        max-width: 88%;
        padding: 11px 15px; /* Adjusted */
    }

    .chat-user-avatar {
        width: 44px; /* Adjusted */
        height: 44px; /* Adjusted */
        font-size: 1.2rem; /* Adjusted */
    }

    .back-btn,
    .chat-action-btn {
        width: 40px; /* Adjusted */
        height: 40px; /* Adjusted */
    }

    .message-input {
        font-size: 1rem; /* Adjusted */
        min-height: 44px; /* Adjusted */
        padding: 10px 14px; /* Adjusted */
    }

    .send-btn {
        width: 44px; /* Adjusted */
        height: 44px; /* Adjusted */
        font-size: 1.05rem; /* Adjusted */
    }

    .custom-alert {
        padding: 22px; /* Adjusted */
        max-width: 330px; /* Adjusted */
    }

    .custom-alert-buttons {
        flex-direction: column;
        gap: 10px; /* Adjusted */
    }

    .alert-btn {
        width: 100%;
        min-width: auto;
        padding: 11px 24px; /* Adjusted */
    }
}

/* Small Mobile */
@media (max-width: 480px) {
    .chat-header {
        padding: 10px 12px; /* Adjusted */
        height: 62px; /* Adjusted */
    }

    .main-content {
        margin-top: 62px; /* Adjusted */
        margin-bottom: 78px; /* Adjusted */
        height: calc(100vh - 140px); /* Adjusted */
    }

    .messages-container {
        padding: 12px 12px 45px 12px; /* Adjusted */
        gap: 12px; /* Adjusted */
    }

    .message-input-wrapper {
        padding: 8px 12px 11px 12px; /* Adjusted */
        height: 75px; /* Adjusted */
    }

    .message {
        max-width: 90%;
        padding: 10px 13px; /* Adjusted */
        font-size: 0.98rem; /* Adjusted */
    }

    .chat-user-avatar {
        width: 40px; /* Adjusted */
        height: 40px; /* Adjusted */
        font-size: 1.1rem; /* Adjusted */
    }

    .chat-user-details h3 {
        font-size: 1.15rem; /* Adjusted */
    }

    .chat-user-status {
        font-size: 0.85rem; /* Adjusted */
    }

    .message-input {
        min-height: 42px; /* Adjusted */
        font-size: 0.95rem; /* Adjusted */
        padding: 9px 13px; /* Adjusted */
    }

    .send-btn {
        width: 42px; /* Adjusted */
        height: 42px; /* Adjusted */
        font-size: 1rem; /* Adjusted */
    }

    .empty-chat-icon {
        font-size: 3.5rem;
    }

    .empty-chat h3 {
        font-size: 1.2rem;
    }

    .message-input-container {
        gap: 10px; /* Adjusted */
    }
}

/* Extra Small Mobile */
@media (max-width: 360px) {
    .chat-header {
        padding: 8px 10px; /* Adjusted */
        height: 60px; /* Adjusted */
    }

    .main-content {
        margin-top: 60px; /* Adjusted */
        margin-bottom: 72px; /* Adjusted */
        height: calc(100vh - 132px); /* Adjusted */
    }

    .messages-container {
        padding: 10px 10px 40px 10px; /* Adjusted */
    }

    .message {
        max-width: 92%;
        padding: 9px 12px; /* Adjusted */
        font-size: 0.95rem; /* Adjusted */
    }

    .message-input-wrapper {
        padding: 7px 10px 10px 10px; /* Adjusted */
        height: 70px; /* Adjusted */
    }

    .message-input {
        min-height: 40px; /* Adjusted */
        padding: 8px 12px; /* Adjusted */
        font-size: 0.9rem; /* Adjusted */
    }

    .send-btn {
        width: 40px; /* Adjusted */
        height: 40px; /* Adjusted */
        font-size: 0.95rem; /* Adjusted */
    }

    .back-btn,
    .chat-action-btn {
        width: 38px; /* Adjusted */
        height: 38px; /* Adjusted */
        font-size: 1.2rem; /* Adjusted */
    }

    .chat-user-avatar {
        width: 38px; /* Adjusted */
        height: 38px; /* Adjusted */
    }

    .message-input-container {
        gap: 8px; /* Adjusted */
    }
}

/* Very Short Height Devices */
@media (max-height: 600px) {
    .chat-header {
        height: 60px; /* Adjusted */
        padding: 10px 15px; /* Adjusted */
    }

    .main-content {
        margin-top: 60px; /* Adjusted */
        margin-bottom: 72px; /* Adjusted */
        height: calc(100vh - 132px); /* Adjusted */
    }

    .messages-container {
        padding: 12px 15px 40px 15px; /* Adjusted */
    }

    .message {
        padding: 9px 13px; /* Adjusted */
        margin-bottom: 7px; /* Adjusted */
    }

    .message-input-wrapper {
        height: 72px; /* Adjusted */
        padding: 10px 15px 13px 15px; /* Adjusted */
    }

    .message-input {
        min-height: 40px; /* Adjusted */
        max-height: 85px; /* Adjusted */
    }

    .empty-chat-icon {
        font-size: 3rem;
        margin-bottom: 15px;
    }
}

/* Prevent iOS zoom on input focus */
@media (max-width: 768px) {
    input, textarea {
        font-size: 16px !important;
    }
}