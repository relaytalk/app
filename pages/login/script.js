// Login Page Script - CLEAN WORKING VERSION
import { auth } from '../../utils/auth.js'

console.log("✨ Luster Login Page Loaded");

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');

// Toggle password visibility
if (passwordToggle) {
    passwordToggle.addEventListener('click', function() {
        if (loginPassword.type === 'password') {
            loginPassword.type = 'text';
            this.textContent = '🙈';
        } else {
            loginPassword.type = 'password';
            this.textContent = '👁️';
        }
    });
}

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

// Hide error message
function hideError(element) {
    element.style.display = 'none';
}

// SIMPLE VALIDATION - Just check if fields are not empty
function validateLogin() {
    let isValid = true;

    // Username - just check if not empty
    if (!loginUsername.value.trim()) {
        showError(usernameError, 'Please enter username');
        isValid = false;
    } else {
        hideError(usernameError);
    }

    // Password - just check if not empty
    if (!loginPassword.value) {
        showError(passwordError, 'Please enter password');
        isValid = false;
    } else {
        hideError(passwordError);
    }

    return isValid;
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

    // Show loading state
    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;

    try {
        // Use Supabase auth
        const result = await auth.signIn(username, password);

        if (result.success) {
            // Redirect to home page
            window.location.href = '../home/index.html';
        } else {
            showError(passwordError, result.message || 'Invalid username or password');
            loginBtn.textContent = originalText;
            loginBtn.disabled = false;
        }

    } catch (error) {
        showError(passwordError, 'Login failed. Please try again.');
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

// Initialize login page
async function initLoginPage() {
    // Check if user is already logged in
    const { success } = await auth.getCurrentUser();
    if (success) {
        window.location.href = '../home/index.html';
        return;
    }

    // Event listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Clear errors when user types
    if (loginUsername) {
        loginUsername.addEventListener('input', function() {
            if (this.value.trim()) {
                hideError(usernameError);
            }
        });
    }

    if (loginPassword) {
        loginPassword.addEventListener('input', function() {
            if (this.value) {
                hideError(passwordError);
            }
        });
    }
}

// Make functions available to HTML
window.togglePassword = function() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleBtn = document.querySelector('#passwordToggle');

    if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
        }
    }
};

window.handleLogin = handleLogin;

// Run when page loads
document.addEventListener('DOMContentLoaded', initLoginPage);