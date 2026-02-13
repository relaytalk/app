// call-listener.js - Runs on EVERY page to show incoming calls
import { auth } from './auth.js';

let supabase = null;
let currentUser = null;
let activeCallSubscription = null;
let currentModal = null;

// Initialize listener
async function initCallListener() {
    try {
        // Get current user
        const { success, user } = await auth.getCurrentUser();
        if (!success || !user) return; // Not logged in, exit silently
        
        currentUser = user;
        console.log('📞 Call listener active for:', currentUser.email);

        // Wait for Supabase
        await waitForSupabase();
        if (!window.supabase) return;

        supabase = window.supabase;

        // Start listening for incoming calls
        subscribeToIncomingCalls();

        // Listen for call updates (answered, ended)
        subscribeToCallUpdates();

    } catch (error) {
        console.log('Call listener init error (non-critical):', error);
    }
}

// Wait for Supabase to be available
async function waitForSupabase() {
    let attempts = 0;
    while (!window.supabase && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
    }
    return !!window.supabase;
}

// Subscribe to incoming calls
function subscribeToIncomingCalls() {
    if (!supabase || !currentUser) return;

    // Clean up old subscription
    if (activeCallSubscription) {
        activeCallSubscription.unsubscribe();
    }

    // Listen for new calls WHERE receiver_id = current user AND status = 'ringing'
    activeCallSubscription = supabase
        .channel('incoming-calls')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'calls',
                filter: `receiver_id=eq.${currentUser.id}`
            },
            (payload) => {
                console.log('📞 Incoming call detected:', payload);
                handleIncomingCall(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'calls',
                filter: `receiver_id=eq.${currentUser.id}`
            },
            (payload) => {
                console.log('📞 Call updated:', payload);
                handleCallUpdate(payload.new);
            }
        )
        .subscribe();
}

// Handle incoming call
function handleIncomingCall(callData) {
    // Don't show if already on call page
    if (window.location.pathname.includes('/call/')) return;

    // Don't show if already have modal
    if (currentModal) return;

    // Fetch caller info
    fetchCallerInfo(callData.caller_id).then(caller => {
        showIncomingCallModal(callData, caller);
    });
}

// Fetch caller details
async function fetchCallerInfo(callerId) {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();
        
        return data || { username: 'Someone', avatar_url: null };
    } catch {
        return { username: 'Someone', avatar_url: null };
    }
}

// Show incoming call modal
function showIncomingCallModal(callData, caller) {
    // Remove any existing modal
    if (currentModal) {
        document.body.removeChild(currentModal);
        currentModal = null;
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'incoming-call-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #007acc, #005a9e);
        color: white;
        padding: 20px;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease;
        border-bottom-left-radius: 20px;
        border-bottom-right-radius: 20px;
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

    const initial = caller.username?.charAt(0).toUpperCase() || '?';

    modal.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; max-width: 600px; margin: 0 auto;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(45deg, #00b4d8, #007acc); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: bold; border: 3px solid white;">
                ${caller.avatar_url 
                    ? `<img src="${caller.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                    : initial
                }
            </div>
            <div style="flex: 1;">
                <div style="font-size: 1.3rem; font-weight: 600; margin-bottom: 5px;">${caller.username || 'Someone'}</div>
                <div style="display: flex; align-items: center; gap: 5px; opacity: 0.9;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: #4ade80; border-radius: 50%; animation: pulse 1s infinite;"></span>
                    Incoming call...
                </div>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="answer-call-btn" style="background: #28a745; border: none; color: white; width: 55px; height: 55px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2);" data-call-id="${callData.id}" data-room-url="${callData.room_url}">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="decline-call-btn" style="background: #dc3545; border: none; color: white; width: 55px; height: 55px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2);" data-call-id="${callData.id}">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
    `;

    document.body.prepend(modal);
    currentModal = modal;

    // Add event listeners
    modal.querySelector('.answer-call-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const roomUrl = e.currentTarget.dataset.roomUrl;
        
        // Update call status to 'ongoing'
        await supabase
            .from('calls')
            .update({ 
                status: 'ongoing',
                answered_at: new Date().toISOString()
            })
            .eq('id', callData.id);

        // Remove modal
        if (currentModal) {
            document.body.removeChild(currentModal);
            currentModal = null;
        }

        // Navigate to call page
        window.location.href = `/pages/call/index.html?room=${encodeURIComponent(roomUrl)}&incoming=true`;
    });

    modal.querySelector('.decline-call-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const callId = e.currentTarget.dataset.callId;

        // Update call status to 'missed'
        await supabase
            .from('calls')
            .update({ 
                status: 'missed',
                ended_at: new Date().toISOString()
            })
            .eq('id', callId);

        // Remove modal
        if (currentModal) {
            document.body.removeChild(currentModal);
            currentModal = null;
        }
    });

    // Auto-remove after 45 seconds if no answer
    setTimeout(() => {
        if (currentModal && currentModal === modal) {
            document.body.removeChild(modal);
            currentModal = null;
            
            // Update status to 'missed' if still ringing
            supabase
                .from('calls')
                .update({ 
                    status: 'missed',
                    ended_at: new Date().toISOString()
                })
                .eq('id', callData.id)
                .eq('status', 'ringing');
        }
    }, 45000);
}

// Handle call updates (if answered on another device)
function handleCallUpdate(callData) {
    // If call is no longer ringing, remove modal
    if (callData.status !== 'ringing' && currentModal) {
        document.body.removeChild(currentModal);
        currentModal = null;
    }
}

// Subscribe to call updates
function subscribeToCallUpdates() {
    if (!supabase || !currentUser) return;

    supabase
        .channel('call-updates')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'calls',
                filter: `receiver_id=eq.${currentUser.id}`
            },
            (payload) => {
                if (payload.new.status !== 'ringing' && currentModal) {
                    document.body.removeChild(currentModal);
                    currentModal = null;
                }
            }
        )
        .subscribe();
}

// Start listener
initCallListener();

// Re-initialize on page navigation (for SPAs)
window.addEventListener('popstate', () => {
    // Small delay to let page load
    setTimeout(initCallListener, 500);
});
