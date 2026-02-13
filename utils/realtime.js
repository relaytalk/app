// utils/realtime.js - Real-time call handling
import { initializeSupabase } from './supabase.js';

let supabaseInstance = null;
let callSubscription = null;
let incomingCallCallback = null;

// Initialize real-time listeners
export async function initRealtime(callback) {
    try {
        console.log('🔌 Initializing real-time call listener...');
        
        supabaseInstance = await initializeSupabase();
        
        if (!supabaseInstance) {
            console.error('❌ Supabase not initialized');
            return null;
        }

        const { data: { user }, error } = await supabaseInstance.auth.getUser();
        
        if (error || !user) {
            console.error('❌ No user logged in:', error);
            return null;
        }

        console.log('✅ User authenticated for real-time:', user.id);
        incomingCallCallback = callback;

        // Clean up any existing subscription
        if (callSubscription) {
            callSubscription.unsubscribe();
        }

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
                    console.log('📞 INCOMING CALL DETECTED:', payload);
                    
                    // Only show if status is 'ringing'
                    if (payload.new.status === 'ringing') {
                        // Get caller info before triggering callback
                        getCallerInfo(payload.new.caller_id).then(caller => {
                            if (incomingCallCallback) {
                                incomingCallCallback({
                                    ...payload.new,
                                    caller_name: caller?.username || 'Unknown',
                                    caller_avatar: caller?.avatar_url
                                });
                            }
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log('📡 Realtime subscription status:', status);
            });

        console.log('✅ Real-time call listener initialized');
        return callSubscription;

    } catch (error) {
        console.error('❌ Realtime init error:', error);
        return null;
    }
}

// Get caller info
async function getCallerInfo(callerId) {
    try {
        supabaseInstance = await initializeSupabase();
        
        const { data, error } = await supabaseInstance
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single();
            
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error getting caller info:', error);
        return null;
    }
}

// Update call status
export async function updateCallStatus(callId, status) {
    try {
        supabaseInstance = await initializeSupabase();
        
        const { error } = await supabaseInstance
            .from('calls')
            .update({ 
                status, 
                updated_at: new Date().toISOString(),
                ...(status === 'accepted' ? { accepted_at: new Date().toISOString() } : {}),
                ...(status === 'declined' || status === 'missed' ? { ended_at: new Date().toISOString() } : {})
            })
            .eq('id', callId);

        if (error) throw error;
        
        console.log(`✅ Call status updated to: ${status}`);
        return true;
        
    } catch (error) {
        console.error('❌ Error updating call status:', error);
        return false;
    }
}

// Check for existing ringing calls
export async function checkExistingCalls() {
    try {
        supabaseInstance = await initializeSupabase();
        
        const { data: { user } } = await supabaseInstance.auth.getUser();
        if (!user) return null;
        
        const { data, error } = await supabaseInstance
            .from('calls')
            .select('*, caller:caller_id(username, avatar_url)')
            .eq('receiver_id', user.id)
            .eq('status', 'ringing')
            .gt('created_at', new Date(Date.now() - 60000).toISOString()) // Last 60 seconds
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            console.log('📞 Found existing ringing call:', data[0]);
            return data[0];
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Error checking existing calls:', error);
        return null;
    }
}

// Cleanup subscription
export function cleanupRealtime() {
    if (callSubscription) {
        console.log('🔌 Cleaning up real-time subscription');
        callSubscription.unsubscribe();
        callSubscription = null;
    }
}