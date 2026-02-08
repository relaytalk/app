import { supabase } from '../../utils/supabase.js';

console.log('✨ Image Handler Initialized - CHROME MOBILE FIXED VERSION 🎉');

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
window.isMobileChrome = isMobileChrome;

// Signal that img-handler is loaded
if (window.chatModules) {
    window.chatModules.imgHandlerLoaded = true;
    console.log('✅ img-handler.js loaded and ready');
}

// ====================
// MOBILE DETECTION
// ====================
function isMobileChrome() {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isChrome = /Chrome/i.test(ua);
    return isMobile && isChrome;
}

// ====================
// INITIALIZATION
// ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Initializing image handler...');
    console.log('🌐 Browser:', navigator.userAgent);
    console.log('📱 Mobile Chrome:', isMobileChrome());

    // Initialize after a short delay
    setTimeout(() => {
        initializeColorPicker();
        setupSlashHandler();
        setupFileInputListeners();
        setupColorPickerClickOutside();

        // Mobile Chrome specific fixes
        if (isMobileChrome()) {
            applyMobileChromeFixes();
        }

        console.log('✅ Image handler ready!');
        setTimeout(addColorPickerToDOM, 200);
    }, 500);
});

// ====================
// MOBILE CHROME FIXES
// ====================
function applyMobileChromeFixes() {
    console.log('Applying Mobile Chrome fixes...');
    
    // Fix for file input not working on mobile Chrome
    document.addEventListener('touchstart', function(e) {
        if (e.target.id === 'cameraInput' || e.target.id === 'galleryInput') {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Prevent default behaviors that cause issues
    document.addEventListener('touchmove', function(e) {
        if (e.target.classList.contains('message-image-container') || 
            e.target.classList.contains('message-image')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Fix for iOS Safari input zoom
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 100);
        });
    });
}

// ====================
// COLOR PICKER SETUP
// ====================
function addColorPickerToDOM() {
    if (document.getElementById('colorPickerOverlay')) {
        console.log('Color picker already in DOM');
        return;
    }

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

    const inputWrapper = document.querySelector('.message-input-wrapper');
    if (inputWrapper) {
        inputWrapper.insertAdjacentHTML('beforebegin', colorPickerHTML);
        console.log('✅ Color picker added to DOM');
    } else {
        document.body.insertAdjacentHTML('beforeend', colorPickerHTML);
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
    }
}

function cancelColorSelection() {
    console.log('Cancelling color selection');
    hideColorPicker();

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

    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
    });

    if (typeof showToast === 'function') {
        showToast('Color cleared', '↩️', 1000);
    }

    setTimeout(() => {
        hideColorPicker();

        const input = document.getElementById('messageInput');
        if (input) {
            input.focus();
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

    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-color') === color) {
            option.classList.add('selected');
        }
    });

    if (typeof showToast === 'function') {
        showToast(`${color} color selected`, '🎨', 1000);
    }

    setTimeout(() => {
        hideColorPicker();

        const input = document.getElementById('messageInput');
        if (input) {
            input.focus();
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

    input.addEventListener('input', function(e) {
        const text = e.target.value;

        if (text === '/' && !colorPickerVisible) {
            console.log('✅ Slash detected, showing color picker');
            showColorPicker();
        } 
        else if (colorPickerVisible && text !== '/') {
            console.log('❌ Text changed, hiding color picker');
            hideColorPicker();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && colorPickerVisible) {
            e.preventDefault();
            cancelColorSelection();
        }
    });
}

// ====================
// IMAGE PICKER FUNCTIONS - MOBILE FIXED
// ====================
function showImagePicker() {
    console.log('Showing image picker');

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) {
        console.log('User not authenticated');
        if (typeof showToast === 'function') {
            showToast('Please login to send images', '⚠️');
        }
        return;
    }

    // MOBILE FIX: Delay to prevent immediate closing
    setTimeout(() => {
        isImagePickerOpen = true;
        const picker = document.getElementById('imagePickerOverlay');
        if (picker) {
            picker.style.display = 'flex';
            setTimeout(() => {
                picker.style.opacity = '1';
            }, 10);

            // MOBILE FIX: Prevent body scrolling when picker is open
            document.body.style.overflow = 'hidden';
            console.log('✅ Image picker shown');
        }
    }, isMobileChrome() ? 100 : 0);
}

function closeImagePicker() {
    if (uploadInProgress) {
        console.log('Upload in progress, not closing picker');
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
    
    // MOBILE FIX: Use different approach for mobile
    if (isMobileChrome()) {
        const cameraInput = document.getElementById('cameraInput');
        if (cameraInput) {
            // Create a new input element to reset it
            const newInput = cameraInput.cloneNode(true);
            cameraInput.parentNode.replaceChild(newInput, cameraInput);
            newInput.style.display = 'none';
            newInput.id = 'cameraInput';
            
            // Add event listener
            newInput.addEventListener('change', handleImageSelect);
            
            // Trigger click
            setTimeout(() => {
                newInput.click();
            }, 100);
        }
    } else {
        const cameraInput = document.getElementById('cameraInput');
        if (cameraInput) {
            cameraInput.value = '';
            cameraInput.click();
        }
    }
}

function openGallery() {
    console.log('Opening gallery');
    
    // MOBILE FIX: Use different approach for mobile
    if (isMobileChrome()) {
        const galleryInput = document.getElementById('galleryInput');
        if (galleryInput) {
            // Create a new input element to reset it
            const newInput = galleryInput.cloneNode(true);
            galleryInput.parentNode.replaceChild(newInput, galleryInput);
            newInput.style.display = 'none';
            newInput.id = 'galleryInput';
            
            // Add event listener
            newInput.addEventListener('change', handleImageSelect);
            
            // Trigger click
            setTimeout(() => {
                newInput.click();
            }, 100);
        }
    } else {
        const galleryInput = document.getElementById('galleryInput');
        if (galleryInput) {
            galleryInput.value = '';
            galleryInput.click();
        }
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
// IMAGE SELECTION AND PREVIEW - MOBILE OPTIMIZED
// ====================
function handleImageSelect(event) {
    console.log('File selected event triggered', event);

    try {
        const fileInput = event.target;

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            console.error('No files selected in input');
            if (typeof showToast === 'function') {
                showToast('No image selected', '⚠️');
            }
            return;
        }

        const file = fileInput.files[0];

        if (!file) {
            console.error('File object is null');
            if (typeof showToast === 'function') {
                showToast('Invalid file selection', '⚠️');
            }
            return;
        }

        console.log('✅ File successfully captured:', {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
        });

        if (!file.type.startsWith('image/')) {
            console.log('Not an image file:', file.type);
            if (typeof showToast === 'function') {
                showToast('Please select an image file', '⚠️');
            }
            fileInput.value = '';
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            console.log('File too large:', file.size);
            if (typeof showToast === 'function') {
                showToast('Image too large. Max 10MB', '⚠️');
            }
            fileInput.value = '';
            return;
        }

        currentFileForUpload = file;
        console.log('✅ File stored for upload:', currentFileForUpload?.name);

        createImagePreview(file);

    } catch (error) {
        console.error('Error handling image selection:', error);
        if (typeof showToast === 'function') {
            showToast('Error selecting image', '❌');
        }

        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';
        currentFileForUpload = null;
    }
}

// ====================
// IMAGE PREVIEW - MOBILE COMPATIBLE
// ====================

function createImagePreview(file) {
    console.log('Creating image preview for file:', file?.name || 'unknown');

    if (!file) {
        console.error('createImagePreview called with null file');
        if (typeof showToast === 'function') {
            showToast('Cannot preview image', '⚠️');
        }
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
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

            closeImagePicker();

            setTimeout(() => {
                const preview = document.getElementById('imagePreviewOverlay');
                if (preview) {
                    preview.style.opacity = '1';
                    
                    // MOBILE FIX: Prevent scrolling in preview
                    if (isMobileChrome()) {
                        preview.addEventListener('touchmove', function(e) {
                            e.preventDefault();
                        }, { passive: false });
                    }
                    
                    console.log('✅ Preview shown');
                }
            }, 10);
        } catch (error) {
            console.error('Error creating preview HTML:', error);
            if (typeof showToast === 'function') {
                showToast('Error creating preview', '❌');
            }
        }
    };

    reader.onerror = function(error) {
        console.error('Error reading file for preview:', error);
        if (typeof showToast === 'function') {
            showToast('Error reading image file', '❌');
        }
        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';
        currentFileForUpload = null;
        closeImagePicker();
    };

    reader.readAsDataURL(file);
}

// ====================
// IMAGE PREVIEW FUNCTIONS
// ====================
function cancelImageUpload() {
    console.log('Cancelling image upload');

    document.getElementById('cameraInput').value = '';
    document.getElementById('galleryInput').value = '';

    imagePreviewUrl = null;
    currentFileForUpload = null;
    uploadInProgress = false;

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
    console.log('uploadImageFromPreview called');

    if (uploadInProgress) {
        console.log('Upload already in progress');
        return;
    }

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

    if (!currentFileForUpload || !currentFileForUpload.name || !currentFileForUpload.type) {
        console.error('No valid file to upload');
        if (typeof showToast === 'function') {
            showToast('No image selected or file is invalid', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    console.log('Starting upload process for:', currentFileForUpload.name);
    uploadInProgress = true;

    const fileToUpload = currentFileForUpload;

    const preview = document.getElementById('imagePreviewOverlay');
    if (preview) {
        preview.style.opacity = '0';
        setTimeout(() => {
            preview.remove();
            console.log('✅ Preview removed');
        }, 300);
    }

    if (typeof showLoading === 'function') {
        showLoading(true, 'Uploading image...');
    }

    try {
        await uploadImageToImgBB(fileToUpload);
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
// IMAGE UPLOAD TO IMGBB - MOBILE CHROME OPTIMIZED
// ====================
async function uploadImageToImgBB(file) {
    console.log('uploadImageToImgBB called with file:', file?.name || 'unknown');

    if (!file) {
        console.error('❌ uploadImageToImgBB: File is null');
        throw new Error('No image file selected');
    }

    if (!file.name || file.name === 'unknown' || !file.type || typeof file.size === 'undefined') {
        console.error('❌ uploadImageToImgBB: Invalid file object:', {
            name: file.name,
            type: file.type,
            size: file.size
        });
        throw new Error('Invalid image file');
    }

    console.log('✅ Starting ImgBB upload for:', file.name);

    try {
        console.log('File details:', {
            name: file.name,
            type: file.type,
            size: file.size + ' bytes'
        });

        const fileCopy = new File([file], file.name, {
            type: file.type,
            lastModified: Date.now()
        });

        let processedFile;
        try {
            processedFile = await compressImage(fileCopy);
            console.log('Compression complete:', processedFile?.name);
        } catch (compressError) {
            console.warn('Compression failed, using original file:', compressError.message);
            processedFile = fileCopy;
        }

        if (!processedFile) {
            console.error('Processed file is null, using original');
            processedFile = fileCopy;
        }

        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', processedFile);
        formData.append('name', `relaytalk_${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
        formData.append('expiration', '600');

        const url = 'https://api.imgbb.com/1/upload';
        console.log('Uploading to ImgBB...');

        // MOBILE FIX: Different timeout for mobile
        const timeout = isMobileChrome() ? 30000 : 15000;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit'
        });

        clearTimeout(timeoutId);

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

        let imageUrl = data.data.url;
        let thumbnailUrl = data.data.thumb?.url || data.data.url;

        imageUrl = ensureHttpsUrl(imageUrl);
        thumbnailUrl = ensureHttpsUrl(thumbnailUrl);

        console.log('✅ Image uploaded successfully!');
        console.log('Image URL (fixed):', imageUrl);

        await sendImageMessage(imageUrl, thumbnailUrl);

    } catch (error) {
        console.error('Image upload error:', error);

        if (error.name === 'AbortError') {
            console.error('Upload timeout');
            if (typeof showToast === 'function') {
                showToast('Upload timed out. Please check your connection.', '⚠️', 4000);
            }
        } else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
            console.error('CORS error detected.');
            if (typeof showToast === 'function') {
                showToast('Browser security restriction. Please try again.', '⚠️', 4000);
            }
        }

        throw error;
    }
}

// ====================
// URL FIXER - ENHANCED FOR MOBILE
// ====================
function ensureHttpsUrl(url) {
    if (!url) return url;

    let fixedUrl = url;

    if (fixedUrl.startsWith('http://')) {
        fixedUrl = fixedUrl.replace('http://', 'https://');
    }

    if (fixedUrl.startsWith('https://https://')) {
        fixedUrl = fixedUrl.replace('https://https://', 'https://');
    }

    if (fixedUrl.includes('i.ibb.co')) {
        fixedUrl = fixedUrl.replace('http://i.ibb.co', 'https://i.ibb.co');
    }

    // MOBILE FIX: Different cache busting for mobile
    if (isMobileChrome()) {
        const cacheBuster = `?mobile_cb=${Date.now()}`;
        if (!fixedUrl.includes('?')) {
            fixedUrl += cacheBuster;
        } else {
            fixedUrl += '&' + cacheBuster.substring(1);
        }
    } else if (navigator.userAgent.includes('Chrome')) {
        const cacheBuster = `?cb=${Date.now()}`;
        if (!fixedUrl.includes('?')) {
            fixedUrl += cacheBuster;
        } else {
            fixedUrl += '&' + cacheBuster.substring(1);
        }
    }

    console.log('URL fixed:', fixedUrl);
    return fixedUrl;
}

// ====================
// IMAGE COMPRESSION - MOBILE OPTIMIZED
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
                const MAX_DIMENSION = isMobileChrome() ? 800 : 1200;

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
                ctx.imageSmoothingQuality = 'medium'; // Lower quality for mobile
                ctx.drawImage(img, 0, 0, width, height);

                let quality = isMobileChrome() ? 0.7 : 0.8;

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
// SEND IMAGE MESSAGE - MOBILE COMPATIBLE
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

        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: '',
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            created_at: new Date().toISOString()
        };

        console.log('Sending message data with URLs:', {
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl
        });

        if (selectedColor) {
            messageData.color = selectedColor;
            console.log('Adding color to message:', selectedColor);
            selectedColor = null;
            window.selectedColor = null;
        }

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

        if (typeof playSentSound === 'function') {
            playSentSound();
        }

        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';

        currentFileForUpload = null;

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

        const input = document.getElementById('messageInput');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
}

// ====================
// IMAGE MESSAGE HTML CREATOR - MOBILE OPTIMIZED
// ====================
function createImageMessageHTML(msg, isSent, colorAttr, time) {
    const imageUrl = msg.image_url || '';
    const thumbnailUrl = msg.thumbnail_url || imageUrl;
    const content = msg.content || '';

    let displayImageUrl = ensureHttpsUrl(imageUrl);
    let displayThumbnailUrl = ensureHttpsUrl(thumbnailUrl);

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

    let fixedUrl = ensureHttpsUrl(originalUrl);

    if (fixedUrl !== originalUrl) {
        imgElement.src = fixedUrl;
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

    let fixedImageUrl = ensureHttpsUrl(imageUrl);

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

    let fixedUrl = ensureHttpsUrl(originalUrl);
    if (fixedUrl !== originalUrl) {
        imgElement.src = fixedUrl;
        return;
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
    let downloadUrl = ensureHttpsUrl(imageUrl);

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

console.log('✅ Image handler functions exported - CHROME MOBILE FIXED 🎉💯');