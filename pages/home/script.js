// home/script.js - WITH FAST REDIRECT TO ROOT

import { auth } from '../../utils/auth.js'

console.log("✨ Relay Home Page Loaded");

// IMMEDIATE REDIRECT CHECK - MUST BE FIRST
(function() {
    const hasSession = localStorage.getItem('supabase.auth.token') || 
                      sessionStorage.getItem('supabase.auth.token');
    
    if (!hasSession) {
        console.log('🚫 No session - redirecting to root');
        window.location.replace('/');
        return;
    }
})();

// Toast Notification System (keep your existing code)
class ToastNotification {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) this.createToastContainer();
    }

    createToastContainer() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.id = 'toastContainer';
        document.body.prepend(this.container);
    }

    show(options) {
        const { title = '', message = '', type = 'info', duration = 5000 } = options;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = '💬';
        switch(type) {
            case 'success': icon = '✨'; break;
            case 'error': icon = '❌'; break;
            case 'warning': icon = '⚠️'; break;
            case 'info': icon = '💬'; break;
        }

        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">
                    ${title}
                    <span class="toast-time">${time}</span>
                </div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            <div class="toast-progress">
                <div class="toast-progress-bar"></div>
            </div>
        `;

        this.container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    success(title, message = '', duration = 5000) {
        return this.show({ title, message, type: 'success', duration });
    }

    error(title, message = '', duration = 7000) {
        return this.show({ title, message, type: 'error', duration });
    }

    warning(title, message = '', duration = 6000) {
        return this.show({ title, message, type: 'warning', duration });
    }

    info(title, message = '', duration = 4000) {
        return this.show({ title, message, type: 'info', duration });
    }
}

const toast = new ToastNotification();

window.showToast = toast.show.bind(toast);
window.showSuccess = toast.success.bind(toast);
window.showError = toast.error.bind(toast);
window.showWarning = toast.warning.bind(toast);
window.showInfo = toast.info.bind(toast);

let currentUser = null;
let currentProfile = null;

// Wait for Supabase to be ready
async function waitForSupabase() {
    console.log('⏳ Waiting for Supabase...');

    if (window.supabase) {
        console.log('✅ Supabase already loaded');
        return true;
    }

    try {
        await import('../../utils/supabase.js');

        let attempts = 0;
        while (!window.supabase && attempts < 25) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        if (window.supabase) {
            console.log('✅ Supabase loaded successfully after', attempts, 'attempts');
            return true;
        } else {
            console.error('❌ Supabase failed to load after waiting');
            return false;
        }

    } catch (error) {
        console.error('❌ Error loading Supabase:', error);
        return false;
    }
}

// Initialize home page
async function initHomePage() {
    console.log('🏠 Initializing home page...');

    // DOUBLE CHECK: Verify authentication immediately
    try {
        const { success, user } = await auth.getCurrentUser();
        
        if (!success || !user) {
            console.log('❌ No authenticated user - redirecting to root');
            window.location.replace('/');
            return;
        }
        
        currentUser = user;
        console.log('✅ User authenticated:', currentUser.email);
        
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.replace('/');
        return;
    }

    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    try {
        const supabaseReady = await waitForSupabase();
        if (!supabaseReady) {
            toast.error("Connection Error", "Cannot connect to server. Please check your internet.");
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            return;
        }

        if (loadingIndicator) loadingIndicator.style.display = 'none';

        await loadUserProfile();
        updateWelcomeMessage();
        await loadFriends();
        await updateNotificationsBadge();
        setupEventListeners();

        console.log('✅ Home page initialized successfully');

        setTimeout(() => {
            if (currentProfile) {
                toast.success("Welcome back!", `Good to see you, ${currentProfile.username}! 👋`);
            }
        }, 800);

    } catch (error) {
        console.error('❌ Home page initialization failed:', error);

        if (loadingIndicator) loadingIndicator.style.display = 'none';

        toast.error("Initialization Error", "Failed to load page. Please refresh.");

        setTimeout(() => {
            window.location.href = '../auth/index.html';
        }, 3000);
    }
}

// 🔥 FIXED: Logout function - redirects to ROOT, not auth
window.logout = async function() {
    try {
        const loadingToast = toast.info("Logging Out", "Please wait...");
        
        if (window.supabase) {
            await window.supabase.auth.signOut();
        }
        
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear cookies
        document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        if (loadingToast && loadingToast.parentNode) loadingToast.remove();
        toast.success("Logged Out", "See you soon! 👋");
        
        // ✅ REDIRECT TO ROOT, NOT AUTH
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
        
    } catch (error) {
        console.error("Error logging out:", error);
        toast.error("Logout Failed", "Please try again");
    }
};

// REST OF YOUR CODE STAYS EXACTLY THE SAME...
// [Keep all your existing functions: loadUserProfile, updateWelcomeMessage, 
//  loadFriends, openChat, loadSearchResults, sendFriendRequest, etc.]

// ✅ FIXED: Navigation functions
window.goToHome = function() {
    window.location.href = '/pages/home/index.html';
};

window.viewFriendsPage = function() {
    window.location.href = 'friends/index.html';
};

// Make all functions available globally
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.openSettings = openSettings;
window.logout = window.logout;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);
