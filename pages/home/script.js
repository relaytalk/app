// Home Page Script - FIXED CORE FUNCTIONALITY
import { auth } from '../../utils/auth.js'
import { supabase } from '../../utils/supabase.js'

console.log("✨ Home Page Loaded");

let currentUser = null;
let currentProfile = null;
let requestsChannel = null;

// ====== FIX: ADD MISSING FUNCTION FIRST ======
function goToHome() {
    console.log("Already on home page");
    // No action needed - we're already on home page
}

// Now the rest of your code continues...
// Initialize home page
async function initHomePage() {
    console.log("Initializing home page...");

    // Check if user is logged in  
    const { success, user } = await auth.getCurrentUser();  

    if (!success || !user) {  
        alert("Please login first!");  
        window.location.href = '../auth/index.html';  
        return;  
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

    // Hide loading indicator
    setTimeout(() => {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
            }, 300);
        }
    }, 100);
}

// ... [rest of your existing code remains exactly the same] ...

// Remove the duplicate goToHome function at the bottom
// Navigation functions - REMOVE THIS DUPLICATE
// function goToHome() {
//     console.log("Already on home page");
// }

function openSettings() {
    alert("Settings page coming soon!");
}

// Make functions available globally
window.openSearch = openSearch;
window.openNotifications = openNotifications;
window.closeModal = closeModal;
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.goToHome = goToHome;  // This now references the function defined at top
window.openSettings = openSettings;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initHomePage);