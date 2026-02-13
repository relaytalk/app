// utils/realtime.js - Real-time call handling
import { initializeSupabase } from './supabase.js';

let supabaseInstance = null;
let callSubscription = null;
let incomingCallCallback = null;

// Initialize real-time listeners
export async function initRealtime(callback) {
    try {
        supabaseInstance = await initializeSupabase();
        
        if (!supabaseInstance) {
            console.error('❌ Supabase not initialized');
            return;
        }

        const { data: { user } } = await supabaseInstance.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }

        incomingCallCallback = callback;

        // Subscribe to new calls where current user is the receiver
        callSubscription = supabaseInstance
            .channel('calls-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'calls',
                    filter: `receiver_id=eq.${user.id}`
                },
                (payload) => {
                    console.log('📞 Incoming call detected:', payload);
                    if (incomingCallCallback) {
                        incomingCallCallback(payload.new);
                    }
                }
            )
            .subscribe();

        console.log('✅ Real-time call listener initialized');

    } catch (error) {
        console.error('❌ Realtime init error:', error);
    }
}

// Update call status
export async function updateCallStatus(callId, status) {
    try {
        supabaseInstance = await initializeSupabase();
        
        const { error } = await supabaseInstance
            .from('calls')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', callId);

        if (error) throw error;
        
        console.log(`✅ Call status updated to: ${status}`);
        
    } catch (error) {
        console.error('❌ Error updating call status:', error);
    }
}

// Cleanup subscription
export function cleanupRealtime() {
    if (callSubscription) {
        callSubscription.unsubscribe();
        callSubscription = null;
    }
}