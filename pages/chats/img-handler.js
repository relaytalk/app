import { supabase } from '../../utils/supabase.js';

console.log('✨ Image Handler Initialized');

// ====================
// IMAGE HANDLING VARIABLES
// ====================
let selectedColor = null;
let colorPickerVisible = false;
let isImagePickerOpen = false;
let imagePreviewUrl = null;
let currentFileForUpload = null;

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
// COLOR PICKER SETUP - UPDATED WITH CANCEL BUTTON
// ====================
function addColorPickerToDOM() {
    // Check if already exists
    if (document.getElementById('colorPickerOverlay')) {
        console.log('Color picker already in DOM');
        return;
    }

    // Create color picker HTML with cancel button
    const colorPickerHTML = `
        <div class="color-picker-overlay" id="colorPickerOverlay" style="display: none; opacity: 0;">
            <div class="color-picker-header">
                <div class="color-picker-title">Choose text color</div>
                <button class="color-picker-cancel" onclick="cancelColorSelection()">×</button>
            </div>
            <div class="color-picker-grid">
                <div class="color-option" data-color="red" onclick="selectColor('red')" title="Red">
                    <div class="color-preview" style="background-color: #ff4444;"></div>
                    <span class="color-name">Red</span>
                </div>
                <div class="color-option" data-color="green" onclick="selectColor('green')" title="Green">
                    <div class="color-preview" style="background-color: #44ff44;"></div>
                    <span class="color-name">Green</span>
                </div>
                <div class="color-option" data-color="blue" onclick="selectColor('blue')" title="Blue">
                    <div class="color-preview" style="background-color: #4444ff;"></div>
                    <span class="color-name">Blue</span>
                </div>
                <div class="color-option" data-color="white" onclick="selectColor('white')" title="White">
                    <div class="color-preview" style="background-color: #ffffff; border: 1px solid #ccc;"></div>
                    <span class="color-name">White</span>
                </div>
                <div class="color-option" data-color="black" onclick="selectColor('black')" title="Black">
                    <div class="color-preview" style="background-color: #000000;"></div>
                    <span class="color-name">Black</span>
                </div>
                <div class="color-option" data-color="yellow" onclick="selectColor('yellow')" title="Yellow">
                    <div class="color-preview" style="background-color: #ffff44;"></div>
                    <span class="color-name">Yellow</span>
                </div>
                <div class="color-option" data-color="cyan" onclick="selectColor('cyan')" title="Cyan">
                    <div class="color-preview" style="background-color: #44ffff;"></div>
                    <span class="color-name">Cyan</span>
                </div>
            </div>
            <div class="color-picker-footer">
                <button class="color-clear-btn" onclick="removeSelectedColor()">
                    <svg viewBox="0 0 24 24" width="16" height="16">
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
    // Make sure color picker is in DOM
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

        // Focus input but DON'T add /color to input
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
// FIXED: SLASH HANDLER - SIMPLIFIED
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
        // Hide color picker when text changes (unless it's still just slash)
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
            const container = picker.querySelector('.image-picker-container');
            if (container) container.style.transform = 'translateY(0)';
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
        const container = picker.querySelector('.image-picker-container');
        if (container) container.style.transform = 'translateY(100%)';
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
    console.log('File selected');
    const file = event.target.files[0];

    // Check if file exists
    if (!file) {
        console.log('No file selected');
        if (typeof showToast === 'function') {
            showToast('No image selected', '⚠️');
        }
        return;
    }

    console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size + ' bytes'
    });

    // Check file type
    if (!file.type.startsWith('image/')) {
        console.log('Not an image file');
        if (typeof showToast === 'function') {
            showToast('Please select an image file', '⚠️');
        }
        return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        console.log('File too large');
        if (typeof showToast === 'function') {
            showToast('Image too large. Max 10MB', '⚠️');
        }
        return;
    }

    // Store file for upload
    currentFileForUpload = file;

    // Create preview
    createImagePreview(file);

    // Reset input
    event.target.value = '';
    console.log('✅ File ready for upload');
}

function createImagePreview(file) {
    console.log('Creating image preview');
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

        const existingPreview = document.getElementById('imagePreviewOverlay');
        if (existingPreview) {
            existingPreview.remove();
        }

        document.body.insertAdjacentHTML('beforeend', previewHTML);
        console.log('✅ Preview HTML added');

        // Close image picker
        closeImagePicker();

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
        return;
    }
    uploadImageFromPreview();
}

async function uploadImageFromPreview() {
    console.log('Uploading image from preview');

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

    // Check if file exists before uploading
    if (!currentFileForUpload) {
        console.log('No file to upload');
        if (typeof showToast === 'function') {
            showToast('No image to upload', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    console.log('Starting upload process');
    cancelImageUpload();

    // Show loading
    if (typeof showLoading === 'function') {
        showLoading(true, 'Uploading image...');
    }

    try {
        await uploadImageToImgBB(currentFileForUpload);
    } catch (error) {
        console.error('Upload failed:', error);
        // Error is already handled in uploadImageToImgBB
    } finally {
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}

// ====================
// FIXED: IMAGE UPLOAD FUNCTION
// ====================

async function uploadImageToImgBB(file) {
    console.log('Starting ImgBB upload');

    // Check if file exists and has size property
    if (!file || typeof file.size === 'undefined') {
        console.error('Invalid file object:', file);
        throw new Error('No valid image file selected');
    }

    try {
        console.log('File details:', {
            name: file.name,
            type: file.type,
            size: file.size + ' bytes'
        });

        // Compress image if needed
        console.log('Compressing image if needed...');
        const processedFile = await compressImage(file);

        // Create FormData for ImgBB
        const formData = new FormData();
        formData.append('image', processedFile);

        // ImgBB endpoint
        const url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
        console.log('Uploading to ImgBB...');

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload failed:', response.status, errorText);
            throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('ImgBB response:', data);

        if (!data.success) {
            console.error('ImgBB error:', data.error);
            throw new Error(data.error?.message || 'Upload failed');
        }

        // Get image URL from response
        const imageUrl = data.data.url || data.data.display_url;
        const thumbnailUrl = data.data.thumb?.url || data.data.thumb_url || imageUrl;

        if (!imageUrl) {
            throw new Error('No image URL returned');
        }

        console.log('✅ Image uploaded successfully:', imageUrl);

        // Send image message
        await sendImageMessage(imageUrl, thumbnailUrl);

    } catch (error) {
        console.error('Image upload error:', error);
        if (typeof showRetryAlert === 'function') {
            showRetryAlert('Failed to upload image: ' + error.message, () => {
                uploadImageToImgBB(file);
            });
        } else if (typeof showToast === 'function') {
            showToast('Upload failed: ' + error.message, '❌');
        }
        throw error;
    }
}

async function compressImage(file, maxSize = 800 * 1024) {
    // Check if file exists
    if (!file) {
        throw new Error('No file provided for compression');
    }

    // Check if file has size property
    if (typeof file.size === 'undefined') {
        console.warn('File missing size property, skipping compression');
        return file;
    }

    if (file.size <= maxSize) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;

            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

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

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                const compressWithQuality = (quality = 0.8) => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create blob'));
                            return;
                        }

                        if (blob.size <= maxSize || quality <= 0.3) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            compressWithQuality(quality - 0.1);
                        }
                    }, 'image/jpeg', quality);
                };

                compressWithQuality();
            };

            img.onerror = () => reject(new Error('Failed to load image'));
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

// ====================
// SEND IMAGE MESSAGE
// ====================
async function sendImageMessage(imageUrl, thumbnailUrl) {
    console.log('Sending image message to Supabase');

    if (window.isSending) {
        console.log('Already sending a message');
        return;
    }

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const chatFriend = window.getChatFriend ? window.getChatFriend() : null;
    const supabaseClient = window.getSupabaseClient ? window.getSupabaseClient() : supabase;

    if (!currentUser || !chatFriend || !supabaseClient) {
        console.error('Missing required data');
        if (typeof showToast === 'function') {
            showToast('Cannot send image', '❌');
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

        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: '',
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            created_at: new Date().toISOString()
        };

        console.log('Sending message data:', messageData);

        // Add color if selected
        if (selectedColor) {
            messageData.color = selectedColor;
            selectedColor = null;
            window.selectedColor = null;

            const colorOptions = document.querySelectorAll('.color-option');
            colorOptions.forEach(option => {
                option.classList.remove('selected');
            });
        }

        const { data, error } = await supabaseClient
            .from('direct_messages')
            .insert(messageData)
            .select()
            .single();

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log('✅ Image message sent to database:', data.id);

        // Play sound
        if (typeof playSentSound === 'function') {
            playSentSound();
        }

        // Clear input
        const input = document.getElementById('messageInput');
        if (input) {
            if (typeof autoResize === 'function') {
                autoResize(input);
            }
        }

        // Reset typing
        if (window.isTyping !== undefined) {
            window.isTyping = false;
        }
        if (window.typingTimeout) {
            clearTimeout(window.typingTimeout);
            window.typingTimeout = null;
        }

        // Send typing status
        if (typeof sendTypingStatus === 'function') {
            sendTypingStatus(false);
        }

        console.log('✅ Image message process complete');

        setTimeout(() => {
            if (input) input.focus();
            window.isSending = false;
            if (sendBtn) {
                sendBtn.innerHTML = originalHTML;
                sendBtn.disabled = false;
            }
        }, 300);
    } catch (error) {
        console.error('Send image failed:', error);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Failed to send image: ' + error.message, '❌', 'Error');
        }
        window.isSending = false;
        if (sendBtn) {
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
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

    // Use https for ImgBB images
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
                    <svg viewBox="0 0 24 24" class="image-icon">
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

// Image loading handlers
function handleImageLoad(imgElement) {
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
}

function handleImageError(imgElement, originalUrl) {
    console.error('Failed to load image:', originalUrl);

    // Try https if failed with http
    if (originalUrl && originalUrl.includes('i.ibb.co') && originalUrl.startsWith('http://')) {
        const httpsUrl = originalUrl.replace('http://', 'https://');
        imgElement.src = httpsUrl;
        return;
    }

    // Fallback to placeholder
    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23ccc" d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/></svg>';
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
}

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

// ====================
// ALERT FUNCTIONS
// ====================

function showRetryAlert(message, onRetry, onCancel = null) {
    const alertOverlay = document.getElementById('customAlert');
    if (!alertOverlay) {
        console.error('Alert overlay not found');
        return;
    }

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
        if (typeof showToast === 'function') {
            showToast('Upload cancelled', '⚠️');
        }
    };

    alertOverlay.style.display = 'flex';
}

// ====================
// TOAST FUNCTION
// ====================
function showToast(message, icon = 'ℹ️', duration = 3000) {
    if (window.showToast && window.showToast !== showToast) {
        window.showToast(message, icon, duration);
        return;
    }

    const toast = document.getElementById('customToast');
    if (toast) {
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');

        if (toastIcon) toastIcon.innerHTML = icon;
        if (toastMessage) toastMessage.textContent = message;

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
}

console.log('✅ Image handler functions exported');