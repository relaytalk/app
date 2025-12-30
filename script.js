// Main app script
console.log("✨ Luster App Loading...");

// Navigation functions
function goToSignup() {
    // Check if we have folders
    if (folderStructure === 'with-folders') {
        window.location.href = 'pages/auth/index.html';
    } else {
        window.location.href = 'auth.html';
    }
}

function goToLogin() {
    alert("For now, just click Create Account. We'll add login later!");
}

// Check for existing user
function checkExistingUser() {
    const user = localStorage.getItem('luster_user');
    if (user) {
        // User exists, maybe redirect to home
        console.log("User found:", JSON.parse(user).username);
        return true;
    }
    return false;
}

// Initialize app
function initApp() {
    console.log("App initialized!");
    
    // Check for user
    const hasUser = checkExistingUser();
    
    // If user exists and we're on home page, maybe show different UI
    if (hasUser && window.location.pathname.includes('index.html')) {
        // Could show "Welcome back" message
        setTimeout(() => {
            const title = document.querySelector('.title');
            if (title) {
                const user = JSON.parse(localStorage.getItem('luster_user'));
                title.innerHTML = `Welcome back, <span style="color:#667eea">${user.username}</span>!`;
            }
        }, 4000);
    }
    
    // Add click effects to buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// Wait for opening animation to complete
setTimeout(() => {
    initApp();
}, 3500); // Wait 3.5 seconds for opening animation

// Make functions available globally
window.LusterApp = {
    goToSignup,
    goToLogin,
    checkExistingUser
};