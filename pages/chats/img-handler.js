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

// ====================
// GLOBAL FUNCTION EXPORTS - IMAGE HANDLER
// ====================
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
window.handleImageLoad = handleImageLoad;
window.handleImageError = handleImageError;
window.cancelImageUpload = cancelImageUpload;
window.sendImagePreview = sendImagePreview;
window.createImageMessageHTML = createImageMessageHTML;

// ====================
// INITIALIZATION
// ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Initializing image handler...');
    initializeColorPicker();
    addColorPickerInputListener();
    setupFileInputListeners();
    console.log('✅ Image handler ready!');
});

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
// IMAGE PICKER FUNCTIONS - FIXED
// ====================
function showImagePicker() {
    // FIRST: Check if user is authenticated
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) {
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
            picker.querySelector('.image-picker-container').style.transform = 'translateY(0)';
        }, 10);

        // Prevent body scrolling when picker is open
        document.body.style.overflow = 'hidden';
    }
}

function closeImagePicker() {
    // Only close if not processing an image
    if (imagePreviewUrl || currentFileForUpload) return;
    
    isImagePickerOpen = false;
    const picker = document.getElementById('imagePickerOverlay');
    if (picker) {
        picker.style.opacity = '0';
        picker.querySelector('.image-picker-container').style.transform = 'translateY(100%)';
        setTimeout(() => {
            picker.style.display = 'none';
            // Restore body scrolling
            document.body.style.overflow = '';
        }, 300);
    }
}

function openCamera() {
    const cameraInput = document.getElementById('cameraInput');
    if (cameraInput) {
        // Clear previous value to allow same file to be selected again
        cameraInput.value = '';
        cameraInput.click();
    }
}

function openGallery() {
    const galleryInput = document.getElementById('galleryInput');
    if (galleryInput) {
        // Clear previous value to allow same file to be selected again
        galleryInput.value = '';
        galleryInput.click();
    }
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

// ====================
// IMAGE SELECTION AND PREVIEW
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

    // Check authentication
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) {
        showToast('Please login to send images', '⚠️');
        return;
    }

    // Store file for upload
    currentFileForUpload = file;
    
    // Create preview
    createImagePreview(file);
    
    // Reset input for next selection
    event.target.value = '';
}

function createImagePreview(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        imagePreviewUrl = e.target.result;
        
        // Create preview modal
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
        if (existingPreview) existingPreview.remove();
        
        // Add new preview
        document.body.insertAdjacentHTML('beforeend', previewHTML);
        
        // Show preview
        setTimeout(() => {
            const preview = document.getElementById('imagePreviewOverlay');
            if (preview) preview.style.opacity = '1';
        }, 10);
    };
    
    reader.readAsDataURL(file);
}

// ====================
// IMAGE PREVIEW FUNCTIONS
// ====================
function cancelImageUpload() {
    imagePreviewUrl = null;
    currentFileForUpload = null;
    const preview = document.getElementById('imagePreviewOverlay');
    if (preview) {
        preview.style.opacity = '0';
        setTimeout(() => preview.remove(), 300);
    }
}

async function uploadImageFromPreview() {
    // Check authentication
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const chatFriend = window.getChatFriend ? window.getChatFriend() : null;
    
    if (!currentUser) {
        showToast('Please login to send images', '⚠️');
        cancelImageUpload();
        return;
    }
    
    if (!chatFriend) {
        showToast('No chat friend selected', '⚠️');
        cancelImageUpload();
        return;
    }

    if (!currentFileForUpload) {
        showToast('No image to upload', '⚠️');
        cancelImageUpload();
        return;
    }

    // Close preview first
    cancelImageUpload();
    
    // Then upload the image
    await uploadImageToServer(currentFileForUpload);
}

// ====================
// IMAGE UPLOAD FUNCTIONS
// ====================
async function uploadImageToServer(file) {
    // Use the loading function from chat-core.js
    if (typeof showLoading === 'function') {
        showLoading(true, 'Uploading image...');
    }

    try {
        // Compress image if needed
        const processedFile = await compressImage(file);

        // Get ImgBB API key from server (safer approach)
        // For now, using a placeholder - in production, fetch from your backend
        const IMGBB_API_KEY = await getImgBBApiKey();
        
        if (!IMGBB_API_KEY) {
            throw new Error('Image upload service not available');
        }

        // Create FormData for ImgBB
        const formData = new FormData();
        formData.append('image', processedFile);

        // ImgBB expects the key as a query parameter
        const url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}&expiration=600`;

        console.log('📤 Uploading to ImgBB...');

        // Upload to ImgBB
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('ImgBB Response:', data);

        if (!data.success) {
            throw new Error(data.error?.message || 'Upload failed');
        }

        // Get image URL - ImgBB response structure
        const imageUrl = data.data.url || data.data.display_url;
        const thumbnailUrl = data.data.thumb?.url || data.data.thumb_url || imageUrl;

        if (!imageUrl) {
            throw new Error('No image URL returned');
        }

        console.log('✅ Image uploaded:', imageUrl);
        console.log('✅ Thumbnail:', thumbnailUrl);

        // Send message with image
        await sendImageMessage(imageUrl, thumbnailUrl);

    } catch (error) {
        console.error('Image upload error:', error);
        if (typeof showRetryAlert === 'function') {
            showRetryAlert('Failed to upload image: ' + error.message, () => {
                uploadImageToServer(file);
            });
        } else {
            showToast('Upload failed: ' + error.message, '❌');
        }
    } finally {
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}

async function getImgBBApiKey() {
    // In production, fetch this from your backend server
    // For now, return a placeholder (should be replaced with actual server fetch)
    try {
        // Example: Fetch from your own API endpoint
        // const response = await fetch('/api/get-imgbb-key');
        // const data = await response.json();
        // return data.key;
        
        // TEMPORARY: Return a placeholder key (replace with actual key or server fetch)
        return '82e49b432e2ee14921f7d0cd81ba5551'; // This should come from your server
    } catch (error) {
        console.error('Failed to get ImgBB key:', error);
        return null;
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

// ====================
// SEND IMAGE MESSAGE - FIXED
// ====================

async function sendImageMessage(imageUrl, thumbnailUrl) {
    // Check if already sending
    if (window.isSending) {
        console.log('Already sending a message, please wait');
        return;
    }

    // Get user and friend data safely
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const chatFriend = window.getChatFriend ? window.getChatFriend() : null;
    const supabaseClient = window.getSupabaseClient ? window.getSupabaseClient() : null;

    if (!currentUser || !chatFriend || !supabaseClient) {
        console.error('Missing required data for sending image');
        if (typeof showToast === 'function') {
            showToast('Cannot send image: missing data', '❌');
        }
        return;
    }

    window.isSending = true;
    const sendBtn = document.getElementById('sendBtn');
    const originalHTML = sendBtn ? sendBtn.innerHTML : '';

    try {
        // Show sending state
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

        const { data, error } = await supabaseClient
            .from('direct_messages')
            .insert(messageData)
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Image message sent:', data.id);
        
        // Play sound if function exists
        if (typeof playSentSound === 'function') {
            playSentSound();
        }

        // Clear input
        const input = document.getElementById('messageInput');
        if (input) {
            input.value = '';
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
        
        // Send typing status if function exists
        if (typeof sendTypingStatus === 'function') {
            sendTypingStatus(false);
        }

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
    
    return `
        <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}" ${colorAttr}>
            <div class="message-image-container" onclick="viewImageFullscreen('${imageUrl}')">
                <img src="${thumbnailUrl}" 
                     alt="Shared image" 
                     class="message-image"
                     onload="handleImageLoad(this)"
                     onerror="handleImageError(this, '${imageUrl}')">
                <div class="image-overlay">
                    <svg viewBox="0 0 24 24" class="image-icon">
                        <path d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/>
                    </svg>
                </div>
            </div>
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
    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23ccc" d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/></svg>';
    imgElement.style.opacity = '1';
}

function viewImageFullscreen(imageUrl) {
    // Remove existing viewer if any
    const existingViewer = document.getElementById('imageViewerOverlay');
    if (existingViewer) {
        existingViewer.remove();
    }

    // Fix URL for ImgBB
    let fixedImageUrl = imageUrl;
    if (imageUrl && imageUrl.includes('i.ibb.co')) {
        // Ensure HTTPS
        fixedImageUrl = imageUrl.replace('http://', 'https://');
        // Remove double slashes
        fixedImageUrl = fixedImageUrl.replace('//i.ibb.co', 'https://i.ibb.co');
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

    // Animate in
    setTimeout(() => {
        const viewer = document.getElementById('imageViewerOverlay');
        if (viewer) {
            viewer.style.opacity = '1';
        }
    }, 10);
}

// Handle image viewer errors
function handleImageViewerError(imgElement, originalUrl) {
    console.error('Failed to load image in viewer:', originalUrl);
    
    // Try to load with different protocol or fix URL
    if (originalUrl && originalUrl.includes('i.ibb.co')) {
        // Ensure HTTPS
        const httpsUrl = originalUrl.replace('http://', 'https://');
        if (httpsUrl !== originalUrl) {
            imgElement.src = httpsUrl;
            return;
        }
        
        // Try without www
        const cleanUrl = originalUrl.replace('www.', '');
        if (cleanUrl !== originalUrl) {
            imgElement.src = cleanUrl;
            return;
        }
        
        // Try direct .png URL
        if (!originalUrl.endsWith('.png') && !originalUrl.endsWith('.jpg') && !originalUrl.endsWith('.jpeg')) {
            imgElement.src = originalUrl + '.png';
            return;
        }
    }
    
    // Fallback to error placeholder
    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23ccc" d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/></svg>';
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
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
    // Fix URL if needed
    let downloadUrl = imageUrl;
    if (imageUrl && imageUrl.includes('i.ibb.co')) {
        // Ensure HTTPS
        downloadUrl = downloadUrl.replace('http://', 'https://');
        // Remove double protocol
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
// ALERT FUNCTIONS FOR IMAGE HANDLER
// ====================
function showRetryAlert(message, onRetry, onCancel = null) {
    const alertOverlay = document.getElementById('customAlert');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertConfirm = document.getElementById('alertConfirm');
    const alertCancel = document.getElementById('alertCancel');

    if (!alertOverlay) {
        console.error('Alert overlay not found');
        return;
    }

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
// TOAST FUNCTION FOR IMAGE HANDLER
// ====================
function showToast(message, icon = 'ℹ️', duration = 3000) {
    // Use the global showToast if available
    if (window.showToast && window.showToast !== showToast) {
        window.showToast(message, icon, duration);
        return;
    }
    
    // Fallback implementation
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