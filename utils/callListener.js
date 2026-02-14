// utils/callListener.js - FINAL PRODUCTION VERSION WITH FIXES

import { initializeSupabase } from './supabase.js';

let supabase = null;
let currentUser = null;
let callSubscription = null;
let audioPlayer = null;

// Initialize call listener
export async function initCallListener() {
    console.log('📞 Initializing call listener...');

    try {
        supabase = await initializeSupabase();

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.log('No session found');
            return;
        }

        currentUser = session.user;
        console.log('📞 Call listener initialized for:', currentUser.email);

        setupRingtone();
        setupIncomingCallListener();

    } catch (error) {
        console.error('Call listener error:', error);
    }
}

// Setup ringtone - FIXED with actual ringtone sound
function setupRingtone() {
    try {
        // Create a simple beep using Web Audio API (more reliable)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const audioCtx = new AudioContext();
            
            // Create a function to play ringtone
            audioPlayer = {
                play: function() {
                    // Resume audio context if suspended
                    if (audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }
                    
                    // Create oscillator for ringtone
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();
                    
                    oscillator.type = 'sine';
                    oscillator.frequency.value = 440; // A note
                    
                    gainNode.gain.value = 0.1;
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    
                    oscillator.start();
                    
                    // Stop after 1 second
                    setTimeout(() => {
                        oscillator.stop();
                    }, 1000);
                    
                    // Repeat every 3 seconds
                    this.interval = setInterval(() => {
                        if (audioCtx.state === 'suspended') {
                            audioCtx.resume();
                        }
                        
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        
                        osc.type = 'sine';
                        osc.frequency.value = 440;
                        gain.gain.value = 0.1;
                        
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        
                        osc.start();
                        
                        setTimeout(() => {
                            osc.stop();
                        }, 1000);
                    }, 3000);
                },
                pause: function() {
                    if (this.interval) {
                        clearInterval(this.interval);
                    }
                }
            };
        } else {
            // Fallback - no sound
            audioPlayer = { play: () => {}, pause: () => {} };
        }
    } catch (e) {
        console.log('Ringtone setup failed:', e);
        audioPlayer = { play: () => {}, pause: () => {} };
    }
}

// Play ringtone
function playRingtone() {
    if (audioPlayer && audioPlayer.play) {
        audioPlayer.play();
    }
}

// Stop ringtone
function stopRingtone() {
    if (audioPlayer && audioPlayer.pause) {
        audioPlayer.pause();
    }
}

// Setup incoming call listener
function setupIncomingCallListener() {
    // Clean up existing subscription
    if (callSubscription) {
        callSubscription.unsubscribe();
    }

    callSubscription = supabase
        .channel('incoming-calls')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 Incoming call detected!', payload);
            
            // Only show if status is 'ringing'
            if (payload.new.status === 'ringing') {
                handleIncomingCall(payload.new);
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('📞 Call updated:', payload);
            
            // If call is no longer ringing, hide notification
            if (payload.new.status !== 'ringing') {
                hideIncomingCallNotification();
                stopRingtone();
            }
        })
        .subscribe((status) => {
            console.log('Call listener subscription status:', status);
        });
}

// Handle incoming call
async function handleIncomingCall(call) {
    // Don't show if already on call page
    if (window.location.pathname.includes('/call/')) {
        return;
    }

    // Get caller info
    const caller = await getCallerInfo(call.caller_id);
    
    // Show notification
    showIncomingCallNotification(call, caller);
    
    // Play ringtone
    playRingtone();

    // Store in sessionStorage as backup
    sessionStorage.setItem('incomingCall', JSON.stringify({
        id: call.id,
        roomName: call.room_name,
        callerId: call.caller_id,
        callerName: caller?.username || 'Unknown'
    }));
}

// Get caller info
async function getCallerInfo(callerId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();
        
        if (error) throw error;
        return data || { username: 'Unknown', avatar_url: null };
    } catch (error) {
        console.error('Error getting caller info:', error);
        return { username: 'Unknown', avatar_url: null };
    }
}

// Show incoming call notification - FIXED with working buttons
function showIncomingCallNotification(call, caller) {
    // Remove any existing notification
    hideIncomingCallNotification();

    const notification = document.createElement('div');
    notification.id = 'incomingCallNotification';
    notification.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #1a1a1a, #000);
        color: white;
        padding: 16px 20px;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 3px solid #007acc;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Add animation style if not exists
    if (!document.getElementById('callAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'callAnimationStyle';
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateY(-100%); }
                to { transform: translateY(0); }
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    const avatarHtml = caller?.avatar_url 
        ? `<img src="${caller.avatar_url}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #007acc;">`
        : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #007acc; display: flex; align-items: center; justify-content: center; font-size: 24px;">
            <i class="fas fa-phone"></i>
           </div>`;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
            ${avatarHtml}
            <div>
                <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">${caller?.username || 'Incoming Call'}</div>
                <div style="color: #999; font-size: 0.9rem;">🔊 Incoming voice call...</div>
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="acceptCallBtn" style="background: #28a745; border: none; color: white; width: 48px; height: 48px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;">
                <i class="fas fa-phone-alt"></i>
            </button>
            <button id="declineCallBtn" style="background: #dc3545; border: none; color: white; width: 48px; height: 48px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-phone-slash"></i>
            </button>
        </div>
    `;

    document.body.prepend(notification);

    // Add event listeners
    document.getElementById('acceptCallBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        stopRingtone();
        hideIncomingCallNotification();

        // Update call status to active
        await supabase
            .from('calls')
            .update({ 
                status: 'active', 
                answered_at: new Date().toISOString() 
            })
            .eq('id', call.id);

        // Navigate to call page
        window.location.href = `/pages/call/index.html?incoming=true&room=${call.room_name}&callerId=${call.caller_id}&callId=${call.id}`;
    });

    document.getElementById('declineCallBtn').addEventListener('click', async (e) => {
        e.stopPropagation();
        stopRingtone();
        hideIncomingCallNotification();

        // Update call status to rejected
        await supabase
            .from('calls')
            .update({ 
                status: 'rejected', 
                ended_at: new Date().toISOString() 
            })
            .eq('id', call.id);

        sessionStorage.removeItem('incomingCall');
    });

    // Auto-hide after 45 seconds if no answer
    setTimeout(() => {
        if (document.getElementById('incomingCallNotification')) {
            stopRingtone();
            hideIncomingCallNotification();
            
            // Update status to missed if still ringing
            supabase
                .from('calls')
                .update({ 
                    status: 'missed', 
                    ended_at: new Date().toISOString() 
                })
                .eq('id', call.id)
                .eq('status', 'ringing');
        }
    }, 45000);
}

// Hide notification
function hideIncomingCallNotification() {
    const existing = document.getElementById('incomingCallNotification');
    if (existing) existing.remove();
}

// Check for existing ringing calls on page load
export async function checkExistingCalls() {
    try {
        const { data: calls, error } = await supabase
            .from('calls')
            .select('*, caller:caller_id(username, avatar_url)')
            .eq('receiver_id', currentUser.id)
            .eq('status', 'ringing')
            .gt('created_at', new Date(Date.now() - 60000).toISOString()) // Last 60 seconds
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (calls && calls.length > 0) {
            console.log('Found existing ringing call:', calls[0]);
            handleIncomingCall(calls[0]);
        }
    } catch (error) {
        console.error('Error checking existing calls:', error);
    }
}

// Clean up
export function cleanupCallListener() {
    stopRingtone();
    if (callSubscription) {
        callSubscription.unsubscribe();
        callSubscription = null;
    }
    hideIncomingCallNotification();
}

// Auto-initialize on every page except call page
if (!window.location.pathname.includes('/call/')) {
    document.addEventListener('DOMContentLoaded', () => {
        initCallListener();
    });
}