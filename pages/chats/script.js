// ====================
// MAIN SCRIPT - CHAT MODULE COORDINATOR
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

// Wait for both modules to signal they're ready
let moduleCheckInterval = setInterval(() => {
    if (window.chatModules.coreLoaded && window.chatModules.imgHandlerLoaded && !window.chatModules.ready) {
        window.chatModules.ready = true;
        clearInterval(moduleCheckInterval);
        initializeChatApp();
    }
}, 100);

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

    // Update placeholder text
    const input = document.getElementById('messageInput');
    if (input) {
        input.placeholder = 'Type a message...';
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
        setTimeout(setupModuleCoordination, 300);

        // Setup debug helper
        window.debugChatState = debugChatState;
    } else {
        console.error('❌ Some critical elements are missing');
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Some elements failed to load. Please refresh.', '❌', 'Error');
        }
    }
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
}

function handleClickOutside(e) {
    const picker = document.getElementById('imagePickerOverlay');
    const attachBtn = document.getElementById('attachBtn');
    const preview = document.getElementById('imagePreviewOverlay');
    const colorPicker = document.getElementById('colorPickerOverlay');
    const input = document.getElementById('messageInput');

    // Check if color picker is open
    const isColorPickerOpen = colorPicker && colorPicker.style.display === 'flex';

    // Close color picker if clicking outside
    if (isColorPickerOpen && !colorPicker.contains(e.target) && e.target !== input) {
        if (typeof cancelColorSelection === 'function') {
            cancelColorSelection();
        }
    }

    // Check if image picker is open
    const isPickerOpen = picker && picker.style.display === 'flex';
    const isPreviewOpen = preview && (preview.style.opacity === '1' || preview.style.display === 'flex');

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

    console.log('✅ Module coordination complete!');
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
                // Try to use image message HTML creator
                if (typeof createImageMessageHTML === 'function') {
                    html += createImageMessageHTML(msg, isSent, colorAttr, time);
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
                newMessage.style.transition = 'all 0.3s ease';
                newMessage.style.opacity = '1';
                newMessage.style.transform = 'translateY(0)';
            }, 10);
        }

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
                setTimeout(() => document.title = originalTitle, 1000);
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
            showToast('Chat refreshed', '🔄');
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
            showToast('Reconnected', '🔗');
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

    if (typeof showToast === 'function') {
        showToast('Modules reinitialized', '🔄');
    }
};

// ====================
// INITIALIZATION SIGNAL
// ====================
console.log('✅ Main coordinator loaded - waiting for modules...');

// Signal that main script is loaded
window.mainScriptLoaded = true;