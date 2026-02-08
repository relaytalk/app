import { supabase } from '../../utils/supabase.js';

console.log('✨ Image Handler Initialized - UPLOAD FIX VERSION');

// ====================
// IMAGE HANDLING VARIABLES
// ====================
let selectedColor = null;
let colorPickerVisible = false;
let isImagePickerOpen = false;
let imagePreviewUrl = null;
let currentFileForUpload = null;
let uploadInProgress = false;

// API Key
const IMGBB_API_KEY = '82e49b432e2ee14921f7d0cd81ba5551';

// ====================
// GLOBAL FUNCTION EXPORTS
// ====================
window.selectColor = selectColor;
window.hideColorPicker = hideColorPicker;
window.showColorPicker = showColorPicker;
window.showImagePicker = showImagePicker;
window.closeImagePicker = closeImagePicker;
window.openCamera = openCamera;
window.openGallery = openGallery;
window.viewImageFullscreen = viewImageFullscreen;
window.closeImageViewer = closeImageViewer;
window.downloadImage = downloadImage;
window.shareImage = shareImage;
window.handleImageLoad = handleImageLoad;
window.handleImageError = handleImageError;
window.cancelImageUpload = cancelImageUpload;
window.sendImagePreview = sendImagePreview;
window.createImageMessageHTML = createImageMessageHTML;
window.uploadImageFromPreview = uploadImageFromPreview;
window.removeSelectedColor = removeSelectedColor;
window.cancelColorSelection = cancelColorSelection;
window.handleImageSelect = handleImageSelect;

// Signal that img-handler is loaded
if (window.chatModules) {
    window.chatModules.imgHandlerLoaded = true;
    console.log('✅ img-handler.js loaded and ready');
}

// ====================
// INITIALIZATION
// ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Initializing image handler...');

    // Initialize after a short delay
    setTimeout(() => {
        initializeColorPicker();
        setupSlashHandler();
        setupFileInputListeners();
        setupColorPickerClickOutside();

        // Signal ready
        console.log('✅ Image handler ready!');

        // Add color picker to DOM if not exists
        setTimeout(addColorPickerToDOM, 200);
    }, 500);
});

// ====================
// COLOR PICKER SETUP
// ====================
function addColorPickerToDOM() {
    // Check if already exists
    if (document.getElementById('colorPickerOverlay')) {
        console.log('Color picker already in DOM');
        return;
    }

    // Create color picker HTML
    const colorPickerHTML = `
        <div class="color-picker-overlay" id="colorPickerOverlay" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div style="font-size: 0.9rem; color: #a0a0c0;">Choose text color</div>
                <button style="background: rgba(255,255,255,0.1); border: none; color: #a0a0c0; width: 28px; height: 28px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="cancelColorSelection()">×</button>
            </div>
            <div class="color-picker-grid">
                <div class="color-option" data-color="red" onclick="selectColor('red')" title="Red"></div>
                <div class="color-option" data-color="green" onclick="selectColor('green')" title="Green"></div>
                <div class="color-option" data-color="blue" onclick="selectColor('blue')" title="Blue"></div>
                <div class="color-option" data-color="white" onclick="selectColor('white')" title="White"></div>
                <div class="color-option" data-color="black" onclick="selectColor('black')" title="Black"></div>
                <div class="color-option" data-color="yellow" onclick="selectColor('yellow')" title="Yellow"></div>
                <div class="color-option" data-color="cyan" onclick="selectColor('cyan')" title="Cyan"></div>
                <div class="color-option" data-color="purple" onclick="selectColor('purple')" title="Purple"></div>
                <div class="color-option" data-color="pink" onclick="selectColor('pink')" title="Pink"></div>
                <div class="color-option" data-color="orange" onclick="selectColor('orange')" title="Orange"></div>
            </div>
            <div class="color-picker-footer">
                <button class="color-clear-btn" onclick="removeSelectedColor()">
                    <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right: 5px;">
                        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                    Clear Color
                </button>
            </div>
        </div>
    `;

    // Insert after message input wrapper
    const inputWrapper = document.querySelector('.message-input-wrapper');
    if (inputWrapper) {
        inputWrapper.insertAdjacentHTML('beforebegin', colorPickerHTML);
        console.log('✅ Color picker added to DOM');
    } else {
        // Fallback: add to body
        document.body.insertAdjacentHTML('beforeend', colorPickerHTML);
        console.log('✅ Color picker added to body');
    }
}

function initializeColorPicker() {
    setTimeout(() => {
        if (!document.getElementById('colorPickerOverlay')) {
            addColorPickerToDOM();
        }
    }, 300);
}

function setupColorPickerClickOutside() {
    document.addEventListener('click', function(e) {
        if (!colorPickerVisible) return;

        const colorPicker = document.getElementById('colorPickerOverlay');
        const input = document.getElementById('messageInput');

        if (colorPicker && !colorPicker.contains(e.target) && e.target !== input) {
            cancelColorSelection();
        }
    });
}

function showColorPicker() {
    console.log('Showing color picker...');
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = true;
        window.colorPickerVisible = true;

        colorPicker.style.display = 'flex';
        setTimeout(() => {
            colorPicker.style.opacity = '1';
        }, 10);

        // Clear any selected colors
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.remove('selected');
        });

        console.log('✅ Color picker shown');
    } else {
        console.log('❌ Color picker not found in DOM');
        addColorPickerToDOM();
        setTimeout(showColorPicker, 100);
    }
}

function hideColorPicker() {
    console.log('Hiding color picker...');
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = false;
        window.colorPickerVisible = false;

        colorPicker.style.opacity = '0';
        setTimeout(() => {
            colorPicker.style.display = 'none';
        }, 300);

        console.log('✅ Color picker hidden');
    }
}

function cancelColorSelection() {
    console.log('Cancelling color selection');
    hideColorPicker();

    // Clear slash from input
    const input = document.getElementById('messageInput');
    if (input && input.value === '/') {
        input.value = '';
        if (typeof autoResize === 'function') {
            autoResize(input);
        }
    }
}

function removeSelectedColor() {
    console.log('Removing selected color');
    selectedColor = null;
    window.selectedColor = null;

    // Update UI
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
    });

    // Show feedback
    if (typeof showToast === 'function') {
        showToast('Color cleared', '↩️', 1000);
    }

    // Hide picker after delay
    setTimeout(() => {
        hideColorPicker();

        // Focus input
        const input = document.getElementById('messageInput');
        if (input) {
            input.focus();
            // Clear slash if it's just slash
            if (input.value === '/') {
                input.value = '';
                if (typeof autoResize === 'function') {
                    autoResize(input);
                }
            }
        }
    }, 800);
}

function selectColor(color) {
    console.log('Selected color:', color);
    selectedColor = color;
    window.selectedColor = color;

    // Update UI
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-color') === color) {
            option.classList.add('selected');
        }
    });

    // Show feedback
    if (typeof showToast === 'function') {
        showToast(`${color} color selected`, '🎨', 1000);
    }

    // Hide picker after delay
    setTimeout(() => {
        hideColorPicker();

        // Focus input
        const input = document.getElementById('messageInput');
        if (input) {
            input.focus();
            // Clear slash from input if it's just slash
            if (input.value === '/') {
                input.value = '';
                if (typeof autoResize === 'function') {
                    autoResize(input);
                }
            }
        }
    }, 800);
}

// ====================
// SLASH HANDLER
// ====================
function setupSlashHandler() {
    const input = document.getElementById('messageInput');
    if (!input) {
        console.log('❌ Message input not found');
        return;
    }

    console.log('✅ Setting up slash handler');

    // Listen for input changes
    input.addEventListener('input', function(e) {
        const text = e.target.value;

        // Show color picker when slash is typed
        if (text === '/' && !colorPickerVisible) {
            console.log('✅ Slash detected, showing color picker');
            showColorPicker();
        } 
        // Hide color picker when text changes
        else if (colorPickerVisible && text !== '/') {
            console.log('❌ Text changed, hiding color picker');
            hideColorPicker();
        }
    });

    // Handle Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && colorPickerVisible) {
            e.preventDefault();
            cancelColorSelection();
        }
    });
}

// ====================
// IMAGE PICKER FUNCTIONS
// ====================
function showImagePicker() {
    console.log('Showing image picker');

    // Check authentication
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) {
        console.log('User not authenticated');
        if (typeof showToast === 'function') {
            showToast('Please login to send images', '⚠️');
        }
        return;
    }

    isImagePickerOpen = true;
    const picker = document.getElementById('imagePickerOverlay');
    if (picker) {
        picker.style.display = 'flex';
        setTimeout(() => {
            picker.style.opacity = '1';
        }, 10);

        document.body.style.overflow = 'hidden';
        console.log('✅ Image picker shown');
    }
}

function closeImagePicker() {
    if (imagePreviewUrl || currentFileForUpload) {
        console.log('Image preview active, not closing picker');
        return;
    }

    isImagePickerOpen = false;
    const picker = document.getElementById('imagePickerOverlay');
    if (picker) {
        picker.style.opacity = '0';
        setTimeout(() => {
            picker.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
        console.log('✅ Image picker closed');
    }
}

function openCamera() {
    console.log('Opening camera');
    const cameraInput = document.getElementById('cameraInput');
    if (cameraInput) {
        cameraInput.value = '';
        cameraInput.click();
    }
}

function openGallery() {
    console.log('Opening gallery');
    const galleryInput = document.getElementById('galleryInput');
    if (galleryInput) {
        galleryInput.value = '';
        galleryInput.click();
    }
}

function setupFileInputListeners() {
    const cameraInput = document.getElementById('cameraInput');
    const galleryInput = document.getElementById('galleryInput');

    if (cameraInput) {
        cameraInput.addEventListener('change', handleImageSelect);
    }

    if (galleryInput) {
        galleryInput.addEventListener('change', handleImageSelect);
    }
}

// ====================
// FIXED: IMAGE SELECTION AND PREVIEW
// ====================
function handleImageSelect(event) {
    console.log('File selected event triggered', event);

    // Get the file from the event
    const fileInput = event.target;
    const file = fileInput.files[0];

    if (!file) {
        console.log('No file selected');
        if (typeof showToast === 'function') {
            showToast('No image selected', '⚠️');
        }
        return;
    }

    console.log('File selected:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
    });

    // Validate file
    if (!file.type.startsWith('image/')) {
        console.log('Not an image file:', file.type);
        if (typeof showToast === 'function') {
            showToast('Please select an image file', '⚠️');
        }
        fileInput.value = '';
        return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        console.log('File too large:', file.size);
        if (typeof showToast === 'function') {
            showToast('Image too large. Max 10MB', '⚠️');
        }
        fileInput.value = '';
        return;
    }

    // Store file for upload
    currentFileForUpload = file;
    console.log('✅ File stored for upload:', currentFileForUpload.name);

    // Create preview
    createImagePreview(file);

    // Don't reset input here - keep it until upload completes
}

// ====================
// FIXED: IMAGE PREVIEW
// ====================
function createImagePreview(file) {
    console.log('Creating image preview for:', file.name);

    if (!file) {
        console.error('No file provided for preview');
        if (typeof showToast === 'function') {
            showToast('No image file selected', '⚠️');
        }
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        imagePreviewUrl = e.target.result;

        const previewHTML = `
            <div class="image-preview-overlay" id="imagePreviewOverlay">
                <div class="image-preview-container">
                    <div class="preview-header">
                        <h3>Image Preview</h3>
                        <button class="preview-close" onclick="cancelImageUpload()">×</button>
                    </div>
                    <div class="preview-image-container">
                        <img src="${imagePreviewUrl}" alt="Preview" class="preview-image">
                    </div>
                    <div class="preview-actions">
                        <button class="preview-btn cancel" onclick="cancelImageUpload()">Cancel</button>
                        <button class="preview-btn send" onclick="uploadImageFromPreview()">Send Image</button>
                    </div>
                    <div class="preview-info">
                        <p>File: ${file.name}</p>
                        <p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <p>Type: ${file.type}</p>
                    </div>
                </div>
            </div>
        `;

        // Remove existing preview
        const existingPreview = document.getElementById('imagePreviewOverlay');
        if (existingPreview) {
            existingPreview.remove();
        }

        // Add new preview
        document.body.insertAdjacentHTML('beforeend', previewHTML);

        // Close image picker
        closeImagePicker();

        // Show preview
        setTimeout(() => {
            const preview = document.getElementById('imagePreviewOverlay');
            if (preview) {
                preview.style.opacity = '1';
                console.log('✅ Preview shown');
            }
        }, 10);
    };

    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        if (typeof showToast === 'function') {
            showToast('Error reading image file', '❌');
        }
        // Reset file inputs
        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';
        currentFileForUpload = null;
    };

    reader.readAsDataURL(file);
}

// ====================
// IMAGE PREVIEW FUNCTIONS
// ====================
function cancelImageUpload() {
    console.log('Cancelling image upload');
    imagePreviewUrl = null;
    currentFileForUpload = null;
    uploadInProgress = false;

    // Reset file inputs
    document.getElementById('cameraInput').value = '';
    document.getElementById('galleryInput').value = '';

    const preview = document.getElementById('imagePreviewOverlay');
    if (preview) {
        preview.style.opacity = '0';
        setTimeout(() => {
            preview.remove();
            console.log('✅ Preview removed');
        }, 300);
    }
}

function sendImagePreview() {
    console.log('sendImagePreview called');
    if (!currentFileForUpload) {
        console.log('No image to send');
        if (typeof showToast === 'function') {
            showToast('No image selected', '⚠️');
        }
        return;
    }
    uploadImageFromPreview();
}

async function uploadImageFromPreview() {
    console.log('Uploading image from preview');

    if (uploadInProgress) {
        console.log('Upload already in progress');
        return;
    }

    // Get user and friend info
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const chatFriend = window.getChatFriend ? window.getChatFriend() : null;

    if (!currentUser) {
        console.log('User not authenticated');
        if (typeof showToast === 'function') {
            showToast('Please login to send images', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    if (!chatFriend) {
        console.log('No chat friend');
        if (typeof showToast === 'function') {
            showToast('No chat friend selected', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    // Check if file exists
    if (!currentFileForUpload) {
        console.log('No file to upload');
        if (typeof showToast === 'function') {
            showToast('No image to upload', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    console.log('Starting upload process for:', currentFileForUpload.name);
    uploadInProgress = true;

    // Cancel preview first
    cancelImageUpload();

    // Show loading
    if (typeof showLoading === 'function') {
        showLoading(true, 'Uploading image...');
    }

    try {
        await uploadImageToImgBB(currentFileForUpload);
    } catch (error) {
        console.error('Upload failed:', error);
        if (typeof showToast === 'function') {
            showToast('Failed to upload image', '❌');
        }
    } finally {
        uploadInProgress = false;
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}

// ====================
// FIXED: IMAGE UPLOAD TO IMGBB (NULL CHECK ADDED)
// ====================

async function uploadImageToImgBB(file) {
    console.log('Starting ImgBB upload');

    // VALIDATE FILE FIRST - FIX FOR NULL ERROR
    if (!file) {
        console.error('File is null or undefined');
        throw new Error('No image file selected');
    }

    if (!file.name || !file.type || typeof file.size === 'undefined') {
        console.error('Invalid file object:', file);
        throw new Error('Invalid image file');
    }

    console.log('Uploading file:', file.name);

    try {
        console.log('File details:', {
            name: file.name,
            type: file.type,
            size: file.size + ' bytes'
        });

        // First compress the image
        console.log('Compressing image...');
        let processedFile;
        try {
            processedFile = await compressImage(file);
            console.log('Compression complete:', processedFile?.name);
        } catch (compressError) {
            console.warn('Compression failed, using original file:', compressError.message);
            processedFile = file;
        }

        // Double-check processed file
        if (!processedFile) {
            console.error('Processed file is null, using original');
            processedFile = file;
        }

        // Create FormData
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', processedFile);
        formData.append('name', `relaytalk_${Date.now()}`);
        formData.append('expiration', '600');

        // Upload to ImgBB
        const url = 'https://api.imgbb.com/1/upload';
        console.log('Uploading to ImgBB...');

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload failed:', response.status, errorText);
            throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('ImgBB response received:', data);

        if (!data.success) {
            console.error('ImgBB API error:', data.error?.message || 'Unknown error');
            throw new Error(data.error?.message || 'Upload failed');
        }

        if (!data.data || !data.data.url) {
            console.error('No URL in response:', data);
            throw new Error('No image URL returned from server');
        }

        // Get image URLs
        const imageUrl = data.data.url;
        const thumbnailUrl = data.data.thumb?.url || data.data.url;

        console.log('✅ Image uploaded successfully!');
        console.log('Image URL:', imageUrl);

        // Send image message
        await sendImageMessage(imageUrl, thumbnailUrl);

    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}

// ====================
// IMAGE COMPRESSION
// ====================
async function compressImage(file, maxSize = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file to compress'));
            return;
        }

        if (file.size <= maxSize) {
            console.log('File already small enough, skipping compression');
            resolve(file);
            return;
        }

        console.log('Compressing file from', file.size, 'bytes');

        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();

            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;
                const MAX_DIMENSION = 1200;

                if (width > height && width > MAX_DIMENSION) {
                    height = Math.round((height * MAX_DIMENSION) / width);
                    width = MAX_DIMENSION;
                } else if (height > MAX_DIMENSION) {
                    width = Math.round((width * MAX_DIMENSION) / height);
                    height = MAX_DIMENSION;
                }

                canvas.width = width;
                canvas.height = height;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.8;

                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            console.warn('Failed to create blob, using original file');
                            resolve(file);
                            return;
                        }

                        console.log('Compressed to:', blob.size, 'bytes, quality:', quality);

                        if (blob.size <= maxSize || quality <= 0.3) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            quality -= 0.1;
                            tryCompress();
                        }
                    }, 'image/jpeg', quality);
                };

                tryCompress();
            };

            img.onerror = () => {
                console.warn('Failed to load image for compression, using original');
                resolve(file);
            };

            img.src = e.target.result;
        };

        reader.onerror = () => {
            console.warn('Failed to read file for compression, using original');
            resolve(file);
        };

        reader.readAsDataURL(file);
    });
}

// ====================
// SEND IMAGE MESSAGE
// ====================
async function sendImageMessage(imageUrl, thumbnailUrl) {
    console.log('Sending image message to Supabase');

    if (window.isSending) {
        console.log('Already sending a message, please wait');
        return;
    }

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const chatFriend = window.getChatFriend ? window.getChatFriend() : null;
    const supabaseClient = window.getSupabaseClient ? window.getSupabaseClient() : supabase;

    if (!currentUser || !chatFriend || !supabaseClient) {
        console.error('Missing required data for sending image');
        if (typeof showToast === 'function') {
            showToast('Cannot send image - missing user data', '❌');
        }
        return;
    }

    window.isSending = true;
    console.log('✅ Starting to send image message');

    const sendBtn = document.getElementById('sendBtn');
    const originalHTML = sendBtn ? sendBtn.innerHTML : '';

    try {
        if (sendBtn) {
            sendBtn.innerHTML = `
                <svg class="send-icon" viewBox="0 0 24 24" style="opacity: 0.5">
                    <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                </svg>
            `;
            sendBtn.disabled = true;
        }

        // Create message data
        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: '',
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            created_at: new Date().toISOString()
        };

        console.log('Sending message data');

        // Add color if selected
        if (selectedColor) {
            messageData.color = selectedColor;
            console.log('Adding color to message:', selectedColor);
            selectedColor = null;
            window.selectedColor = null;
        }

        // Insert into database
        const { data, error } = await supabaseClient
            .from('direct_messages')
            .insert(messageData)
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        console.log('✅ Image message sent to database:', data.id);

        // Play sound
        if (typeof playSentSound === 'function') {
            playSentSound();
        }

        // Reset file inputs
        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';
        
        // Clear current file
        currentFileForUpload = null;

        // Reset typing
        if (window.isTyping !== undefined) {
            window.isTyping = false;
        }
        if (window.typingTimeout) {
            clearTimeout(window.typingTimeout);
            window.typingTimeout = null;
        }

        if (typeof sendTypingStatus === 'function') {
            sendTypingStatus(false);
        }

        console.log('✅ Image message process complete');

        if (typeof showToast === 'function') {
            showToast('Image sent successfully!', '✅', 2000);
        }

    } catch (error) {
        console.error('Send image failed:', error);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Failed to send image: ' + error.message, '❌', 'Error');
        }
    } finally {
        window.isSending = false;
        if (sendBtn) {
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
        }

        // Focus input
        const input = document.getElementById('messageInput');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
}

// ====================
// IMAGE MESSAGE HTML CREATOR
// ====================
function createImageMessageHTML(msg, isSent, colorAttr, time) {
    const imageUrl = msg.image_url || '';
    const thumbnailUrl = msg.thumbnail_url || imageUrl;
    const content = msg.content || '';

    let displayImageUrl = imageUrl;
    let displayThumbnailUrl = thumbnailUrl;

    if (imageUrl && imageUrl.includes('i.ibb.co')) {
        displayImageUrl = imageUrl.replace('http://', 'https://');
        displayThumbnailUrl = thumbnailUrl.replace('http://', 'https://');
    }

    return `
        <div class="message ${isSent ? 'sent' : 'received'} image-message" data-message-id="${msg.id}" ${colorAttr}>
            <div class="message-image-container" onclick="viewImageFullscreen('${displayImageUrl}')">
                <img src="${displayThumbnailUrl}" 
                     alt="Shared image" 
                     class="message-image"
                     onload="handleImageLoad(this)"
                     onerror="handleImageError(this, '${displayImageUrl}')">
                <div class="image-overlay">
                    <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: white;">
                        <path d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/>
                    </svg>
                </div>
            </div>
            ${content ? `
                <div class="image-caption">${content}</div>
            ` : ''}
            <div class="message-time">${time}</div>
        </div>
    `;
}

// ====================
// IMAGE LOADING HANDLERS
// ====================
function handleImageLoad(imgElement) {
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
}

function handleImageError(imgElement, originalUrl) {
    console.error('Failed to load image:', originalUrl);

    if (originalUrl && originalUrl.includes('i.ibb.co') && originalUrl.startsWith('http://')) {
        const httpsUrl = originalUrl.replace('http://', 'https://');
        imgElement.src = httpsUrl;
        return;
    }

    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23ccc" d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/></svg>';
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
}

// ====================
// IMAGE VIEWER FUNCTIONS
// ====================
function viewImageFullscreen(imageUrl) {
    const existingViewer = document.getElementById('imageViewerOverlay');
    if (existingViewer) existingViewer.remove();

    let fixedImageUrl = imageUrl;
    if (imageUrl && imageUrl.includes('i.ibb.co')) {
        fixedImageUrl = imageUrl.replace('http://', 'https://');
    }

    const viewerHTML = `
        <div class="image-viewer-overlay" id="imageViewerOverlay">
            <button class="viewer-close" onclick="closeImageViewer()">
                <svg viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
            </button>
            <div class="viewer-image-container">
                <img src="${fixedImageUrl}" alt="Shared image" class="viewer-image" 
                     onload="this.style.opacity='1'; this.classList.add('loaded')"
                     onerror="handleImageViewerError(this, '${fixedImageUrl}')">
            </div>
            <div class="viewer-actions">
                <button class="viewer-action-btn" onclick="downloadImage('${fixedImageUrl}')">
                    <svg viewBox="0 0 24 24">
                        <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                    </svg>
                    <span>Download</span>
                </button>
                <button class="viewer-action-btn" onclick="shareImage('${fixedImageUrl}')">
                    <svg viewBox="0 0 24 24">
                        <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19C20.92,17.39 19.61,16.08 18,16.08Z"/>
                    </svg>
                    <span>Share</span>
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', viewerHTML);

    setTimeout(() => {
        const viewer = document.getElementById('imageViewerOverlay');
        if (viewer) viewer.style.opacity = '1';
    }, 10);
}

function handleImageViewerError(imgElement, originalUrl) {
    console.error('Failed to load image in viewer:', originalUrl);

    if (originalUrl && originalUrl.includes('i.ibb.co')) {
        const httpsUrl = originalUrl.replace('http://', 'https://');
        if (httpsUrl !== originalUrl) {
            imgElement.src = httpsUrl;
            return;
        }
    }

    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23ccc" d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/></svg>';
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewerOverlay');
    if (viewer) {
        viewer.style.opacity = '0';
        setTimeout(() => viewer.remove(), 300);
    }
}

function downloadImage(imageUrl) {
    let downloadUrl = imageUrl;
    if (imageUrl && imageUrl.includes('i.ibb.co')) {
        downloadUrl = downloadUrl.replace('http://', 'https://');
        if (downloadUrl.startsWith('https://https://')) {
            downloadUrl = downloadUrl.replace('https://https://', 'https://');
        }
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'relaytalk-image-' + Date.now() + '.jpg';
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
    }, 100);

    if (typeof showToast === 'function') {
        showToast('Download started', '📥', 2000);
    }
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
                copyToClipboard(imageUrl);
            }
        }
    } else {
        copyToClipboard(imageUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            if (typeof showToast === 'function') {
                showToast('Image URL copied!', '📋', 2000);
            }
        })
        .catch(() => {
            if (typeof showToast === 'function') {
                showToast('Cannot copy URL', '⚠️', 2000);
            }
        });
}

console.log('✅ Image handler functions exported - FIXED UPLOAD');