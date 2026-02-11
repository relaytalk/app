// profile.js - Simple Profile with IMGBB Avatar Upload

import { initializeSupabase, supabase as supabaseClient } from '../../../utils/supabase.js';

// IMGBB API Key - GET YOUR OWN FROM https://api.imgbb.com
const IMGBB_API_KEY = '82e49b432e2ee14921f7d0cd81ba5551'; // 🔴 REPLACE WITH YOUR KEY

let supabase = null;
let currentUser = null;
let currentProfile = null;

// Initialize
async function initProfilePage() {
    console.log('Loading profile...');
    
    try {
        supabase = await initializeSupabase();
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (!session) {
            window.location.href = '../../index.html';
            return;
        }
        
        currentUser = session.user;
        
        // Load profile
        await loadProfile();
        
        // Hide loader
        document.getElementById('loadingIndicator').style.display = 'none';
        
    } catch (error) {
        console.error('Init error:', error);
        showToast('error', 'Failed to load profile');
    }
}

// Load profile data
async function loadProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
            
        if (error) throw error;
        
        currentProfile = profile;
        renderProfile(profile);
        
    } catch (error) {
        console.error('Profile load error:', error);
    }
}

// Render profile
function renderProfile(profile) {
    // Set username
    document.getElementById('displayName').textContent = profile.username || 'User';
    document.getElementById('displayUsername').textContent = `@${profile.username || 'user'}`;
    
    // Set bio
    if (profile.bio) {
        document.getElementById('displayBio').textContent = profile.bio;
    }
    
    // Set avatar
    const avatarContainer = document.getElementById('profileAvatar');
    const initialDiv = document.getElementById('avatarInitial');
    const img = document.getElementById('avatarImage');
    
    if (profile.avatar_url) {
        // Show uploaded image
        img.src = profile.avatar_url;
        img.style.display = 'block';
        initialDiv.style.display = 'none';
    } else {
        // Show initials
        img.style.display = 'none';
        initialDiv.style.display = 'flex';
        initialDiv.textContent = profile.username ? profile.username.charAt(0).toUpperCase() : '?';
    }
    
    // Load stats
    loadUserStats();
}

// Load friends and messages count
async function loadUserStats() {
    try {
        // Friends count
        const { count: friendsCount } = await supabase
            .from('friends')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);
            
        document.getElementById('friendsCount').textContent = friendsCount || 0;
        
        // Messages count (sent + received)
        const { count: sentCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', currentUser.id);
            
        const { count: receivedCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id);
            
        document.getElementById('messagesCount').textContent = (sentCount || 0) + (receivedCount || 0);
        
    } catch (error) {
        console.error('Stats error:', error);
    }
}

// Open image picker modal
window.openImagePicker = function() {
    document.getElementById('imagePickerModal').style.display = 'flex';
};

// Close modal
window.closeModal = function() {
    document.getElementById('imagePickerModal').style.display = 'none';
};

// Upload from camera
window.uploadFromCamera = function() {
    const input = document.getElementById('cameraInput');
    input.accept = 'image/*';
    input.capture = 'environment';
    input.click();
    closeModal();
};

// Upload from gallery
window.uploadFromGallery = function() {
    const input = document.getElementById('galleryInput');
    input.accept = 'image/*';
    input.click();
    closeModal();
};

// Handle file selection
window.handleImageSelect = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show loading
    document.getElementById('uploadLoading').style.display = 'flex';
    
    try {
        // 1. Upload to IMGBB
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', file);
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Upload failed');
        }
        
        const imageUrl = data.data.url;
        
        // 2. Save URL to Supabase profiles table
        const { error } = await supabase
            .from('profiles')
            .update({ 
                avatar_url: imageUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
            
        if (error) throw error;
        
        // 3. Update UI
        const avatarContainer = document.getElementById('profileAvatar');
        const initialDiv = document.getElementById('avatarInitial');
        const img = document.getElementById('avatarImage');
        
        img.src = imageUrl;
        img.style.display = 'block';
        initialDiv.style.display = 'none';
        
        showToast('success', 'Profile photo updated!');
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('error', 'Failed to upload image');
    } finally {
        // Hide loading
        document.getElementById('uploadLoading').style.display = 'none';
        event.target.value = ''; // Reset input
    }
};

// Remove avatar
window.removeAvatar = async function() {
    if (!confirm('Remove profile photo?')) return;
    
    document.getElementById('uploadLoading').style.display = 'flex';
    
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ 
                avatar_url: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
            
        if (error) throw error;
        
        // Update UI
        const img = document.getElementById('avatarImage');
        const initialDiv = document.getElementById('avatarInitial');
        
        img.style.display = 'none';
        initialDiv.style.display = 'flex';
        initialDiv.textContent = currentProfile.username ? currentProfile.username.charAt(0).toUpperCase() : '?';
        
        showToast('success', 'Profile photo removed');
        
    } catch (error) {
        console.error('Remove error:', error);
        showToast('error', 'Failed to remove photo');
    } finally {
        document.getElementById('uploadLoading').style.display = 'none';
        closeModal();
    }
};

// Show toast
function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    const color = type === 'success' ? '#28a745' : '#dc3545';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}" style="color: ${color}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Navigation
window.goToHome = () => window.location.href = 'home/index.html';
window.goToFriends = () => window.location.href = '../friends/index.html';
window.logout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '../../index.html';
};

// Initialize
document.addEventListener('DOMContentLoaded', initProfilePage);
