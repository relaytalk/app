// Login Page Script - Clean Version
console.log("✨ Luster Login Page Loaded");

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const loginBtn = document.getElementById('loginBtn');
const successMessage = document.getElementById('successMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');

// Toggle password visibility
passwordToggle.addEventListener('click', function() {
    if (loginPassword.type === 'password') {
        loginPassword.type = 'text';
        this.textContent = '🙈';
        this.title = 'Hide password';
    } else {
        loginPassword.type = 'password';
        this.textContent = '👁️';
        this.title = 'Show password';
    }
});

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 500);
}

// Hide error message
function hideError(element) {
    element.style.display = 'none';
}

// Show loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Validate login inputs
function validateLogin() {
    let isValid = true;
    
    // Validate username
    if (!loginUsername.value.trim() || loginUsername.value.length < 3) {
        showError(usernameError, 'Username must be at least 3 characters');
        isValid = false;
    } else {
        hideError(usernameError);
    }
    
    // Validate password
    if (!loginPassword.value || loginPassword.value.length < 6) {
        showError(passwordError, 'Password must be at least 6 characters');
        isValid = false;
    } else {
        hideError(passwordError);
    }
    
    return isValid;
}

// Check if user exists in localStorage
function findUser(username) {
    // Get all users from localStorage
    const allUsers = JSON.parse(localStorage.getItem('luster_all_users') || '[]');
    return allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
}

// Authenticate user
async function authenticateUser(username, password) {
    showLoading();
    
    // Simulate API call delay
    return new Promise(resolve => {
        setTimeout(() => {
            const user = findUser(username);
            
            if (!user) {
                hideLoading();
                resolve({
                    success: false,
                    error: 'User not found. Please check your username.'
                });
                return;
            }
            
            // For demo: Check if there's a logged-in user with matching username
            const currentUser = JSON.parse(localStorage.getItem('luster_user') || 'null');
            
            if (currentUser && currentUser.username.toLowerCase() === username.toLowerCase()) {
                // In real app, we would verify password hash from Supabase
                // For now, we accept any password for demo
                hideLoading();
                resolve({
                    success: true,
                    user: currentUser,
                    message: 'Login successful!'
                });
            } else {
                hideLoading();
                resolve({
                    success: false,
                    error: 'Please create an account first.'
                });
            }
        }, 1500);
    });
}

// Show login success and redirect
function showLoginSuccess(user) {
    // Hide form
    loginForm.style.display = 'none';
    
    // Show success message
    successMessage.style.display = 'block';
    successMessage.innerHTML = `
        <h3 style="color: #28a745; margin-bottom: 10px;">✅ Login Successful!</h3>
        <p style="color: #c0c0e0; margin-bottom: 15px;">
            Welcome back, <strong style="color: white;">${user.username}</strong>!
        </p>
        <p style="color: #a0a0c0; font-size: 0.9rem;">
            Redirecting to home page...
        </p>
        <div class="redirect-progress">
            <div class="redirect-progress-fill" id="redirectProgress"></div>
        </div>
    `;
    
    // Start progress bar and redirect
    let progress = 0;
    const progressFill = document.getElementById('redirectProgress');
    const interval = setInterval(() => {
        progress += 2;
        if (progressFill) progressFill.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            // Redirect to home page
            window.location.href = '../home/index.html';
        }
    }, 30);
}

// Handle form submission
async function handleLogin(event) {
    event.preventDefault();
    
    // Validate inputs
    if (!validateLogin()) {
        return;
    }
    
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    
    // Authenticate user
    const result = await authenticateUser(username, password);
    
    if (result.success) {
        showLoginSuccess(result.user);
    } else {
        showError(passwordError, result.error || 'Login failed. Please try again.');
    }
}

// Initialize login page
function initLoginPage() {
    console.log("✨ Luster Login Page Initialized");
    
    // Check if user is already logged in
    const currentUser = JSON.parse(localStorage.getItem('luster_user') || 'null');
    if (currentUser) {
        // User is already logged in, redirect to home
        setTimeout(() => {
            window.location.href = '../home/index.html';
        }, 1000);
    }
    
    // Event listeners
    loginForm.addEventListener('submit', handleLogin);
    
    // Real-time validation
    loginUsername.addEventListener('input', function() {
        if (this.value.trim()) {
            hideError(usernameError);
        }
    });
    
    loginPassword.addEventListener('input', function() {
        if (this.value) {
            hideError(passwordError);
        }
    });
    
    // Check "Remember me" functionality
    const rememberMe = document.getElementById('rememberMe');
    const savedUsername = localStorage.getItem('luster_remember_username');
    
    if (savedUsername && rememberMe.checked) {
        loginUsername.value = savedUsername;
    }
    
    rememberMe.addEventListener('change', function() {
        if (this.checked && loginUsername.value.trim()) {
            localStorage.setItem('luster_remember_username', loginUsername.value.trim());
        } else {
            localStorage.removeItem('luster_remember_username');
        }
    });
}

// Run when page loads
document.addEventListener('DOMContentLoaded', initLoginPage);