// File: utils/auth.js - SIMPLE USERNAME-ONLY AUTH SYSTEM (CLEAN VERSION)
import { supabase } from './supabase.js'

let heartbeatInterval = null;
let currentUserId = null;

// SIMPLE HEARTBEAT SYSTEM (Optional - can be enabled later)
const heartbeat = {
    async start(userId) {
        if (!userId) return;
        
        currentUserId = userId;
        console.log("❤️ Heartbeat started for:", userId);
        
        // Set initial online status
        await this.updateStatus('online');
        
        // Send heartbeat every 30 seconds
        heartbeatInterval = setInterval(() => {
            this.updateStatus('online');
        }, 30000);
        
        // Update on tab focus
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateStatus('online');
            }
        });
        
        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            this.stop();
        });
    },
    
    async updateStatus(status) {
        if (!currentUserId) return;
        
        try {
            await supabase
                .from('profiles')
                .update({ 
                    status: status,
                    last_seen: new Date().toISOString()
                })
                .eq('id', currentUserId);
        } catch (error) {
            console.log("Heartbeat error:", error);
        }
    },
    
    stop() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
        if (currentUserId) {
            // Try to set offline (might fail if page unloading)
            this.updateStatus('offline').catch(() => {});
        }
        currentUserId = null;
    }
};

// MAIN AUTH OBJECT
export const auth = {
    // Sign in existing user (MAIN LOGIN FUNCTION)
    async signIn(username, password) {
        try {
            console.log("🔐 Login attempt:", username);

            // Use @luster.test domain
            const internalEmail = `${username}@luster.test`;

            const { data, error } = await supabase.auth.signInWithPassword({
                email: internalEmail,
                password: password
            });

            if (error) throw error;

            console.log("✅ Login successful:", data.user.email);
            
            // START HEARTBEAT IF NEEDED
            heartbeat.start(data.user.id);

            return {
                success: true,
                user: data.user,
                message: 'Login successful!'
            };

        } catch (error) {
            console.error('❌ Login error:', error.message);
            return {
                success: false,
                error: error.message,
                message: this.getErrorMessage(error)
            };
        }
    },

    // Create new account
    async signUp(username, password) {
        try {
            console.log("📝 Signup attempt:", username);

            // Use @luster.test domain
            const internalEmail = `${username}@luster.test`;

            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: internalEmail,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

            if (authError) throw authError;

            // Create profile in profiles table
            if (authData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: authData.user.id,
                        username: username,
                        status: 'offline',
                        created_at: new Date().toISOString()
                    });

                if (profileError) throw profileError;
            }

            console.log("✅ Signup successful:", username);
            return {
                success: true,
                user: authData.user,
                message: 'Account created successfully!'
            };

        } catch (error) {
            console.error('❌ Signup error:', error.message);
            return {
                success: false,
                error: error.message,
                message: this.getErrorMessage(error)
            };
        }
    },

    // Sign out
    async signOut() {
        try {
            // Stop heartbeat first
            heartbeat.stop();
            
            // Sign out from Supabase
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            return { 
                success: true, 
                message: 'Logged out successfully' 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    },

    // Get current user (NO AUTOMATIC HEARTBEAT START - causes loops)
    async getCurrentUser() {
        try {
            const { data, error } = await supabase.auth.getUser();
            if (error) throw error;

            if (data.user) {
                // Get profile data
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .maybeSingle();

                return { 
                    success: true, 
                    user: data.user,
                    profile: profile
                };
            }

            return { 
                success: false, 
                error: 'No user found' 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    },

    // Check session (simple version)
    async getSession() {
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            return { 
                success: true, 
                session: data.session 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    },

    // Manual heartbeat control (call this when needed)
    async startUserHeartbeat(userId) {
        if (!userId) return;
        heartbeat.start(userId);
    },

    // Manual heartbeat stop
    stopUserHeartbeat() {
        heartbeat.stop();
    },

    // Check if user is online
    async isUserOnline(userId) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('last_seen, status')
                .eq('id', userId)
                .maybeSingle();
                
            if (!profile || !profile.last_seen) return false;
            
            const lastSeen = new Date(profile.last_seen);
            const now = new Date();
            const secondsAgo = (now - lastSeen) / 1000;
            
            // Online if seen in last 60 seconds AND status is 'online'
            return secondsAgo < 60 && profile.status === 'online';
        } catch (error) {
            console.log("Online check error:", error);
            return false;
        }
    },

    // Simple error messages
    getErrorMessage(error) {
        const msg = error.message.toLowerCase();

        if (msg.includes('already') || msg.includes('exists')) {
            return 'Username already taken';
        }
        if (msg.includes('invalid') || msg.includes('incorrect')) {
            return 'Invalid username or password';
        }
        if (msg.includes('password')) {
            return 'Password must be at least 6 characters';
        }
        if (msg.includes('email')) {
            return 'Invalid email format';
        }

        return 'Something went wrong. Please try again.';
    }
};

// Auto cleanup if page unloads
window.addEventListener('beforeunload', () => {
    heartbeat.stop();
});

// Export heartbeat separately if needed
export { heartbeat };