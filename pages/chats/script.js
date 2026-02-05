import { auth } from '../../utils/auth.js';
import { supabase } from '../../utils/supabase.js';

console.log('✨ Chat Loaded - Chrome Optimized');

// ====================
// GLOBAL VARIABLES
// ====================
let currentUser = null;
let chatFriend = null;
let chatChannel = null;
let statusChannel = null;
let isLoadingMessages = false;
let currentMessages = [];
let isSending = false;
let isTyping = false;
let typingTimeout = null;
let friendTypingTimeout = null;
let selectedColor = null; // Add this for color selection
let colorPickerVisible = false;

// ====================
// GLOBAL FUNCTION EXPORTS
// ====================
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.autoResize = autoResize;
window.goBack = goBack;
window.showUserInfo = showUserInfo;
window.closeModal = closeModal;
window.startVoiceCall = startVoiceCall;
window.viewSharedMedia = viewSharedMedia;
window.blockUserPrompt = blockUserPrompt;
window.clearChatPrompt = clearChatPrompt;
window.selectColor = selectColor; // Add this

// ====================
// INITIALIZATION
// ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Hide all alerts on load
        document.getElementById('customAlert').style.display = 'none';
        document.getElementById('customToast').style.display = 'none';
        document.getElementById('userInfoModal').style.display = 'none';

        const { success, user } = await auth.getCurrentUser();
        if (!success || !user) {
            showLoginAlert();
            return;
        }

        currentUser = user;
        console.log('Current User:', user.id);

        const urlParams = new URLSearchParams(window.location.search);
        const friendId = urlParams.get('friendId');

        if (!friendId) {
            showCustomAlert('No friend selected!', '😕', 'Error', () => {
                window.location.href = '../home/index.html';
            });
            return;
        }

        const { data: friend, error: friendError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', friendId)
            .single();

        if (friendError) throw friendError;

        chatFriend = friend;
        document.getElementById('chatUserName').textContent = friend.username;
        document.getElementById('chatUserAvatar').textContent = friend.username.charAt(0).toUpperCase();

        updateFriendStatus(friend.status);
        await loadOldMessages(friendId);
        setupRealtime(friendId);
        setupTypingListener();
        updateInputListener();
        
        // Initialize color picker
        initializeColorPicker();
        addColorPickerInputListener();

        // Initial setup
        setTimeout(() => {
            const input = document.getElementById('messageInput');
            if (input) autoResize(input);
            forceScrollToBottom();
        }, 150);

        console.log('✅ Chat ready!');
    } catch (error) {
        console.error('Init error:', error);
        showCustomAlert('Error loading chat: ' + error.message, '❌', 'Error', () => {
            window.location.href = '../home/index.html';
        });
    }
});

// ====================
// COLOR PICKER FUNCTIONS
// ====================
function initializeColorPicker() {
    // Create color picker HTML
    const colorPickerHTML = `
        <div class="color-picker-overlay" id="colorPickerOverlay">
            <div class="color-picker-title">Choose text color</div>
            <div class="color-picker-grid">
                <div class="color-option" data-color="red" onclick="selectColor('red')"></div>
                <div class="color-option" data-color="green" onclick="selectColor('green')"></div>
                <div class="color-option" data-color="blue" onclick="selectColor('blue')"></div>
                <div class="color-option" data-color="white" onclick="selectColor('white')"></div>
                <div class="color-option" data-color="black" onclick="selectColor('black')"></div>
                <div class="color-option" data-color="yellow" onclick="selectColor('yellow')"></div>
                <div class="color-option" data-color="cyan" onclick="selectColor('cyan')"></div>
            </div>
        </div>
    `;
    
    // Add color picker to the DOM
    document.body.insertAdjacentHTML('afterbegin', colorPickerHTML);
}

function addColorPickerInputListener() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    input.addEventListener('input', function(e) {
        const text = this.value;
        const colorPicker = document.getElementById('colorPickerOverlay');
        
        // Check if first character is /
        if (text.startsWith('/') && text.length === 1) {
            // Show color picker
            colorPickerVisible = true;
            if (colorPicker) {
                colorPicker.style.display = 'flex';
                
                // Adjust main content position
                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    const pickerHeight = colorPicker.offsetHeight;
                    mainContent.style.top = `calc(80px + ${pickerHeight}px)`;
                }
            }
        } else if (colorPickerVisible && text.length > 1) {
            // Hide color picker if user continues typing
            hideColorPicker();
        } else if (!text.startsWith('/')) {
            // Hide if / is removed
            hideColorPicker();
        }
    });
    
    // Also check on focus
    input.addEventListener('focus', function() {
        if (this.value.startsWith('/') && this.value.length === 1) {
            showColorPicker();
        }
    });
    
    // Hide on blur
    input.addEventListener('blur', function() {
        setTimeout(() => {
            hideColorPicker();
        }, 200);
    });
}

function showColorPicker() {
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = true;
        colorPicker.style.display = 'flex';
        
        // Adjust main content position
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            const pickerHeight = colorPicker.offsetHeight;
            mainContent.style.top = `calc(80px + ${pickerHeight}px)`;
        }
    }
}

function hideColorPicker() {
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = false;
        colorPicker.style.display = 'none';
        
        // Reset main content position
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.top = '80px';
        }
    }
}

function selectColor(color) {
    selectedColor = color;
    const input = document.getElementById('messageInput');
    
    // Clear the / character and keep focus
    if (input) {
        input.value = '';
        input.focus();
    }
    
    // Update color picker UI
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-color') === color) {
            option.classList.add('selected');
        }
    });
    
    // Show toast for selected color
    showToast(`Selected ${color} color`, '🎨', 1000);
    
    // Hide color picker after selection
    setTimeout(() => {
        hideColorPicker();
    }, 500);
}

// ====================
// TYPING FUNCTIONS
// ====================
function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        sendTypingStatus(true);
    }

    if (typingTimeout) clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
        isTyping = false;
        sendTypingStatus(false);
    }, 2000);
}

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
        console.log('Typing status error:', error);
    }
}

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

function showTypingIndicator(show) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    let indicator = document.getElementById('typingIndicator');

    if (!indicator) {
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
        indicator = document.getElementById('typingIndicator');
    }

    if (indicator) {
        indicator.style.display = show ? 'flex' : 'none';

        if (show) {
            if (friendTypingTimeout) clearTimeout(friendTypingTimeout);
            friendTypingTimeout = setTimeout(() => {
                indicator.style.display = 'none';
            }, 3000);
        }
    }
}

function updateInputListener() {
    const input = document.getElementById('messageInput');
    if (input) {
        input.addEventListener('input', handleTyping);
    }
}

// ====================
// SOUND FUNCTIONS
// ====================
function playSentSound() {
    try {
        const audio = new Audio('sent.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Sound play failed:', e));
    } catch (error) {
        console.log('Sound error:', error);
    }
}

function playReceivedSound() {
    try {
        const audio = new Audio('recieve.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Sound play failed:', e));
    } catch (error) {
        console.log('Sound error:', error);
    }
}

// ====================
// ALERT FUNCTIONS
// ====================
function showLoginAlert() {
    const alertOverlay = document.getElementById('customAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertConfirm = document.getElementById('alertConfirm');
    const alertCancel = document.getElementById('alertCancel');

    alertIcon.textContent = '🔐';
    alertTitle.textContent = 'Login Required';
    alertMessage.textContent = 'Please login or signup to continue chatting!';
    alertCancel.style.display = 'inline-block';

    alertConfirm.textContent = 'Login';
    alertConfirm.onclick = () => {
        alertOverlay.style.display = 'none';
        window.location.href = '../login/index.html';
    };

    alertCancel.textContent = 'Signup';
    alertCancel.onclick = () => {
        alertOverlay.style.display = 'none';
        window.location.href = '../auth/index.html';
    };

    alertOverlay.style.display = 'flex';
}

function showCustomAlert(message, icon = '⚠️', title = 'Alert', onConfirm = null) {
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

    alertConfirm.textContent = 'OK';
    alertConfirm.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    alertOverlay.style.display = 'flex';
}

function showConfirmAlert(message, icon = '❓', title = 'Confirm', onConfirm, onCancel = null) {
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

    alertConfirm.textContent = 'Yes';
    alertConfirm.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    alertCancel.textContent = 'No';
    alertCancel.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onCancel) onCancel();
    };

    alertOverlay.style.display = 'flex';
}

function showToast(message, icon = 'ℹ️', duration = 3000) {
    const toast = document.getElementById('customToast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');

    toastIcon.textContent = icon;
    toastMessage.textContent = message;
    toast.style.display = 'flex';

    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// ====================
// MESSAGE FUNCTIONS
// ====================
async function loadOldMessages(friendId) {
    if (isLoadingMessages) return;
    isLoadingMessages = true;

    try {
        console.log('Loading messages for friend:', friendId);

        const { data: messages, error } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Query error:', error);
            throw error;
        }

        console.log('Loaded', messages?.length || 0, 'messages');
        currentMessages = messages || [];
        showMessages(currentMessages);
    } catch (error) {
        console.error('Load error:', error);
        showMessages([]);
    } finally {
        isLoadingMessages = false;
    }
}

function showMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    console.log('Showing', messages?.length || 0, 'messages');

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

        // Check if message has color data
        const color = msg.color || null;
        const colorAttr = color ? `data-color="${color}"` : '';
        
        html += `
            <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}" ${colorAttr}>
                <div class="message-content">${msg.content || ''}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    });

    // Add spacer to ensure visibility
    html += `<div style="height: 30px; opacity: 0;"></div>`;
    container.innerHTML = html;

    // Force scroll after rendering
    setTimeout(() => {
        forceScrollToBottom();
    }, 100);
}

// ====================
// SCROLL FUNCTIONS - CHROME OPTIMIZED
// ====================
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // Method 1: Direct scroll
    container.scrollTop = container.scrollHeight;

    // Method 2: Double check
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function forceScrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    // Multiple methods for Chrome
    container.scrollTop = container.scrollHeight;

    setTimeout(() => {
        container.scrollTop = container.scrollHeight;

        // Try smooth scroll
        const lastChild = container.lastElementChild;
        if (lastChild) {
            lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }

        // Final check
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }, 100);
}

function addMessageToUI(message, isFromRealtime = false) {
    const container = document.getElementById('messagesContainer');
    if (!container || !message) return;

    // Remove empty state if it exists
    if (container.querySelector('.empty-chat')) {
        container.innerHTML = '';
    }

    const isSent = message.sender_id === currentUser.id;
    const time = new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Check if message has color data
    const color = message.color || null;
    const colorAttr = color ? `data-color="${color}"` : '';
    
    const messageHTML = `
        <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message.id}" ${colorAttr}>
            <div class="message-content">${message.content || ''}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', messageHTML);

    // Check for duplicate
    const isDuplicate = currentMessages.some(msg => msg.id === message.id);
    if (!isDuplicate) {
        currentMessages.push(message);
    }

    // Force scroll for new messages
    setTimeout(() => {
        forceScrollToBottom();
    }, 10);

    // Play sound for received messages
    if (message.sender_id === chatFriend.id) {
        playReceivedSound();
        if (!document.hasFocus()) {
            const originalTitle = document.title;
            document.title = '💬 ' + chatFriend.username;
            setTimeout(() => document.title = originalTitle, 1000);
        }
    }
}

// ====================
// STATUS FUNCTIONS
// ====================
function updateFriendStatus(status) {
    const isOnline = status === 'online';
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');

    if (isOnline) {
        statusText.textContent = 'Online';
        statusText.style.color = '#28a745';
        statusDot.className = 'status-dot';
        statusDot.style.boxShadow = '0 0 8px #28a745';
    } else {
        statusText.textContent = 'Offline';
        statusText.style.color = '#6c757d';
        statusDot.className = 'status-dot offline';
        statusDot.style.boxShadow = 'none';
    }
}

// ====================
// REALTIME FUNCTIONS
// ====================
function setupRealtime(friendId) {
    console.log('🔧 Setting up realtime for friend:', friendId);

    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
    }

    chatChannel = supabase.channel(`dm:${currentUser.id}:${friendId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages'
        }, (payload) => {
            console.log('📨 Realtime INSERT detected:', payload.new);
            const newMsg = payload.new;
            const isOurMessage = 
                (newMsg.sender_id === currentUser.id && newMsg.receiver_id === friendId) ||
                (newMsg.sender_id === friendId && newMsg.receiver_id === currentUser.id);

            if (isOurMessage) {
                const existingMessage = document.querySelector(`[data-message-id="${newMsg.id}"]`);
                if (!existingMessage) {
                    console.log('✅ Adding new message to UI (from realtime)');
                    addMessageToUI(newMsg, true);
                } else {
                    console.log('🔄 Message already in UI, skipping:', newMsg.id);
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
            console.log('🔄 Friend status updated:', payload.new.status);
            if (payload.new.id === friendId) {
                chatFriend.status = payload.new.status;
                updateFriendStatus(payload.new.status);

                if (payload.new.status === 'online') {
                    showToast(`${chatFriend.username} is now online`, '🟢', 2000);
                } else {
                    showToast(`${chatFriend.username} is now offline`, '⚫', 2000);
                }
            }
        })
        .subscribe();

    console.log('✅ Realtime active');
}

// ====================
// SEND MESSAGE - UPDATED FOR COLOR
// ====================
async function sendMessage() {
    if (isSending) {
        console.log('🔄 Message already being sent, skipping...');
        return;
    }

    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !chatFriend) {
        showToast('Please type a message!', '⚠️');
        return;
    }

    isSending = true;
    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.innerHTML;

    try {
        console.log('📤 Sending message to:', chatFriend.id);
        sendBtn.innerHTML = '<div class="typing-dots"><div></div><div></div><div></div></div>';
        sendBtn.disabled = true;

        // Prepare message data with color if selected
        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: text,
            created_at: new Date().toISOString()
        };

        // Add color if selected
        if (selectedColor) {
            messageData.color = selectedColor;
        }

        const { data, error } = await supabase
            .from('direct_messages')
            .insert(messageData)
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Message sent to database:', data.id);
        
        // Reset color selection after sending
        selectedColor = null;
        
        // Clear selected color UI
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.remove('selected');
        });
        
        playSentSound();
        input.value = '';
        autoResize(input);

        isTyping = false;
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            typingTimeout = null;
        }
        sendTypingStatus(false);

        setTimeout(() => {
            input.focus();
            isSending = false;
            sendBtn.innerHTML = originalText;
            sendBtn.disabled = false;
        }, 300);
    } catch (error) {
        console.error('Send failed:', error);
        showCustomAlert('Failed to send message: ' + error.message, '❌', 'Error');
        isSending = false;
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    }
}

// ====================
// INPUT HANDLERS - UPDATED FOR COLOR PICKER
// ====================
function handleKeyPress(event) {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    if (sendBtn) {
        sendBtn.disabled = !input || input.value.trim() === '';
    }

    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        
        // Don't send if color picker is active with just /
        if (input && input.value === '/') {
            return;
        }
        
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

// ====================
// NAVIGATION
// ====================
function goBack() {
    if (chatChannel) {
        supabase.removeChannel(chatChannel);
    }
    if (statusChannel) {
        supabase.removeChannel(statusChannel);
    }
    window.location.href = '../home/index.html';
}

// ====================
// USER INFO MODAL
// ====================
function showUserInfo() {
    if (!chatFriend) {
        showToast('User information not available', '⚠️');
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
            <button class="info-action-btn primary" onclick="startVoiceCall()">🎤 Voice Call</button>
            <button class="info-action-btn secondary" onclick="viewSharedMedia()">📷 Shared Media</button>
            <button class="info-action-btn danger" onclick="blockUserPrompt()">🚫 Block User</button>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('userInfoModal').style.display = 'none';
}

function startVoiceCall() {
    showToast('Voice call feature coming soon!', '📞');
}

function viewSharedMedia() {
    showToast('Shared media feature coming soon!', '📷');
}

function blockUserPrompt() {
    showConfirmAlert(
        `Are you sure you want to block ${chatFriend.username}?`,
        '🚫',
        'Block User',
        () => {
            showToast('User blocked!', '✅');
            setTimeout(goBack, 1000);
        }
    );
}

// ====================
// CLEAR CHAT
// ====================
async function clearChatPrompt() {
    showConfirmAlert(
        'Are you sure you want to clear all messages?',
        '🗑️',
        'Clear Chat',
        async () => {
            try {
                const friendId = new URLSearchParams(window.location.search).get('friendId');
                const { error } = await supabase
                    .from('direct_messages')
                    .delete()
                    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`);

                if (error) throw error;

                showToast('Chat cleared!', '✅');
                currentMessages = [];
                showMessages([]);
            } catch (error) {
                console.error('Clear chat error:', error);
                showCustomAlert('Error clearing chat', '❌', 'Error');
            }
        }
    );
}

// ====================
// CHROME SPECIFIC FIXES
// ====================
// Add Chrome scroll fix
if (navigator.userAgent.includes('Chrome')) {
    document.addEventListener('DOMContentLoaded', function() {
        // Fix Chrome rendering
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.style.transform = 'translateZ(0)';
            }
        }, 500);
    });
}