// login/script.js - COMPLETE VERSION - FIXED FOR UMD

console.log('✨ Login Page Loaded');

// Wait for Supabase - now using global supabase from UMD
async function ensureSupabase() {
    console.log('⏳ Ensuring Supabase is loaded...');
    
    // Check if supabase is available globally from UMD
    if (typeof supabase !== 'undefined' && !window.supabase) {
        // Initialize Supabase client
        const SUPABASE_URL = 'https://blxtldgnssvasuinpyit.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw';
        
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase client created from UMD');
    }
    
    if (window.supabase) {
        console.log('✅ Supabase already loaded');
        return true;
    }
    
    // Fallback to module import if UMD failed
    try {
        console.log('⚠️ UMD not ready, trying module import...');
        const modulePath = '../../utils/supabase.js';
        await import(modulePath);
        
        let attempts = 0;
        while (!window.supabase && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 150));
            attempts++;
        }
        
        if (window.supabase) {
            console.log('✅ Supabase loaded via module');
            return true;
        }
    } catch (error) {
        console.error('❌ Error loading Supabase:', error);
    }
    
    return false;
}

// Simple login function
async function loginUser(username, password) {
    try {
        if (!window.supabase?.auth) {
            throw new Error('Authentication service not ready');
        }
        
        const email = `${username}@luster.test`;
        console.log('Logging in with:', email);
        
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('Login error:', error.message);
            
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Invalid username or password');
            }
            
            throw new Error('Login failed. Please try again.');
        }
        
        console.log('✅ Login successful!');
        console.log('User:', data.user.email);
        
        // Verify session is saved
        await window.supabase.auth.getSession();
        
        return {
            success: true,
            user: data.user
        };
        
    } catch (error) {
        console.error('Login failed:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Check if already logged in
async function checkExistingLogin() {
    try {
        if (!window.supabase?.auth) return false;
        
        const { data } = await window.supabase.auth.getSession();
        const isLoggedIn = !!data?.session;
        
        console.log('Existing login check:', isLoggedIn ? 'Logged in' : 'Not logged in');
        return isLoggedIn;
        
    } catch (error) {
        console.error('Login check error:', error);
        return false;
    }
}

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const passwordToggle = document.getElementById('passwordToggle');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');
const loadingOverlay = document.getElementById('loadingOverlay');

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

// Show error
function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.display = 'block';
    
    element.parentElement.classList.add('shake');
    setTimeout(() => {
        element.parentElement.classList.remove('shake');
    }, 500);
}

// Hide error
function hideError(element) {
    if (!element) return;
    element.style.display = 'none';
}

// Validate form
function validateForm() {
    let isValid = true;
    
    if (!loginUsername.value.trim()) {
        showError(usernameError, 'Please enter username');
        isValid = false;
    } else if (loginUsername.value.trim().length < 3) {
        showError(usernameError, 'Username must be at least 3 characters');
        isValid = false;
    } else {
        hideError(usernameError);
    }
    
    if (!loginPassword.value) {
        showError(passwordError, 'Please enter password');
        isValid = false;
    } else if (loginPassword.value.length < 6) {
        showError(passwordError, 'Password must be at least 6 characters');
        isValid = false;
    } else {
        hideError(passwordError);
    }
    
    return isValid;
}

// Handle form submission
async function handleLogin(event) {
    event.preventDefault();
    
    if (!validateForm()) return;
    
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;
    
    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    try {
        const supabaseReady = await ensureSupabase();
        if (!supabaseReady) {
            showError(passwordError, 'Cannot connect to server');
            resetButton(loginBtn, originalText);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            return;
        }
        
        const result = await loginUser(username, password);
        
        if (result.success) {
            console.log('✅ Login successful, redirecting to home...');
            
            const successMessage = document.getElementById('successMessage');
            if (successMessage) {
                successMessage.style.display = 'block';
                successMessage.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">🎉</div>
                        <h3 style="color: #28a745; margin-bottom: 10px;">Login Successful!</h3>
                        <p style="color: #c0c0e0;">Redirecting to home page...</p>
                    </div>
                `;
            }
            
            setTimeout(() => {
                window.location.href = '../home/index.html';
            }, 1500);
            
        } else {
            showError(passwordError, result.message || 'Login failed');
            resetButton(loginBtn, originalText);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Login handler error:', error);
        showError(passwordError, 'Something went wrong. Please try again.');
        resetButton(loginBtn, originalText);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

function resetButton(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
}

// Initialize login page
async function initLoginPage() {
    console.log('Initializing login page...');
    
    await ensureSupabase();
    
    const isLoggedIn = await checkExistingLogin();
    if (isLoggedIn) {
        console.log('✅ User already logged in, redirecting to home...');
        
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.style.display = 'block';
            successMessage.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">👋</div>
                    <h3 style="color: #667eea; margin-bottom: 10px;">Already Logged In!</h3>
                    <p style="color: #c0c0e0;">Redirecting to home page...</p>
                </div>
            `;
        }
        
        setTimeout(() => {
            window.location.href = '../home/index.html';
        }, 1000);
        return;
    }
    
    console.log('User not logged in, showing login form');
    
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
    
    if (loginUsername) {
        setTimeout(() => loginUsername.focus(), 300);
    }
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Global functions
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

// Initialize on load
document.addEventListener('DOMContentLoaded', initLoginPage);