// utils/call-supabase.js - Lightweight Supabase for call page only
// Dedicated instance that loads fast and never redirects

const supabaseUrl = 'https://blxtldgnssvasuinpyit.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'

let callSupabase = null;
let initPromise = null;

// Fast initialization for call page - no delays, no fallbacks
export async function initCallSupabase() {
    // Return existing instance if already created
    if (callSupabase) return callSupabase;
    
    // Return existing promise if already initializing
    if (initPromise) return initPromise;
    
    console.log('📞 Call page: Initializing lightweight Supabase...');
    
    initPromise = new Promise(async (resolve) => {
        try {
            // Import directly from CDN
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm');
            
            // Create client with minimal config
            callSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: false, // Don't auto-refresh to avoid redirects
                    detectSessionInUrl: false,
                    storage: window.localStorage
                }
            });
            
            console.log('✅ Call page: Supabase client created');
            
            // Try to get session but NEVER throw
            try {
                const { data } = await callSupabase.auth.getSession();
                if (data.session) {
                    console.log('✅ Call page: Active session found');
                } else {
                    console.log('ℹ️ Call page: No active session');
                }
            } catch (e) {
                console.log('ℹ️ Call page: Session check failed, continuing');
            }
            
            resolve(callSupabase);
            
        } catch (error) {
            console.error('❌ Call page: Supabase init failed:', error);
            // Return dummy object that won't break the call
            callSupabase = {
                auth: {
                    getSession: async () => ({ data: { session: null }, error: null }),
                    getUser: async () => ({ data: { user: null }, error: null })
                }
            };
            resolve(callSupabase);
        }
    });
    
    return initPromise;
}

// Get current session without throwing
export async function getCallSession() {
    try {
        const supabase = await initCallSupabase();
        const { data } = await supabase.auth.getSession();
        return data.session;
    } catch {
        return null;
    }
}

// Get current user without throwing
export async function getCallUser() {
    try {
        const supabase = await initCallSupabase();
        const { data } = await supabase.auth.getUser();
        return data.user;
    } catch {
        return null;
    }
}