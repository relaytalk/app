// utils/callListener.js - COMPLETE VERSION WITH VISUAL NOTIFICATION

import { initializeSupabase, supabase as supabaseClient } from './supabase.js';

let supabase = null;
let currentUser = null;
let callSubscription = null;
let audioPlayer = null;

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
        
        // Setup ringtone
        setupRingtone();
        
        // Setup listener
        setupIncomingCallListener();
        
    } catch (error) {
        console.error('Call listener error:', error);
    }
}

// Setup ringtone
function setupRingtone() {
    try {
        // Create a simple beep using Web Audio API
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.log('AudioContext not supported');
            return;
        }
        
        audioPlayer = {
            context: null,
            oscillator: null,
            gainNode: null,
            isPlaying: false,
            
            start: function() {
                if (this.isPlaying) return;
                
                try {
                    this.context = new AudioContext();
                    this.gainNode = this.context.createGain();
                    this.gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
                    this.gainNode.connect(this.context.destination);
                    
                    this.oscillator = this.context.createOscillator();
                    this.oscillator.type = 'sine';
                    this.oscillator.frequency.setValueAtTime(440, this.context.currentTime);
                    this.oscillator.connect(this.gainNode);
                    
                    // Create beep pattern
                    this.oscillator.start();
                    
                    // Create repeating pattern
                    this.pattern = setInterval(() => {
                        if (!this.context) return;
                        
                        // Beep on for 0.5s, off for 0.5s
                        this.gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
                        this.gainNode.gain.setValueAtTime(0, this.context.currentTime + 0.5);
                    }, 1000);
                    
                    this.isPlaying = true;
                    console.log('Ringtone started');
                } catch (e) {
                    console.log('Ringtone error:', e);
                }
            },
            
            stop: function() {
                if (this.pattern) clearInterval(this.pattern);
                if (this.oscillator) {
                    try {
                        this.oscillator.stop();
                        this.oscillator.disconnect();
                    } catch (e) {}
                }
                if (this.context) {
                    try {
                        this.context.close();
                    } catch (e) {}
                }
                this.isPlaying = false;
                console.log('Ringtone stopped');
            }
        };
        
        // Fallback to simple audio element
        const simpleAudio = new Audio();
        simpleAudio.loop = true;
        simpleAudio.volume = 0.5;
        simpleAudio.src = 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAA8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PA==';
        
        // Use simple audio as fallback
        if (!audioPlayer.start) {
            audioPlayer = simpleAudio;
        }
        
    } catch (e) {
        console.log('Ringtone setup failed:', e);
    }
}

// Play ringtone
function playRingtone() {
    if (audioPlayer) {
        if (audioPlayer.start) {
            audioPlayer.start();
        } else {
            audioPlayer.play().catch(e => console.log('Audio play failed:', e));
        }
    }
}

// Stop ringtone
function stopRingtone() {
    if (audioPlayer) {
        if (audioPlayer.stop) {
            audioPlayer.stop();
        } else {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }
    }
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
            handleIncomingCall(payload.new);
        })
        .subscribe((status) => {
            console.log('Call listener status:', status);
        });
}

// Handle incoming call
async function handleIncomingCall(call) {
    console.log('Processing incoming call:', call);
    
    // Don't show if already on call page
    if (window.location.pathname.includes('/call/')) {
        console.log('Already on call page, ignoring');
        return;
    }
    
    // Get caller info
    const caller = await getCallerInfo(call.caller_id);
    console.log('Caller info:', caller);
    
    // Show notification
    showIncomingCallNotification(call, caller);
    
    // Play ringtone
    playRingtone();
    
    // Store call info
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
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();
        return data;
    } catch (error) {
        console.error('Error getting caller info:', error);
        return null;
    }
}

// Show incoming call notification
function showIncomingCallNotification(call, caller) {
    console.log('Showing notification for call from:', caller?.username);
    
    // Remove existing notification
    hideIncomingCallNotification();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'incomingCallNotification';
    notification.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #1a1a1a, #000);
        color: white;
        padding: 20px;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid #007acc;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Add animation style
    const style = document.createElement('style');
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
    
    const avatar = caller?.avatar_url 
        ? `<img src="${caller.avatar_url}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #007acc;">`
        : `<div style="width: 50px; height: 50px; border-radius: 50%; background: #007acc; display: flex; align-items: center; justify-content: center; font-size: 24px;">📞</div>`;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
            ${avatar}
            <div>
                <div style="font-weight: bold; font-size: 1.2rem; margin-bottom: 4px;">${caller?.username || 'Incoming Call'}</div>
                <div style="color: #999; font-size: 0.9rem;">🔊 Incoming voice call...</div>
            </div>
        </div>
        <div style="display: flex; gap: 15px;">
            <button id="acceptCallBtn" style="background: #28a745; border: none; color: white; width: 50px; height: 50px; border-radius: 50%; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite; box-shadow: 0 2px 10px rgba(40,167,69,0.5);">
                <i class="fas fa-phone-alt"></i>
            </button>
            <button id="declineCallBtn" style="background: #dc3545; border: none; color: white; width: 50px; height: 50px; border-radius: 50%; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(220,53,69,0.5);">
                <i class="fas fa-phone-slash"></i>
            </button>
        </div>
    `;
    
    document.body.prepend(notification);
    
    // Add event listeners
    document.getElementById('acceptCallBtn').addEventListener('click', async () => {
        console.log('Accept button clicked');
        stopRingtone();
        hideIncomingCallNotification();
        
        // Update call status
        await supabase
            .from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', call.id);
        
        // Navigate to call page
        window.location.href = `/pages/call/index.html?incoming=true&room=${call.room_name}&callerId=${call.caller_id}&callId=${call.id}`;
    });
    
    document.getElementById('declineCallBtn').addEventListener('click', async () => {
        console.log('Decline button clicked');
        stopRingtone();
        hideIncomingCallNotification();
        
        // Update call status
        await supabase
            .from('calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', call.id);
        
        sessionStorage.removeItem('incomingCall');
    });
}

// Hide incoming call notification
function hideIncomingCallNotification() {
    const existing = document.getElementById('incomingCallNotification');
    if (existing) existing.remove();
}

// Clean up
export function cleanupCallListener() {
    console.log('Cleaning up call listener');
    stopRingtone();
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