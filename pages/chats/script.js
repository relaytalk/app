// ====================
// MAIN SCRIPT - MULTI-IMAGE SUPPORT
// ====================
console.log('🚀 RelayTalk Chat Application Starting...');

// Import modules
import './chat-core.js';
import './img-handler.js';

// Global state tracking
window.chatModules = {
    coreLoaded: false,
    imgHandlerLoaded: false,
    ready: false
};

// Enhanced mobile detection
function isMobileChrome() {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isChrome = /Chrome/i.test(ua) && !/Edge|Edg|OPR/i.test(ua);
    return isMobile && isChrome;
}

function isIOSChrome() {
    const ua = navigator.userAgent;
    return /CriOS/i.test(ua) && /iPhone|iPad|iPod/i.test(ua);
}

window.isMobileChrome = isMobileChrome;
window.isIOSChrome = isIOSChrome;

// Apply mobile fixes immediately
if (isMobileChrome() || isIOSChrome()) {
    console.log('📱 Mobile Chrome detected - applying initial fixes');

    // Add mobile class to body
    document.body.classList.add('chrome-mobile');

    // Fix for address bar hiding
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    window.addEventListener('resize', () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    });

    // Prevent pull-to-refresh on mobile
    document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    // Fix for iOS bounce effect
    document.body.style.overscrollBehaviorY = 'none';
}

// CHROME MOBILE DNS FIX: Preconnect to ImgBB
if (isMobileChrome() || isIOSChrome()) {
    console.log('🔗 Preconnecting to ImgBB for mobile');
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://i.ibb.co';
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);
}

// Wait for both modules to signal they're ready
let moduleCheckInterval = setInterval(() => {
    if (window.chatModules.coreLoaded && window.chatModules.imgHandlerLoaded && !window.chatModules.ready) {
        window.chatModules.ready = true;
        clearInterval(moduleCheckInterval);
        initializeChatApp();
    }
}, 50);

// Main initialization after modules are ready
function initializeChatApp() {
    console.log('✅ All chat modules ready!');

    // Setup application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupApplication);
    } else {
        setupApplication();
    }
}

function setupApplication() {
    console.log('🔧 Setting up application...');

    // CHROME MOBILE FIX: Add viewport height fix
    updateViewportHeightForMobile();

    // Update placeholder text
    const input = document.getElementById('messageInput');
    if (input) {
        input.placeholder = 'Type a message...';

        // Mobile Chrome input fix
        if (isMobileChrome() || isIOSChrome()) {
            input.addEventListener('focus', function() {
                setTimeout(() => {
                    // Prevent zoom on focus for iOS
                    if (isIOSChrome()) {
                        this.style.fontSize = '16px';
                    }
                    window.scrollTo(0, 0);
                }, 50);
            });

            input.addEventListener('blur', function() {
                if (isIOSChrome()) {
                    this.style.fontSize = '';
                }
            });
        }
    }

    // Verify critical elements exist
    const criticalElements = [
        'messagesContainer',
        'messageInput',
        'sendBtn',
        'attachBtn',
        'customAlert',
        'customToast'
    ];

    let allElementsFound = true;
    criticalElements.forEach(id => {
        if (!document.getElementById(id)) {
            console.warn(`⚠️ Critical element not found: ${id}`);
            allElementsFound = false;
        }
    });

    if (allElementsFound) {
        console.log('🎉 Chat application ready for use!');

        // Setup global handlers
        setupGlobalHandlers();

        // Setup module coordination
        setTimeout(setupModuleCoordination, 150);

        // Setup debug helper
        window.debugChatState = debugChatState;

        // Mobile specific setup
        if (isMobileChrome() || isIOSChrome()) {
            setupMobileChromeFixes();
        }

        // Apply CSS fixes for mobile
        applyMobileCSSFixes();
    } else {
        console.error('❌ Some critical elements are missing');
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Some elements failed to load. Please refresh.', '❌', 'Error');
        }
    }
}

// ====================
// MOBILE CSS FIXES
// ====================
function applyMobileCSSFixes() {
    if (!isMobileChrome() && !isIOSChrome()) return;

    const style = document.createElement('style');
    style.textContent = `
        /* Chrome Mobile Fixes */
        .chrome-mobile {
            -webkit-text-size-adjust: 100% !important;
            text-size-adjust: 100% !important;
            -webkit-font-smoothing: antialiased !important;
        }
        
        /* Fix for 100vh issue */
        html.chrome-mobile, 
        body.chrome-mobile {
            height: 100% !important;
            max-height: -webkit-fill-available !important;
            overflow: hidden !important;
            position: fixed !important;
            width: 100% !important;
        }
        
        #chat.chrome-mobile {
            height: 100vh !important;
            height: calc(var(--vh, 1vh) * 100) !important;
            position: relative !important;
        }
        
        .main-content.chrome-mobile {
            height: calc(100vh - 150px) !important;
            height: calc(calc(var(--vh, 1vh) * 100) - 150px) !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
        }
        
        /* Fix for ImgBB images on mobile */
        .message-image.chrome-mobile {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            border-radius: 12px !important;
            transform: translateZ(0) !important;
            -webkit-transform: translateZ(0) !important;
            will-change: transform !important;
        }
        
        /* Prevent blue tap highlight */
        .chrome-mobile * {
            -webkit-tap-highlight-color: transparent !important;
            tap-highlight-color: transparent !important;
        }
        
        /* Fix for buttons on mobile */
        button.chrome-mobile {
            min-height: 44px !important;
            min-width: 44px !important;
        }
        
        /* Fix for input zoom on iOS */
        @supports (-webkit-touch-callout: none) {
            input[type="text"].chrome-mobile,
            textarea.chrome-mobile {
                font-size: 16px !important;
            }
        }
        
        /* Fix for safe areas */
        .chrome-mobile {
            padding-top: env(safe-area-inset-top) !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
            padding-left: env(safe-area-inset-left) !important;
            padding-right: env(safe-area-inset-right) !important;
        }
        
        /* Prevent elastic scrolling */
        .messages-container.chrome-mobile {
            overscroll-behavior: contain !important;
            -webkit-overflow-scrolling: touch !important;
        }
    `;

    document.head.appendChild(style);
    console.log('✅ Mobile CSS fixes applied');
}

function updateViewportHeightForMobile() {
    if (!isMobileChrome() && !isIOSChrome()) return;

    function updateVH() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    updateVH();
    window.addEventListener('resize', updateVH);
    window.addEventListener('orientationchange', updateVH);
}

// ====================
// MOBILE CHROME SPECIFIC FIXES
// ====================
function setupMobileChromeFixes() {
    console.log('Setting up Mobile Chrome fixes...');

    // Fix for double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // Fix for input zoom on focus
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            setTimeout(() => {
                // iOS Chrome specific fix
                if (isIOSChrome()) {
                    window.scrollTo(0, 0);
                    input.style.fontSize = '16px';
                }
            }, 50);
        });

        input.addEventListener('blur', () => {
            if (isIOSChrome()) {
                input.style.fontSize = '';
            }
        });
    });

    // Fix for fast clicks
    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    // Fix for pull-to-refresh
    document.body.style.overscrollBehavior = 'none';

    // Fix for image loading on mobile
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
            }
        });
    }, {
        rootMargin: '50px'
    });

    // Observe all images
    document.querySelectorAll('img[data-src]').forEach(img => {
        observer.observe(img);
    });

    console.log('✅ Mobile Chrome fixes applied');
}

// ====================
// GLOBAL HANDLERS
// ====================
function setupGlobalHandlers() {
    console.log('🔧 Setting up global handlers...');

    // Click outside handlers
    document.addEventListener('click', (e) => {
        handleClickOutside(e);
    });

    // Setup global error handlers
    setupGlobalErrorHandlers();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup touch handlers for mobile
    if (isMobileChrome() || isIOSChrome()) {
        setupTouchHandlers();
    }
}

function setupTouchHandlers() {
    // Fix for touch events on buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function(e) {
            this.style.transform = 'scale(0.98)';
            this.style.transition = 'transform 0.1s';
        });

        button.addEventListener('touchend', function(e) {
            this.style.transform = '';
        });
    });

    // Fix for scrolling in messages container
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.style.webkitOverflowScrolling = 'touch';

        messagesContainer.addEventListener('touchstart', function(e) {
            this.style.overflowY = 'hidden';
        });

        messagesContainer.addEventListener('touchmove', function(e) {
            this.style.overflowY = 'auto';
        });
    }

    // Fix for image viewer on mobile
    document.addEventListener('touchmove', function(e) {
        const viewer = document.getElementById('imageViewerOverlay');
        if (viewer && viewer.style.display !== 'none') {
            e.preventDefault();
        }
    }, { passive: false });
}

function handleClickOutside(e) {
    const picker = document.getElementById('imagePickerOverlay');
    const attachBtn = document.getElementById('attachBtn');
    const preview = document.getElementById('imagePreviewOverlay');
    const colorPicker = document.getElementById('colorPickerOverlay');
    const input = document.getElementById('messageInput');

    // Check if color picker is open
    const isColorPickerOpen = colorPicker && 
        (colorPicker.style.display === 'flex' || 
         (colorPicker.style.opacity === '1' && colorPicker.style.display !== 'none'));

    // Close color picker if clicking outside
    if (isColorPickerOpen && !colorPicker.contains(e.target) && e.target !== input) {
        if (typeof cancelColorSelection === 'function') {
            cancelColorSelection();
        }
    }

    // Check if image picker is open
    const isPickerOpen = picker && 
        (picker.style.display === 'flex' || 
         (picker.style.opacity === '1' && picker.style.display !== 'none'));
    const isPreviewOpen = preview && 
        (preview.style.opacity === '1' || 
         preview.style.display === 'flex');

    // Close image picker if clicking outside
    if (isPickerOpen && !isPreviewOpen && !picker.contains(e.target) && e.target !== attachBtn) {
        if (typeof closeImagePicker === 'function') {
            closeImagePicker();
        }
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl + R to refresh chat
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            if (typeof window.refreshChat === 'function') {
                window.refreshChat();
            }
        }

        // Esc key closes modals
        if (e.key === 'Escape') {
            const activeModals = [
                'imagePickerOverlay',
                'imagePreviewOverlay',
                'imageViewerOverlay',
                'userInfoModal',
                'customAlert'
            ];

            activeModals.forEach(id => {
                const modal = document.getElementById(id);
                if (modal && (modal.style.display === 'flex' || modal.style.opacity === '1')) {
                    if (id === 'imagePickerOverlay' && typeof closeImagePicker === 'function') {
                        closeImagePicker();
                    } else if (id === 'imagePreviewOverlay' && typeof cancelImageUpload === 'function') {
                        cancelImageUpload();
                    } else if (id === 'imageViewerOverlay' && typeof closeImageViewer === 'function') {
                        closeImageViewer();
                    } else if (id === 'userInfoModal' && typeof closeModal === 'function') {
                        closeModal();
                    } else if (id === 'customAlert') {
                        modal.style.display = 'none';
                    }
                }
            });
        }
    });
}

// ====================
// MODULE COORDINATION
// ====================

function setupModuleCoordination() {
    console.log('🔧 Setting up module coordination...');

    // Override message display to handle images
    overrideMessageDisplay();

    // Override real-time message handling
    overrideRealtimeHandling();

    // Setup image URL fixing
    setupImageURLFixing();

    console.log('✅ Module coordination complete!');
}

function setupImageURLFixing() {
    // Override URL fixing for all image URLs
    window.fixAllImageURLs = function() {
        if (!isMobileChrome() && !isIOSChrome()) return;

        console.log('🔧 Fixing all image URLs for mobile...');

        // Fix existing image URLs
        const images = document.querySelectorAll('img[src*="ibb.co"], img[src*="imgbb.com"]');
        images.forEach(img => {
            const originalSrc = img.src;
            if (typeof fixImgBBUrls === 'function') {
                const fixedSrc = fixImgBBUrls(originalSrc);
                if (fixedSrc !== originalSrc) {
                    img.src = fixedSrc;
                }
            }
        });

        // Fix background images
        const elements = document.querySelectorAll('[style*="background-image"]');
        elements.forEach(el => {
            const style = el.style.backgroundImage;
            if (style && style.includes('ibb.co')) {
                if (typeof fixImgBBUrls === 'function') {
                    const fixedStyle = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
                        return `url("${fixImgBBUrls(url)}")`;
                    });
                    el.style.backgroundImage = fixedStyle;
                }
            }
        });
    };

    // Run initially and on new messages
    setTimeout(window.fixAllImageURLs, 300);

    // Observe DOM for new images
    const observer = new MutationObserver(() => {
        window.fixAllImageURLs();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function overrideMessageDisplay() {
    // Create new showMessages that handles images
    window.showMessages = function(messages) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        // If no messages, show empty state
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

            // Fix URLs for mobile
            setTimeout(window.fixAllImageURLs, 50);
            return;
        }

        let html = '';
        let lastDate = '';

        messages.forEach(msg => {
            const isSent = msg.sender_id === (window.currentUser?.id || '');
            const time = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
            const date = new Date(msg.created_at).toLocaleDateString();

            // Add date separator if new date
            if (date !== lastDate) {
                html += `<div class="date-separator"><span>${date}</span></div>`;
                lastDate = date;
            }

            // Get color from database
            const color = msg.color || null;
            const colorAttr = color ? `data-color="${color}"` : '';

            // Check if message has image
            if (msg.image_url) {
                // CHROME MOBILE FIX: Apply URL fixing before creating HTML
                let imageUrl = msg.image_url;
                let thumbnailUrl = msg.thumbnail_url || msg.image_url;

                if (typeof fixImgBBUrls === 'function') {
                    imageUrl = fixImgBBUrls(imageUrl);
                    thumbnailUrl = fixImgBBUrls(thumbnailUrl);
                }

                // Use image message HTML creator
                if (typeof createImageMessageHTML === 'function') {
                    // Create a modified message object with fixed URLs
                    const fixedMsg = {
                        ...msg,
                        image_url: imageUrl,
                        thumbnail_url: thumbnailUrl
                    };
                    html += createImageMessageHTML(fixedMsg, isSent, colorAttr, time);
                } else {
                    // Fallback to text display with image link
                    html += `
                        <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}" ${colorAttr}>
                            <div class="message-content">📸 Image shared</div>
                            <div class="message-time">${time}</div>
                        </div>
                    `;
                }
            } else {
                // Regular text message
                html += `
                    <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}" ${colorAttr}>
                        <div class="message-content">${msg.content || ''}</div>
                        <div class="message-time">${time}</div>
                    </div>
                `;
            }
        });

        // Add padding at bottom
        html += `<div style="height: 30px; opacity: 0;"></div>`;
        container.innerHTML = html;

        // CHROME MOBILE FIX: Apply URL fixing
        setTimeout(() => {
            if (typeof window.fixAllImageURLs === 'function') {
                window.fixAllImageURLs();
            }
        }, 50);

        // Scroll to bottom
        setTimeout(() => {
            if (typeof forceScrollToBottom === 'function') {
                forceScrollToBottom();
            }
        }, 100);
    };

    console.log('✅ Message display override set');
}

function overrideRealtimeHandling() {
    // Create new addMessageToUI for real-time
    window.addMessageToUI = function(message, isFromRealtime = false) {
        const container = document.getElementById('messagesContainer');
        if (!container || !message) return;

        // Remove empty chat state if present
        if (container.querySelector('.empty-chat')) {
            container.innerHTML = '';
        }

        const isSent = message.sender_id === (window.currentUser?.id || '');
        const time = new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const color = message.color || null;
        const colorAttr = color ? `data-color="${color}"` : '';

        // CHROME MOBILE FIX: Fix image URLs before creating HTML
        if (message.image_url && typeof fixImgBBUrls === 'function') {
            message.image_url = fixImgBBUrls(message.image_url);
            if (message.thumbnail_url) {
                message.thumbnail_url = fixImgBBUrls(message.thumbnail_url);
            }
        }

        let messageHTML;

        // Check if message has image
        if (message.image_url) {
            // Try to use image message HTML creator
            if (typeof createImageMessageHTML === 'function') {
                messageHTML = createImageMessageHTML(message, isSent, colorAttr, time);
            } else {
                // Fallback
                messageHTML = `
                    <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message.id}" ${colorAttr}>
                        <div class="message-content">📸 Image shared</div>
                        <div class="message-time">${time}</div>
                    </div>
                `;
            }
        } else {
            // Text message
            messageHTML = `
                <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message.id}" ${colorAttr}>
                    <div class="message-content">${message.content || ''}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }

        // Add to container
        container.insertAdjacentHTML('beforeend', messageHTML);

        // Check for duplicates
        const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
        if (existingMessage && existingMessage !== container.lastElementChild) {
            container.removeChild(container.lastElementChild);
            return;
        }

        // Add to messages array if it exists
        if (window.currentMessages && !window.currentMessages.some(msg => msg.id === message.id)) {
            window.currentMessages.push(message);
        }

        // Animate new message
        const newMessage = container.lastElementChild;
        if (newMessage && isFromRealtime) {
            newMessage.style.opacity = '0';
            newMessage.style.transform = 'translateY(10px)';

            setTimeout(() => {
                newMessage.style.transition = 'all 0.15s ease';
                newMessage.style.opacity = '1';
                newMessage.style.transform = 'translateY(0)';
            }, 10);
        }

        // CHROME MOBILE FIX: Apply URL fixing for new images
        setTimeout(() => {
            if (typeof window.fixAllImageURLs === 'function') {
                window.fixAllImageURLs();
            }
        }, 30);

        // Scroll to bottom
        setTimeout(() => {
            if (typeof forceScrollToBottom === 'function') {
                forceScrollToBottom();
            }
        }, 10);

        // Notification for received messages
        if (message.sender_id === (window.chatFriend?.id || '')) {
            if (typeof playReceivedSound === 'function') {
                playReceivedSound();
            }
            if (!document.hasFocus()) {
                const originalTitle = document.title;
                document.title = '📸 ' + (window.chatFriend?.username || 'Friend');
                setTimeout(() => document.title = originalTitle, 800);
            }
        }
    };

    console.log('✅ Real-time handling override set');
}

// ====================
// GLOBAL ERROR HANDLERS
// ====================
function setupGlobalErrorHandlers() {
    // Global error handler
    window.addEventListener('error', function(e) {
        console.error('Global error caught:', e.error);
        const errorMessage = e.error ? e.error.message : 'An unexpected error occurred';

        if (typeof showCustomAlert === 'function') {
            showCustomAlert(`Error: ${errorMessage}. Please refresh.`, '❌', 'Application Error');
        }
    });

    // Unhandled promise rejection
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        if (typeof showToast === 'function') {
            showToast('An error occurred. Please try again.', '⚠️');
        }
    });

    // Network error handling
    window.addEventListener('online', function() {
        if (typeof showToast === 'function') {
            showToast('Back online', '🟢', 1500);
        }
    });

    window.addEventListener('offline', function() {
        if (typeof showToast === 'function') {
            showToast('No internet connection', '⚠️', 1500);
        }
    });

    // Image loading error handler
    window.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG') {
            const img = e.target;
            if (img.src && img.src.includes('ibb.co')) {
                console.error('Image failed to load:', img.src);
                if (typeof fixImgBBUrls === 'function') {
                    const fixedSrc = fixImgBBUrls(img.src);
                    if (fixedSrc !== img.src) {
                        img.src = fixedSrc;
                    }
                }
            }
        }
    }, true);
}

// ====================
// DEBUG & UTILITY FUNCTIONS
// ====================

function debugChatState() {
    console.log('=== CHAT DEBUG INFO ===');
    console.log('Current User:', window.currentUser);
    console.log('Chat Friend:', window.chatFriend);
    console.log('Color Picker Visible:', window.colorPickerVisible);
    console.log('Is Sending:', window.isSending);
    console.log('Is Typing:', window.isTyping);
    console.log('Selected Color:', window.selectedColor);
    console.log('Current Messages:', window.currentMessages ? window.currentMessages.length : 0);
    console.log('Chat Modules Ready:', window.chatModules?.ready);
    console.log('Mobile Chrome:', isMobileChrome());
    console.log('iOS Chrome:', isIOSChrome());
    console.log('Viewport Height:', window.innerHeight, 'px');
    console.log('CSS VH:', getComputedStyle(document.documentElement).getPropertyValue('--vh'));
    console.log('=====================');
}

// Refresh chat function
window.refreshChat = function() {
    console.log('Refreshing chat...');
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friendId');

    if (friendId && typeof loadOldMessages === 'function') {
        loadOldMessages(friendId);
        if (typeof showToast === 'function') {
            showToast('Chat refreshed', '🔄', 1500);
        }
    }
};

// Reconnect real-time
window.reconnectRealtime = function() {
    console.log('Reconnecting real-time...');
    const urlParams = new URLSearchParams(window.location.search);
    const friendId = urlParams.get('friendId');

    if (friendId && typeof setupRealtime === 'function') {
        // Clean up existing channels
        if (window.chatChannel && typeof supabase !== 'undefined') {
            supabase.removeChannel(window.chatChannel);
        }
        if (window.statusChannel && typeof supabase !== 'undefined') {
            supabase.removeChannel(window.statusChannel);
        }

        // Reconnect
        setupRealtime(friendId);
        if (typeof showToast === 'function') {
            showToast('Reconnected', '🔗', 1500);
        }
    }
};

// Force reinitialize
window.reinitializeModules = function() {
    console.log('Reinitializing modules...');

    // Clear any existing intervals or timeouts
    if (window.typingTimeout) {
        clearTimeout(window.typingTimeout);
        window.typingTimeout = null;
    }

    if (window.friendTypingTimeout) {
        clearTimeout(window.friendTypingTimeout);
        window.friendTypingTimeout = null;
    }

    // Re-run module coordination
    setupModuleCoordination();

    // Reapply mobile fixes
    if (isMobileChrome() || isIOSChrome()) {
        setupMobileChromeFixes();
        updateViewportHeightForMobile();
    }

    if (typeof showToast === 'function') {
        showToast('Modules reinitialized', '🔄', 1500);
    }
};

// CHROME MOBILE UTILITY: Fix broken image URLs
window.fixBrokenImages = function() {
    if (!isMobileChrome() && !isIOSChrome()) return;

    const images = document.querySelectorAll('img');
    let fixedCount = 0;

    images.forEach(img => {
        if (img.complete && img.naturalHeight === 0) {
            // Image failed to load
            const src = img.src;
            if (src && src.includes('ibb.co')) {
                if (typeof fixImgBBUrls === 'function') {
                    const fixedSrc = fixImgBBUrls(src);
                    if (fixedSrc !== src) {
                        img.src = fixedSrc;
                        fixedCount++;
                    }
                }
            }
        }
    });

    if (fixedCount > 0) {
        console.log(`✅ Fixed ${fixedCount} broken images`);
    }
};

// Run periodic image checks for mobile
if (isMobileChrome() || isIOSChrome()) {
    setInterval(window.fixBrokenImages, 10000); // Every 10 seconds
}

// ====================
// INITIALIZATION SIGNAL
// ====================
console.log('✅ Main coordinator loaded - waiting for modules...');

// Signal that main script is loaded
window.mainScriptLoaded = true;

// Add global mobile detection
window.isMobileDevice = isMobileChrome() || isIOSChrome();

console.log('📱 Mobile Device:', window.isMobileDevice);