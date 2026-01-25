// login/script.js - COMPLETE WORKING VERSION
console.log('✨ Login Page Loaded');

// Load auth from window or use simple version
const auth = window.auth || {
    async signIn(username, password) {
        if (!window.supabase?.auth) {
            return { success: false, message: 'Connecting...' };
        }
        
        try {
            const email = `${username}@luster.test`;
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            return { success: true, user: data.user };
        } catch (error) {
            return { 
                success: false, 
                message: error.message.includes('Invalid') 
                    ? 'Invalid username or password' 
                    : 'Login failed'
            };
        }
    },
    
    async getCurrentUser() {
        if (!window.supabase?.auth) return { success: false };
        const { data } = await window.supabase.auth.getUser();
        return { success: !!data.user, user: data.user };
    }
};

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');

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

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function hideError(element) {
    element.style.display = 'none';
}

function validateLogin() {
    let isValid = true;
    if (!loginUsername.value.trim()) {
        showError(usernameError, 'Please enter username');
        isValid = false;
    } else {
        hideError(usernameError);
    }
    if (!loginPassword.value) {
        showError(passwordError, 'Please enter password');
        isValid = false;
    } else {
        hideError(passwordError);
    }
    return isValid;
}

async function handleLogin(event) {
    event.preventDefault();
    if (!validateLogin()) return;

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;

    try {
        const result = await auth.signIn(username, password);
        
        if (result.success) {
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

async function initLoginPage() {
    const { success } = await auth.getCurrentUser();
    if (success) {
        window.location.href = '../home/index.html';
        return;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (loginUsername) {
        loginUsername.addEventListener('input', function() {
            if (this.value.trim()) hideError(usernameError);
        });
    }

    if (loginPassword) {
        loginPassword.addEventListener('input', function() {
            if (this.value) hideError(passwordError);
        });
    }
}

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

document.addEventListener('DOMContentLoaded', initLoginPage);