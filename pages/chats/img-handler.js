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
window.removeSelectedColor = removeSelectedColor; // NEW: Add remove color function
window.cancelColorSelection = cancelColorSelection; // NEW: Cancel color selection

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
    const inputWrapper = document.getElementById('messageInputWrapper');
    if (inputWrapper) {
        inputWrapper.insertAdjacentHTML('beforebegin', colorPickerHTML);
        console.log('✅ Color picker added to DOM');
    } else {
        // Fallback: add to body
        document.body.insertAdjacentHTML('beforeend', colorPickerHTML);
        console.log('✅ Color picker added to body');
    }
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

// NEW: Cancel color selection
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

// NEW: Remove selected color
function removeSelectedColor() {
    console.log('Removing selected color');
    selectedColor = null;
    
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
    window.selectedColor = color; // Set global for other modules
    
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
// FIXED: IMAGE UPLOAD ERROR - Check file exists
// ====================
async function uploadImageToImgBB(file) {
    console.log('Starting ImgBB upload');
    
    // FIX: Check if file exists and has size property
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
        throw error; // Re-throw for error handling
    }
}

async function compressImage(file, maxSize = 800 * 1024) {
    // FIX: Check if file exists
    if (!file) {
        throw new Error('No file provided for compression');
    }
    
    // FIX: Check if file has size property
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
// FIXED: sendImageMessage - Handle null file
// ====================
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

    // FIX: Check if file exists before uploading
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
// FIXED: Image selection handler
// ====================
function handleImageSelect(event) {
    console.log('File selected');
    const file = event.target.files[0];
    
    // FIX: Check if file exists
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

// ====================
// REST OF THE FUNCTIONS (unchanged)
// ====================

// [Keep all the other functions from the previous version:
// showImagePicker, closeImagePicker, openCamera, openGallery,
// setupFileInputListeners, createImagePreview, cancelImageUpload,
// sendImagePreview, sendImageMessage, createImageMessageHTML,
// handleImageLoad, handleImageError, viewImageFullscreen,
// handleImageViewerError, closeImageViewer, downloadImage,
// shareImage, copyToClipboard, showRetryAlert, showToast]

// ... [Keep all existing functions below this point unchanged]
// ... [Just ensure they use the fixed functions above]

console.log('✅ Image handler functions exported');