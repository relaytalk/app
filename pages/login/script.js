// ====================
// DOM ELEMENTS
// ====================
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const loginBtn = document.getElementById('loginBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const successMessage = document.getElementById('successMessage');
const rememberMe = document.getElementById('rememberMe');

// ====================
// GLOBAL VARIABLES
// ====================
let isSubmitting = false;

// ====================
// PASSWORD TOGGLE
// ====================
passwordToggle.addEventListener('click', function() {
    const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    loginPassword.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁️' : '🙈';
});

// ====================
// FORM VALIDATION
// ====================
function validateForm() {
    let isValid = true;
    
    // Clear previous errors
    clearErrors();
    
    // Username validation
    if (!loginUsername.value.trim()) {
        showError('usernameError', 'Username is required');
        isValid = false;
    } else if (loginUsername.value.trim().length < 3) {
        showError('usernameError', 'Username must be at least 3 characters');
        isValid = false;
    } else if (loginUsername.value.trim().length > 20) {
        showError('usernameError', 'Username cannot exceed 20 characters');
        isValid = false;
    }
    
    // Password validation
    if (!loginPassword.value) {
        showError('passwordError', 'Password is required');
        isValid = false;
    } else if (loginPassword.value.length < 6) {
        showError('passwordError', 'Password must be at least 6 characters');
        isValid = false;
    }
    
    return isValid;
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearErrors() {
    document.getElementById('usernameError').textContent = '';
    document.getElementById('passwordError').textContent = '';
}

// ====================
// FORM SUBMISSION
// ====================
loginForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    if (isSubmitting) return;
    
    if (!validateForm()) {
        return;
    }
    
    isSubmitting = true;
    showLoading(true);
    
    try {
        // Get credentials
        const username = loginUsername.value.trim();
        const password = loginPassword.value;
        
        // Check if remember me is checked
        if (rememberMe.checked) {
            localStorage.setItem('rememberedUsername', username);
        } else {
            localStorage.removeItem('rememberedUsername');
        }
        
        // Simulate API call (replace with actual authentication)
        await simulateLogin(username, password);
        
        // Show success message
        showSuccess('Login successful! Redirecting...');
        
        // Redirect to home page after delay
        setTimeout(() => {
            window.location.href = '../../pages/home/index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showError('passwordError', error.message || 'Login failed. Please check your credentials.');
        showLoading(false);
        isSubmitting = false;
    }
});

// ====================
// SIMULATE LOGIN (Replace with actual authentication)
// ====================
async function simulateLogin(username, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate authentication logic
            // In a real app, this would be an API call to your backend
            
            // Check if user exists in localStorage (for demo purposes)
            const users = JSON.parse(localStorage.getItem('relaytalk_users') || '[]');
            const user = users.find(u => u.username === username && u.password === password);
            
            if (user) {
                // Store current user session
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                resolve(user);
            } else {
                reject(new Error('Invalid username or password'));
            }
        }, 1000); // Simulate network delay
    });
}

// ====================
// UI HELPERS
// ====================
function showLoading(show) {
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    if (loginBtn) {
        loginBtn.disabled = show;
        loginBtn.innerHTML = show ? 
            '<div class="typing-dots"><div></div><div></div><div></div></div>' : 
            'Sign In to RelayTalk';
    }
}

function showSuccess(message) {
    if (successMessage) {
        successMessage.innerHTML = `
            <div class="success-icon">✅</div>
            <div class="success-text">${message}</div>
        `;
        successMessage.style.display = 'flex';
    }
}

// ====================
// REMEMBER ME FUNCTIONALITY
// ====================
window.addEventListener('DOMContentLoaded', function() {
    // Check if username was remembered
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
        loginUsername.value = rememberedUsername;
        rememberMe.checked = true;
        loginPassword.focus();
    } else {
        loginUsername.focus();
    }
    
    // Auto-focus password field when username is filled
    loginUsername.addEventListener('input', function() {
        if (this.value.trim().length >= 3) {
            loginPassword.focus();
        }
    });
    
    // Enable/disable login button based on input
    function updateLoginButton() {
        const hasUsername = loginUsername.value.trim().length >= 3;
        const hasPassword = loginPassword.value.length >= 6;
        loginBtn.disabled = !(hasUsername && hasPassword);
    }
    
    loginUsername.addEventListener('input', updateLoginButton);
    loginPassword.addEventListener('input', updateLoginButton);
    
    // Initial button state
    updateLoginButton();
});

// ====================
// KEYBOARD SHORTCUTS
// ====================
document.addEventListener('keydown', function(event) {
    // Ctrl + Enter to submit form
    if (event.ctrlKey && event.key === 'Enter') {
        if (!isSubmitting) {
            loginForm.dispatchEvent(new Event('submit'));
        }
    }
    
    // Escape to clear form
    if (event.key === 'Escape') {
        if (!loginUsername.value && !loginPassword.value) {
            window.location.href = '../../index.html';
        } else {
            loginUsername.value = '';
            loginPassword.value = '';
            clearErrors();
            loginUsername.focus();
        }
    }
});

// ====================
// REAL-TIME VALIDATION
// ====================
loginUsername.addEventListener('blur', function() {
    if (this.value.trim()) {
        if (this.value.trim().length < 3) {
            showError('usernameError', 'Username must be at least 3 characters');
        } else if (this.value.trim().length > 20) {
            showError('usernameError', 'Username cannot exceed 20 characters');
        } else {
            clearErrors();
        }
    }
});

loginPassword.addEventListener('blur', function() {
    if (this.value && this.value.length < 6) {
        showError('passwordError', 'Password must be at least 6 characters');
    } else {
        clearErrors();
    }
});

// ====================
// ACCESSIBILITY
// ====================
loginForm.addEventListener('keydown', function(event) {
    // Allow form submission with Enter key only when form is valid
    if (event.key === 'Enter' && event.target.type !== 'textarea') {
        event.preventDefault();
        if (validateForm()) {
            loginForm.dispatchEvent(new Event('submit'));
        }
    }
});

// ====================
// NETWORK STATUS
// ====================
window.addEventListener('online', function() {
    console.log('Connection restored');
    // You could add a subtle notification here
});

window.addEventListener('offline', function() {
    console.log('Connection lost');
    showError('passwordError', 'You are offline. Please check your connection.');
});

// ====================
// INITIALIZATION
// ====================
console.log('Login page loaded successfully');