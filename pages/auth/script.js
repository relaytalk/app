// ====== SIMPLE CREATE ACCOUNT SCRIPT ======
console.log("✨ Luster Create Account Page Loaded");

// Toggle password
function togglePassword() {
    const pw = document.getElementById('password');
    const btn = document.querySelector('.password-toggle');
    if (pw && btn) {
        pw.type = pw.type === 'password' ? 'text' : 'password';
        btn.textContent = pw.type === 'password' ? '👁️' : '🙈';
    }
}

// Create account - SIMPLE VERSION
async function handleSignup(event) {
    event.preventDefault();
    console.log("🔍 Form submitted!");
    
    const username = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value;
    
    if (!username || !password) {
        alert("Please fill all fields");
        return;
    }
    
    // Show loading
    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Creating...';
    btn.disabled = true;
    
    try {
        // 1. Connect to Supabase
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        const supabase = createClient(
            'https://blxtldgnssvasuinpyit.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'
        );
        
        // 2. Create email
        const email = `${username}@luster.test`;
        console.log("Creating:", email);
        
        // 3. Sign up
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { username: username } }
        });
        
        if (error) throw error;
        
        // 4. Create profile
        await supabase.from('profiles').insert({
            id: data.user.id,
            username: username,
            avatar_url: `https://ui-avatars.com/api/?name=${username}&background=random`
        });
        
        // 5. Auto-login
        await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        // 6. Success
        alert("✅ Account created! Redirecting...");
        window.location.href = '../home/index.html';
        
    } catch (error) {
        console.error("❌ Error:", error);
        alert("Error: " + error.message);
        btn.textContent = 'Create Account';
        btn.disabled = false;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Page loaded");
    
    // Form submit
    const form = document.getElementById('signupForm');
    if (form) {
        form.addEventListener('submit', handleSignup);
        console.log("✅ Form event listener added");
    }
    
    // Eye toggle
    const eyeBtn = document.querySelector('.password-toggle');
    if (eyeBtn) {
        eyeBtn.addEventListener('click', togglePassword);
        console.log("✅ Eye button listener added");
    }
});

// Make functions global
window.togglePassword = togglePassword;
window.handleSignup = handleSignup;