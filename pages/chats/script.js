import { auth } from '../../utils/auth.js';
import { supabase } from '../../utils/supabase.js';

console.log('✨ Chat Loaded with Image Sharing');

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
let selectedColor = null;
let colorPickerVisible = false;

// ImgBB API Key
const IMGBB_API_KEY = '82e49b432e2ee14921f7d0cd81ba5551';

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
window.selectColor = selectColor;
window.hideColorPicker = hideColorPicker;
window.attachImage = attachImage;
window.viewImageFullscreen = viewImageFullscreen;
window.closeImageViewer = closeImageViewer;
window.downloadImage = downloadImage;
window.shareImage = shareImage;

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
        
        // Initialize UI components
        initializeColorPicker();
        addColorPickerInputListener();

        // Initial setup
        setTimeout(() => {
            const input = document.getElementById('messageInput');
            if (input) autoResize(input);
            forceScrollToBottom();
        }, 150);

        console.log('✅ Chat ready with image sharing!');
    } catch (error) {
        console.error('Init error:', error);
        showCustomAlert('Error loading chat: ' + error.message, '❌', 'Error', () => {
            window.location.href = '../home/index.html';
        });
    }
});

// ====================
// IMAGE UPLOAD FUNCTIONS
// ====================
function attachImage() {
    const fileInput = document.getElementById('imageFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// Add event listener for file input
document.getElementById('imageFileInput').addEventListener('change', handleImageSelect);

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', '⚠️');
        return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image too large. Max 10MB', '⚠️');
        return;
    }
    
    // Upload image
    uploadImageToImgBB(file);
    
    // Reset file input
    event.target.value = '';
}

async function uploadImageToImgBB(file) {
    showLoading(true, 'Uploading image...');
    
    try {
        // Compress image if needed
        const processedFile = await compressImage(file);
        
        // Create FormData
        const formData = new FormData();
        formData.append('image', processedFile);
        formData.append('key', IMGBB_API_KEY);
        
        // Upload to ImgBB
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error?.message || 'Upload failed');
        }
        
        // Get image URL
        const imageUrl = data.data.url;
        const thumbnailUrl = data.data.thumb?.url || imageUrl;
        
        console.log('✅ Image uploaded:', imageUrl);
        
        // Send message with image
        await sendImageMessage(imageUrl, thumbnailUrl);
        
    } catch (error) {
        console.error('Image upload error:', error);
        showCustomAlert('Failed to upload image: ' + error.message, '❌', 'Upload Error');
    } finally {
        showLoading(false);
    }
}

async function compressImage(file) {
    return new Promise((resolve) => {
        // If file is already small, return as-is
        if (file.size <= 500 * 1024) { // 500KB
            resolve(file);
            return;
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 1200px)
                let width = img.width;
                let height = img.height;
                const maxSize = 1200;
                
                if (width > height && width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', 0.7); // 70% quality
            };
        };
    });
}

async function sendImageMessage(imageUrl, thumbnailUrl) {
    if (isSending) return;
    
    isSending = true;
    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.innerHTML;

    try {
        sendBtn.innerHTML = '<div class="typing-dots"><div></div><div></div><div></div></div>';
        sendBtn.disabled = true;

        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: '📸 Image',
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            created_at: new Date().toISOString()
        };

        // Add color if selected
        if (selectedColor) {
            messageData.color = selectedColor;
            selectedColor = null;
            
            // Clear selected color UI
            const colorOptions = document.querySelectorAll('.color-option');
            colorOptions.forEach(option => {
                option.classList.remove('selected');
            });
        }

        const { data, error } = await supabase
            .from('direct_messages')
            .insert(messageData)
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Image message sent:', data.id);
        playSentSound();

        // Clear input
        const input = document.getElementById('messageInput');
        if (input) {
            input.value = '';
            autoResize(input);
        }

        isTyping = false;
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            typingTimeout = null;
        }
        sendTypingStatus(false);

        setTimeout(() => {
            if (input) input.focus();
            isSending = false;
            sendBtn.innerHTML = originalText;
            sendBtn.disabled = false;
        }, 300);
    } catch (error) {
        console.error('Send image failed:', error);
        showCustomAlert('Failed to send image: ' + error.message, '❌', 'Error');
        isSending = false;
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    }
}

function viewImageFullscreen(imageUrl) {
    // Create fullscreen viewer
    const viewerHTML = `
        <div class="image-viewer-overlay" id="imageViewerOverlay">
            <div class="image-viewer-container">
                <button class="viewer-close" onclick="closeImageViewer()">×</button>
                <div class="viewer-image-container">
                    <img src="${imageUrl}" alt="Shared image" class="viewer-image" 
                         onload="this.style.opacity='1'" 
                         onclick="closeImageViewer()">
                </div>
                <div class="viewer-actions">
                    <button class="viewer-action-btn" onclick="downloadImage('${imageUrl}')">📥 Download</button>
                    <button class="viewer-action-btn" onclick="shareImage('${imageUrl}')">↗️ Share</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', viewerHTML);
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewerOverlay');
    if (viewer) {
        viewer.remove();
    }
}

function downloadImage(imageUrl) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'relaytalk-image-' + Date.now() + '.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function shareImage(imageUrl) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Image from RelayTalk',
                url: imageUrl
            });
        } catch (error) {
            console.log('Share cancelled:', error);
        }
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(imageUrl)
            .then(() => showToast('Image URL copied!', '📋'))
            .catch(() => showToast('Cannot share image', '⚠️'));
    }
}

// ====================
// MESSAGE DISPLAY FUNCTIONS
// ====================
function createImageMessageHTML(msg, isSent, colorAttr, time) {
    const thumbnailUrl = msg.thumbnail_url || msg.image_url;
    
    return `
        <div class="message ${isSent ? 'sent' : 'received'} image-message" data-message-id="${msg.id}" ${colorAttr}>
            <div class="message-image-container" onclick="viewImageFullscreen('${msg.image_url}')">
                <img src="${thumbnailUrl}" alt="Shared image" class="message-image" 
                     loading="lazy" 
                     onerror="this.src='https://img.icons8.com/color/96/000000/no-image.png'">
                <div class="image-overlay">
                    <span class="image-icon">📸</span>
                </div>
            </div>
            ${msg.content && msg.content !== '📸 Image' ? 
                `<div class="image-caption">${msg.content}</div>` : ''}
            <div class="message-time">${time}</div>
        </div>
    `;
}

function createTextMessageHTML(msg, isSent, colorAttr, time) {
    return `
        <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}" ${colorAttr}>
            <div class="message-content">${msg.content || ''}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
}

function showMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

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

        // Get color from database
        const color = msg.color || null;
        const colorAttr = color ? `data-color="${color}"` : '';
        
        // Check if message has image
        if (msg.image_url) {
            html += createImageMessageHTML(msg, isSent, colorAttr, time);
        } else {
            html += createTextMessageHTML(msg, isSent, colorAttr, time);
        }
    });

    html += `<div style="height: 30px; opacity: 0;"></div>`;
    container.innerHTML = html;

    setTimeout(() => {
        forceScrollToBottom();
    }, 100);
}

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

    const color = message.color || null;
    const colorAttr = color ? `data-color="${color}"` : '';
    
    let messageHTML;
    
    if (message.image_url) {
        messageHTML = createImageMessageHTML(message, isSent, colorAttr, time);
    } else {
        messageHTML = createTextMessageHTML(message, isSent, colorAttr, time);
    }

    container.insertAdjacentHTML('beforeend', messageHTML);

    const isDuplicate = currentMessages.some(msg => msg.id === message.id);
    if (!isDuplicate) {
        currentMessages.push(message);
    }

    setTimeout(() => {
        forceScrollToBottom();
    }, 10);

    if (message.sender_id === chatFriend.id) {
        playReceivedSound();
        if (!document.hasFocus()) {
            const originalTitle = document.title;
            document.title = '📸 ' + chatFriend.username;
            setTimeout(() => document.title = originalTitle, 1000);
        }
    }
}

// ====================
// COLOR PICKER FUNCTIONS
// ====================
function initializeColorPicker() {
    const colorPickerHTML = `
        <div class="color-picker-overlay" id="colorPickerOverlay" style="display: none;">
            <div class="color-picker-title">Choose text color</div>
            <div class="color-picker-grid">
                <div class="color-option" data-color="red" onclick="selectColor('red')" title="Red"></div>
                <div class="color-option" data-color="green" onclick="selectColor('green')" title="Green"></div>
                <div class="color-option" data-color="blue" onclick="selectColor('blue')" title="Blue"></div>
                <div class="color-option" data-color="white" onclick="selectColor('white')" title="White"></div>
                <div class="color-option" data-color="black" onclick="selectColor('black')" title="Black"></div>
                <div class="color-option" data-color="yellow" onclick="selectColor('yellow')" title="Yellow"></div>
                <div class="color-option" data-color="cyan" onclick="selectColor('cyan')" title="Cyan"></div>
            </div>
        </div>
    `;
    
    const inputWrapper = document.getElementById('messageInputWrapper');
    if (inputWrapper) {
        inputWrapper.insertAdjacentHTML('beforebegin', colorPickerHTML);
    }
}

function addColorPickerInputListener() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    
    input.addEventListener('input', function(e) {
        const text = this.value;
        const colorPicker = document.getElementById('colorPickerOverlay');
        
        // Check if first character is /
        if (text.startsWith('/') && text.length === 1) {
            showColorPicker();
        } else if (colorPickerVisible && text.length > 1) {
            hideColorPicker();
        } else if (!text.startsWith('/')) {
            hideColorPicker();
        }
    });
    
    input.addEventListener('focus', function() {
        if (this.value.startsWith('/') && this.value.length === 1) {
            showColorPicker();
        }
    });
    
    input.addEventListener('blur', function() {
        setTimeout(() => {
            if (!document.querySelector('.color-option:hover')) {
                hideColorPicker();
            }
        }, 300);
    });
    
    document.addEventListener('click', function(e) {
        const colorPicker = document.getElementById('colorPickerOverlay');
        const input = document.getElementById('messageInput');
        
        if (colorPicker && colorPicker.style.display === 'flex' && 
            !colorPicker.contains(e.target) && 
            e.target !== input) {
            hideColorPicker();
        }
    });
}

function showColorPicker() {
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = true;
        colorPicker.style.display = 'flex';
        
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.remove('selected');
        });
    }
}

function hideColorPicker() {
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = false;
        colorPicker.style.display = 'none';
        
        const input = document.getElementById('messageInput');
        if (input && input.value === '/') {
            input.value = '';
            autoResize(input);
        }
    }
}

function selectColor(color) {
    selectedColor = color;
    const input = document.getElementById('messageInput');
    
    if (input) {
        input.value = '';
        input.focus();
        autoResize(input);
    }
    
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-color') === color) {
            option.classList.add('selected');
        }
    });
    
    showToast(`Selected ${color} color`, '🎨', 1000);
    
    setTimeout(() => {
        hideColorPicker();
    }, 800);
}

// ====================
// TEXT MESSAGE FUNCTIONS
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

        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: text,
            created_at: new Date().toISOString()
        };

        if (selectedColor) {
            messageData.color = selectedColor;
        }

        const { data, error } = await supabase
            .from('direct_messages')
            .insert(messageData)
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Message sent:', data.id);
        
        selectedColor = null;
        
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
// MESSAGE LOADING
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
// INPUT HANDLERS
// ====================
function handleKeyPress(event) {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    if (sendBtn) {
        sendBtn.disabled = !input || input.value.trim() === '';
    }

    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        
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
// SCROLL FUNCTIONS
// ====================
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    container.scrollTop = container.scrollHeight;
}

function forceScrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    container.scrollTop = container.scrollHeight;

    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        const lastChild = container.lastElementChild;
        if (lastChild) {
            lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }, 100);
}

// ====================
// LOADING FUNCTION
// ====================
function showLoading(show, text = 'Sending...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) return;
    
    if (show) {
        loadingOverlay.innerHTML = `
            <div class="login-loader"></div>
            <p class="loading-text">${text}</p>
        `;
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

// ====================
// CHROME SPECIFIC FIXES
// ====================
if (navigator.userAgent.includes('Chrome')) {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.style.transform = 'translateZ(0)';
            }
        }, 500);
    });
}