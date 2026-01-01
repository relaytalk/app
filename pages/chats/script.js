import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Chat Loaded");

let currentUser = null;
let chatFriend = null;
let chatChannel = null;
let statusChannel = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check auth
        const { success, user } = await auth.getCurrentUser();
        if (!success || !user) {
            alert("Please login first!");
            window.location.href = '../auth/index.html';
            return;
        }

        currentUser = user;
        console.log("User:", user.email);

        // Get friend ID
        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');

        if (!friendId) {
            alert("No friend selected!");
            window.location.href = '../home/index.html';
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
        const isOnline = friend.status === 'online';
        document.getElementById('statusText').textContent = isOnline ? 'Online' : 'Offline';
        document.getElementById('statusDot').className = isOnline ? 'status-dot' : 'status-dot offline';

        // Load old messages
        await loadOldMessages(friendId);

        // Setup realtime
        setupRealtime(friendId);

        // Setup input listeners
        setupInputListeners();

        console.log("✅ Chat ready");

    } catch (error) {
        console.error("Init error:", error);
        alert("Error loading chat: " + error.message);
        window.location.href = '../home/index.html';
    }
});

// Setup input listeners
function setupInputListeners() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!input || !sendBtn) return;
    
    // Enable/disable send button on input
    input.addEventListener('input', function() {
        sendBtn.disabled = this.value.trim() === '';
    });
    
    // Also handle paste
    input.addEventListener('paste', function() {
        setTimeout(() => {
            sendBtn.disabled = this.value.trim() === '';
        }, 10);
    });
}

// Load old messages - FIXED: Only messages with this friend
async function loadOldMessages(friendId) {
    try {
        console.log("Loading messages between:", currentUser.id, "and", friendId);

        // FIXED: Get messages only between these two users
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
        showMessages(messages || []);

    } catch (error) {
        console.error("Load error:", error);
        showMessages([]);
    }
}

// Show messages in UI
function showMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) {
        console.error("messagesContainer not found!");
        return;
    }

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

        // Add date separator if date changed
        if (date !== lastDate) {
            html += `<div class="date-separator"><span>${date}</span></div>`;
            lastDate = date;
        }

        html += `
            <div class="message ${isSent ? 'sent' : 'received'}">
                <div class="message-content">${msg.content || ''}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // FIXED: Scroll after messages are definitely rendered
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// REAL-TIME FIXED: Proper subscription
function setupRealtime(friendId) {
    console.log("Setting realtime for friend:", friendId);

    // Remove old channels
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
        statusChannel = null;
    }

    // Create message channel - FIXED filter
    chatChannel = supabase.channel(`dm:${currentUser.id}:${friendId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id}))`
        }, async (payload) => {
            console.log("🔥 New message:", payload.new);
            
            // Check if this message is for our chat
            const newMsg = payload.new;
            if ((newMsg.sender_id === currentUser.id && newMsg.receiver_id === friendId) ||
                (newMsg.sender_id === friendId && newMsg.receiver_id === currentUser.id)) {
                
                // Play sound if message is from friend
                if (newMsg.sender_id === friendId) {
                    playMessageSound();
                }
                
                // Add message to UI without reloading all
                addSingleMessage(newMsg);
            }
        })
        .subscribe();

    // Create status channel for real-time status updates
    statusChannel = supabase.channel(`status:${friendId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${friendId}`
        }, (payload) => {
            console.log("Friend status updated:", payload.new.status);
            chatFriend.status = payload.new.status;

            // Update UI
            const isOnline = payload.new.status === 'online';
            document.getElementById('statusText').textContent = isOnline ? 'Online' : 'Offline';
            document.getElementById('statusDot').className = isOnline ? 'status-dot' : 'status-dot offline';
        })
        .subscribe();
}

// Add single message to UI
function addSingleMessage(msg) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    // Remove empty state if exists
    const emptyChat = container.querySelector('.empty-chat');
    if (emptyChat) {
        emptyChat.remove();
    }
    
    const isSent = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const messageHTML = `
        <div class="message ${isSent ? 'sent' : 'received'}">
            <div class="message-content">${msg.content || ''}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', messageHTML);
    
    // Scroll to bottom
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 10);
}

// Play message sound
function playMessageSound() {
    try {
        // Simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
        }, 100);
    } catch (e) {
        console.log("Sound not supported");
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !chatFriend) {
        alert("Please type a message!");
        return;
    }

    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.textContent;
    
    // Disable immediately
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    try {
        console.log("Sending:", text, "to:", chatFriend.id);

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

        if (error) {
            console.error("Send error:", error);
            alert("Error sending message: " + error.message);
            return;
        }

        console.log("✅ Message sent:", data);
        input.value = '';
        input.style.height = 'auto';

        // Message will appear via real-time subscription

    } catch (error) {
        console.error("Send failed:", error);
        alert("Failed to send message");
    } finally {
        // Re-enable button
        sendBtn.disabled = false;
        sendBtn.textContent = originalText;
        input.focus();
    }
}

// Handle Enter key
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const input = document.getElementById('messageInput');
        if (input && input.value.trim()) {
            sendMessage();
        }
    }
}

// Auto resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + 'px';
}

// Go back - FIXED: Cleanup
function goBack() {
    // Clean up channels
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
        statusChannel = null;
    }
    window.location.href = '../home/index.html';
}

// Show user info modal
window.showUserInfo = function() {
    if (!chatFriend) {
        alert("User information not available");
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
            <button class="info-action-btn danger" onclick="blockUser()">
                🚫 Block User
            </button>
        </div>
    `;

    modal.style.display = 'flex';
    
    // FIXED: Close on outside click
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeModal();
        }
    };
};

window.closeModal = function() {
    const modal = document.getElementById('userInfoModal');
    if (modal) {
        modal.style.display = 'none';
        modal.onclick = null;
    }
};

window.startVoiceCall = function() {
    alert("Voice call feature coming soon!");
};

window.viewSharedMedia = function() {
    alert("Shared media feature coming soon!");
};

window.blockUser = function() {
    if (confirm(`Are you sure you want to block ${chatFriend.username}?`)) {
        alert("User blocked!");
        goBack();
    }
};

window.attachFile = function() {
    alert("File attachment feature coming soon!");
};

// Clear chat - FIXED SQL syntax
window.clearChat = async function() {
    if (!confirm("Are you sure you want to clear all messages?")) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');

        // FIXED: Correct SQL syntax
        const { error } = await supabase
            .from('direct_messages')
            .delete()
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);

        if (error) throw error;

        alert("Chat cleared!");
        await loadOldMessages(friendId);
    } catch (error) {
        console.error("Clear chat error:", error);
        alert("Error clearing chat");
    }
};

// Make functions global
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.autoResize = autoResize;
window.goBack = goBack;