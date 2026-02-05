import { auth } from '../../utils/auth.js';
import { supabase } from '../../utils/supabase.js';

console.log('✨ Chat Loaded with Enhanced Image Sharing');

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
let isImagePickerOpen = false;

// ImgBB API Key (TEMPORARY - Move to backend for production)
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
window.blockUserPrompt = blockUserPrompt;
window.clearChatPrompt = clearChatPrompt;
window.selectColor = selectColor;
window.hideColorPicker = hideColorPicker;
window.showImagePicker = showImagePicker;
window.closeImagePicker = closeImagePicker;
window.openCamera = openCamera;
window.openGallery = openGallery;
window.viewImageFullscreen = viewImageFullscreen;
window.closeImageViewer = closeImageViewer;
window.downloadImage = downloadImage;
window.shareImage = shareImage;

// ====================
// INITIALIZATION
// ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Hide all overlays on load
        document.getElementById('customAlert').style.display = 'none';
        document.getElementById('customToast').style.display = 'none';
        document.getElementById('userInfoModal').style.display = 'none';
        document.getElementById('imagePickerOverlay').style.display = 'none';

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
        setupFileInputListeners();

        // Initial setup
        setTimeout(() => {
            const input = document.getElementById('messageInput');
            if (input) autoResize(input);
            forceScrollToBottom();
        }, 150);

        console.log('✅ Chat ready with enhanced image sharing!');
    } catch (error) {
        console.error('Init error:', error);
        showCustomAlert('Error loading chat: ' + error.message, '❌', 'Error', () => {
            window.location.href = '../home/index.html';
        });
    }
});

// ====================
// IMAGE PICKER FUNCTIONS
// ====================
function showImagePicker() {
    isImagePickerOpen = true;
    const picker = document.getElementById('imagePickerOverlay');
    if (picker) {
        picker.style.display = 'flex';
        setTimeout(() => {
            picker.style.opacity = '1';
            picker.querySelector('.image-picker-container').style.transform = 'translateY(0)';
        }, 10);
    }
}

function closeImagePicker() {
    isImagePickerOpen = false;
    const picker = document.getElementById('imagePickerOverlay');
    if (picker) {
        picker.style.opacity = '0';
        picker.querySelector('.image-picker-container').style.transform = 'translateY(100%)';
        setTimeout(() => {
            picker.style.display = 'none';
        }, 300);
    }
}

function openCamera() {
    const cameraInput = document.getElementById('cameraInput');
    if (cameraInput) {
        cameraInput.click();
    }
    closeImagePicker();
}

function openGallery() {
    const galleryInput = document.getElementById('galleryInput');
    if (galleryInput) {
        galleryInput.click();
    }
    closeImagePicker();
}

function setupFileInputListeners() {
    const cameraInput = document.getElementById('cameraInput');
    const galleryInput = document.getElementById('galleryInput');

    if (cameraInput) {
        cameraInput.addEventListener('change', function(e) {
            handleImageSelect(e);
        });
    }

    if (galleryInput) {
        galleryInput.addEventListener('change', function(e) {
            handleImageSelect(e);
        });
    }
}

// Close image picker when clicking outside
document.addEventListener('click', (e) => {
    const picker = document.getElementById('imagePickerOverlay');
    const attachBtn = document.getElementById('attachBtn');

    if (isImagePickerOpen && picker && !picker.contains(e.target) && e.target !== attachBtn) {
        closeImagePicker();
    }
});

// ====================
// IMAGE UPLOAD FUNCTIONS
// ====================
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

    // Reset file inputs
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
        showRetryAlert('Failed to upload image: ' + error.message, () => {
            uploadImageToImgBB(file);
        });
    } finally {
        showLoading(false);
    }
}

async function compressImage(file, maxSize = 800 * 1024) {
    return new Promise((resolve, reject) => {
        // If file is already small, return as-is
        if (file.size <= maxSize) {
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

                // Calculate new dimensions (max 1200px for better quality)
                let width = img.width;
                let height = img.height;
                const maxDimension = 1200;

                if (width > height && width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw with better quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Try multiple quality levels if still too large
                const compressWithQuality = (quality = 0.8) => {
                    canvas.toBlob((blob) => {
                        if (blob.size <= maxSize || quality <= 0.3) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            // Try lower quality
                            compressWithQuality(quality - 0.1);
                        }
                    }, 'image/jpeg', quality);
                };

                compressWithQuality();
            };

            img.onerror = reject;
        };

        reader.onerror = reject;
    });
}

async function sendImageMessage(imageUrl, thumbnailUrl) {
    if (isSending) return;

    isSending = true;
    const sendBtn = document.getElementById('sendBtn');
    const originalHTML = sendBtn.innerHTML;

    try {
        // Show sending state
        sendBtn.innerHTML = `
            <svg class="send-icon" viewBox="0 0 24 24" style="opacity: 0.5">
                <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
            </svg>
        `;
        sendBtn.disabled = true;

        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: '',
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
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
        }, 300);
    } catch (error) {
        console.error('Send image failed:', error);
        showCustomAlert('Failed to send image: ' + error.message, '❌', 'Error');
        isSending = false;
        sendBtn.innerHTML = originalHTML;
        sendBtn.disabled = false;
    }
}

// ====================
// IMAGE VIEWER FUNCTIONS
// ====================
function viewImageFullscreen(imageUrl) {
    // Remove existing viewer if any
    const existingViewer = document.getElementById('imageViewerOverlay');
    if (existingViewer) {
        existingViewer.remove();
    }

    // Create fullscreen viewer
    const viewerHTML = `
        <div class="image-viewer-overlay" id="imageViewerOverlay">
            <button class="viewer-close" onclick="closeImageViewer()">
                <svg viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
            </button>
            <div class="viewer-image-container">
                <img src="${imageUrl}" alt="Shared image" class="viewer-image" 
                     onload="this.style.opacity='1'; this.classList.add('loaded')"
                     onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\" viewBox=\"0 0 24 24\"><path fill=\"%23ccc\" d=\"M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z\"/></svg>'">
            </div>
            <div class="viewer-actions">
                <button class="viewer-action-btn" onclick="downloadImage('${imageUrl}')">
                    <svg viewBox="0 0 24 24">
                        <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                    </svg>
                    <span>Download</span>
                </button>
                <button class="viewer-action-btn" onclick="shareImage('${imageUrl}')">
                    <svg viewBox="0 0 24 24">
                        <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19C20.92,17.39 19.61,16.08 18,16.08Z"/>
                    </svg>
                    <span>Share</span>
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', viewerHTML);

    // Animate in
    setTimeout(() => {
        const viewer = document.getElementById('imageViewerOverlay');
        if (viewer) {
            viewer.style.opacity = '1';
        }
    }, 10);
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewerOverlay');
    if (viewer) {
        viewer.style.opacity = '0';
        setTimeout(() => {
            viewer.remove();
        }, 300);
    }
}

function downloadImage(imageUrl) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'relaytalk-image-' + Date.now() + '.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Download started', '📥', 2000);
}

async function shareImage(imageUrl) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Image from RelayTalk',
                text: 'Check out this image shared on RelayTalk!',
                url: imageUrl
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                // Fallback to clipboard
                copyToClipboard(imageUrl);
            }
        }
    } else {
        copyToClipboard(imageUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showToast('Image URL copied!', '📋', 2000))
        .catch(() => showToast('Cannot copy URL', '⚠️', 2000));
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
                     onload="this.style.opacity='1'; this.classList.add('loaded')"
                     onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\" viewBox=\"0 0 24 24\"><path fill=\"%23ccc\" d=\"M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z\"/></svg>'">
                <div class="image-overlay">
                    <svg class="image-icon" viewBox="0 0 24 24">
                        <path d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/>
                    </svg>
                </div>
            </div>
            ${msg.content ? `<div class="image-caption">${msg.content}</div>` : ''}
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
                <svg class="empty-chat-icon" viewBox="0 0 24 24">
                    <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z"/>
                </svg>
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

    // Animate new message
    const newMessage = container.lastElementChild;
    if (newMessage && isFromRealtime) {
        newMessage.style.opacity = '0';
        newMessage.style.transform = 'translateY(10px)';

        setTimeout(() => {
            newMessage.style.transition = 'all 0.3s ease';
            newMessage.style.opacity = '1';
            newMessage.style.transform = 'translateY(0)';
        }, 10);
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
        setTimeout(() => {
            colorPicker.style.opacity = '1';
        }, 10);

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
        colorPicker.style.opacity = '0';
        setTimeout(() => {
            colorPicker.style.display = 'none';
        }, 300);

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
    const originalHTML = sendBtn.innerHTML;

    try {
        console.log('📤 Sending message to:', chatFriend.id);
        sendBtn.innerHTML = `
            <svg class="send-icon" viewBox="0 0 24 24" style="opacity: 0.5">
                <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
            </svg>
        `;
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
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
        }, 300);
    } catch (error) {
        console.error('Send failed:', error);
        showCustomAlert('Failed to send message: ' + error.message, '❌', 'Error');
        isSending = false;
        sendBtn.innerHTML = originalHTML;
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

    alertIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/></svg>';
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

    alertIcon.innerHTML = icon;
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

function showRetryAlert(message, onRetry, onCancel = null) {
    const alertOverlay = document.getElementById('customAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertConfirm = document.getElementById('alertConfirm');
    const alertCancel = document.getElementById('alertCancel');

    alertIcon.innerHTML = '❌';
    alertTitle.textContent = 'Upload Failed';
    alertMessage.textContent = message;
    alertCancel.style.display = 'inline-block';

    alertConfirm.textContent = 'Retry';
    alertConfirm.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onRetry) onRetry();
    };

    alertCancel.textContent = 'Cancel';
    alertCancel.onclick = () => {
        alertOverlay.style.display = 'none';
        if (onCancel) onCancel();
        showToast('Upload cancelled', '⚠️');
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

    alertIcon.innerHTML = icon;
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

    toastIcon.innerHTML = icon;
    toastMessage.textContent = message;
    toast.style.display = 'flex';
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
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
            <button class="info-action-btn danger" onclick="blockUserPrompt()">🚫 Block User</button>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('userInfoModal').style.display = 'none';
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
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.getElementById('loadingOverlay');

    if (!loadingOverlay) {
        const loadingHTML = `
            <div class="loading-overlay" id="loadingOverlay" style="display: none;">
                <div class="loading-spinner"></div>
                <p class="loading-text">${text}</p>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
        loadingOverlay = document.getElementById('loadingOverlay');
    }

    if (show) {
        loadingOverlay.querySelector('.loading-text').textContent = text;
        loadingOverlay.style.display = 'flex';
        setTimeout(() => {
            loadingOverlay.style.opacity = '1';
        }, 10);
    } else {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
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

// ====================
// CLEANUP ON UNLOAD
// ====================
window.addEventListener('beforeunload', () => {
    if (chatChannel) supabase.removeChannel(chatChannel);
    if (statusChannel) supabase.removeChannel(statusChannel);
    if (typingTimeout) clearTimeout(typingTimeout);
    if (friendTypingTimeout) clearTimeout(friendTypingTimeout);
});