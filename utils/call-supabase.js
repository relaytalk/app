// utils/call-supabase.js - Dedicated Supabase for call page with recovery
const supabaseUrl = 'https://blxtldgnssvasuinpyit.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'

let callSupabase = null;
let initPromise = null;

export async function initCallSupabase() {
    if (callSupabase) return callSupabase;
    if (initPromise) return initPromise;

    console.log('📞 Call page: Initializing Supabase...');

    initPromise = new Promise(async (resolve) => {
        try {
            // Import from CDN
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm');

            callSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                    storage: window.localStorage
                }
            });

            console.log('✅ Call page: Supabase client created');

            // Try to get session - like home page does
            try {
                const { data } = await callSupabase.auth.getSession();
                if (data.session) {
                    console.log('✅ Call page: Active session found');
                } else {
                    console.log('ℹ️ Call page: No active session');
                    
                    // Try to recover from localStorage like home page
                    try {
                        const localToken = localStorage.getItem('supabase.auth.token');
                        if (localToken && localToken.includes('access_token')) {
                            console.log('✅ Call page: Recovered session from localStorage');
                        }
                    } catch (e) {}
                }
            } catch (e) {
                console.log('ℹ️ Call page: Session check failed');
            }

            resolve(callSupabase);

        } catch (error) {
            console.error('❌ Call page: Supabase init failed:', error);
            // Return dummy object that won't break
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

export async function getCallSession() {
    try {
        const supabase = await initCallSupabase();
        const { data } = await supabase.auth.getSession();
        return data.session;
    } catch {
        return null;
    }
}