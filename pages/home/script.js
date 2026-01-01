// Home Page Script - FIXED CORE FUNCTIONALITY
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Home Page Loaded");

let currentUser = null;
let currentProfile = null;
let requestsChannel = null;

// ====== FIX 1: Define functions BEFORE they're called ======
function goToHome() {
    console.log("Already on home page");
}

function openSettings() {
    alert("Settings page coming soon!");
}

function openSearch() {
    console.log("Opening search modal");
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Clear search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        
        loadSearchResults();
        
        // Close on outside click
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC key to close
        document.addEventListener('keydown', handleEscKey);
    }
}

function openNotifications() {
    console.log("Opening notifications modal");
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadNotifications();
        
        // Close on outside click
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // ESC key to close
        document.addEventListener('keydown', handleEscKey);
    }
}

function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
}

function closeModal() {
    console.log("Closing modal");
    const searchModal = document.getElementById('searchModal');
    const notificationsModal = document.getElementById('notificationsModal');

    if (searchModal) {
        searchModal.style.display = 'none';
        searchModal.onclick = null;
    }
    if (notificationsModal) {
        notificationsModal.style.display = 'none';
        notificationsModal.onclick = null;
    }
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleEscKey);
}

// ====== FIX 2: Attach to window IMMEDIATELY ======
window.openSearch = openSearch;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.goToHome = goToHome;
window.openSettings = openSettings;

// ====== NOW the rest of your code ======
// Initialize home page - FIXED: Better error handling
async function initHomePage() {
    console.log("Initializing home page...");

    // Show loading indicator
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    try {
        // Check if user is logged in - WITH RETRY
        let authCheckAttempts = 0;
        let authSuccess = false;
        let user = null;
        
        while (authCheckAttempts < 3 && !authSuccess) {
            authCheckAttempts++;
            
            try {
                const { success, user: authUser, error } = await auth.getCurrentUser();
                
                if (success && authUser) {
                    authSuccess = true;
                    user = authUser;
                    console.log("✅ Auth successful on attempt", authCheckAttempts);
                } else if (error) {
                    console.log("Auth attempt", authCheckAttempts, "failed:", error.message);
                    
                    // Wait a bit before retrying
                    if (authCheckAttempts < 3) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } catch (authError) {
                console.log("Auth error on attempt", authCheckAttempts, ":", authError.message);
            }
        }

        if (!authSuccess || !user) {
            console.error("❌ Could not authenticate after 3 attempts");
            
            // Check if there's a session in localStorage/sessionStorage as fallback
            const storedUser = localStorage.getItem('supabase.auth.token') || 
                              sessionStorage.getItem('supabase.auth.token');
            
            if (!storedUser) {
                alert("Please login first!");
                window.location.href = '../auth/index.html';
                return;
            } else {
                console.log("Found stored auth token, but auth.getCurrentUser() failed");
                // Try one more time with delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { success: finalAttempt, user: finalUser } = await auth.getCurrentUser();
                
                if (!finalAttempt || !finalUser) {
                    alert("Session expired. Please login again!");
                    window.location.href = '../auth/index.html';
                    return;
                }
                
                user = finalUser;
            }
        }

        currentUser = user;  
        console.log("Logged in as:", currentUser.email);  

        // Get user profile  
        await loadUserProfile();  

        // Update UI  
        updateWelcomeMessage();  
        await loadFriends();  
        await updateNotificationsBadge();  

        // Setup realtime for new friend requests
        setupRealtime();

        // Set up event listeners  
        setupEventListeners();  

        console.log("Home page initialized for:", currentProfile?.username);

    } catch (error) {
        console.error("❌ Critical init error:", error);
        alert("Error loading home page: " + error.message);
        
        // Try to redirect to auth page
        setTimeout(() => {
            window.location.href = '../auth/index.html';
        }, 2000);
        
        return;
    } finally {
        // Always hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 300);
        }
    }
}

// [REST OF THE CODE REMAINS EXACTLY THE SAME AS BEFORE...]
// Load user profile, loadFriends, etc. - all the same functions
// ... 

// ====== FIX 3: Attach remaining functions to window ======
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);