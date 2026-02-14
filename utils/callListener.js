// utils/callListener.js - FORCED VISUAL TEST VERSION

import { initializeSupabase, supabase as supabaseClient } from './supabase.js';

let supabase = null;
let currentUser = null;
let callSubscription = null;

// Initialize call listener
export async function initCallListener() {
    console.log('🔍 DEBUG: initCallListener STARTED');
    
    try {
        supabase = await initializeSupabase();
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            console.log('No session found');
            return;
        }
        
        currentUser = session.user;
        console.log('📞 Call listener initialized for:', currentUser.email);
        
        // SHOW TEST NOTIFICATION AFTER 5 SECONDS (to verify visual works)
        setTimeout(() => {
            showTestNotification();
        }, 5000);
        
        // Setup listener
        setupIncomingCallListener();
        
    } catch (error) {
        console.error('Call listener error:', error);
    }
}

// TEST FUNCTION - Shows a fake incoming call
function showTestNotification() {
    console.log('🔍 DEBUG: Showing TEST notification');
    
    const testCall = {
        id: 'test-call-id',
        room_name: 'test-room',
        caller_id: currentUser?.id || 'test-caller',
        receiver_id: currentUser?.id
    };
    
    const testCaller = {
        username: 'TEST CALLER',
        avatar_url: null
    };
    
    showIncomingCallNotification(testCall, testCaller);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        hideIncomingCallNotification();
    }, 10000);
}

// Setup incoming call listener
function setupIncomingCallListener() {
    console.log('Setting up call listener for user:', currentUser.id);
    
    callSubscription = supabase
        .channel('incoming-calls')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 INCOMING CALL DETECTED!', payload.new);
            
            // Get caller info
            getCallerInfo(payload.new.caller_id).then(caller => {
                // FORCE SHOW NOTIFICATION
                showIncomingCallNotification(payload.new, caller);
                
                // Play simple beep
                try {
                    const audio = new Audio();
                    audio.src = 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAA8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PA==';
                    audio.loop = true;
                    audio.volume = 0.5;
                    audio.play().catch(e => console.log('Audio error:', e));
                    
                    // Store audio to stop later
                    window.currentRingtone = audio;
                } catch (e) {}
            });
        })
        .subscribe((status) => {
            console.log('Call listener status:', status);
        });
}

// Get caller info
async function getCallerInfo(callerId) {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();
        return data;
    } catch (error) {
        return { username: 'Unknown', avatar_url: null };
    }
}

// Show incoming call notification
function showIncomingCallNotification(call, caller) {
    console.log('🔍 DEBUG: showIncomingCallNotification CALLED');
    
    // Remove existing notification
    hideIncomingCallNotification();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'incomingCallNotification';
    
    // VERY VISIBLE STYLES
    notification.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        background: red !important;
        color: white !important;
        padding: 30px !important;
        z-index: 999999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        border-bottom: 5px solid yellow !important;
        font-size: 20px !important;
        font-weight: bold !important;
        font-family: Arial, sans-serif !important;
        box-shadow: 0 10px 30px black !important;
        min-height: 120px !important;
    `;
    
    const username = caller?.username || 'Unknown';
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px; flex: 1;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: yellow; display: flex; align-items: center; justify-content: center; font-size: 30px;">📞</div>
            <div>
                <div style="font-size: 24px; margin-bottom: 5px;">${username}</div>
                <div style="color: yellow;">🔊 Incoming call...</div>
                <div style="font-size: 14px; color: #ccc; margin-top: 5px;">Call ID: ${call.id}</div>
            </div>
        </div>
        <div style="display: flex; gap: 20px;">
            <button id="acceptCallBtn" style="background: green !important; color: white !important; border: none !important; width: 70px !important; height: 70px !important; border-radius: 50% !important; font-size: 30px !important; cursor: pointer !important;">
                ✅
            </button>
            <button id="declineCallBtn" style="background: darkred !important; color: white !important; border: none !important; width: 70px !important; height: 70px !important; border-radius: 50% !important; font-size: 30px !important; cursor: pointer !important;">
                ❌
            </button>
        </div>
    `;
    
    document.body.prepend(notification);
    
    console.log('🔍 DEBUG: Notification added to DOM');
    
    // Add event listeners
    document.getElementById('acceptCallBtn').addEventListener('click', () => {
        console.log('Accept clicked');
        if (window.currentRingtone) {
            window.currentRingtone.pause();
        }
        hideIncomingCallNotification();
        alert('Accepting call...');
    });
    
    document.getElementById('declineCallBtn').addEventListener('click', () => {
        console.log('Decline clicked');
        if (window.currentRingtone) {
            window.currentRingtone.pause();
        }
        hideIncomingCallNotification();
        alert('Call rejected');
    });
}

// Hide incoming call notification
function hideIncomingCallNotification() {
    const existing = document.getElementById('incomingCallNotification');
    if (existing) {
        existing.remove();
        console.log('Notification removed');
    }
}

// Clean up
export function cleanupCallListener() {
    if (window.currentRingtone) {
        window.currentRingtone.pause();
    }
    if (callSubscription) {
        callSubscription.unsubscribe();
    }
    hideIncomingCallNotification();
}

// Auto-initialize
if (!window.location.pathname.includes('/call/')) {
    document.addEventListener('DOMContentLoaded', () => {
        initCallListener();
    });
}