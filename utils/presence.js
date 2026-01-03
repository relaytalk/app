// /app/utils/presence.js - FIXED VERSION WITHOUT RLS ISSUES
import { supabase } from './supabase.js';

class PresenceTracker {
    constructor() {
        this.intervalId = null;
        this.userId = null;
        this.isTracking = false;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async start(userId) {
        this.userId = userId;
        this.isTracking = true;

        console.log("👁️ Presence tracking started for:", userId);

        // Initial online status - WITHOUT UPSERT (using direct SQL call)
        await this.updatePresenceWithFunction(true);

        // Periodic updates (every 45 seconds)
        this.intervalId = setInterval(() => {
            this.updatePresenceWithFunction(document.visibilityState === 'visible');
        }, 45000);

        // Visibility changes
        document.addEventListener('visibilitychange', () => {
            this.updatePresenceWithFunction(document.visibilityState === 'visible');
        });

        // Page unload
        window.addEventListener('beforeunload', () => this.stop());

        return true;
    }

    // NEW METHOD: Use Supabase function to avoid RLS issues
    async updatePresenceWithFunction(isOnline) {
    if (!this.userId || !this.isTracking) return;

    try {
        // Convert userId to UUID format if needed
        const userId = this.userId;
        
        // If userId is not a valid UUID (like email), get the actual user UUID
        let userUuid = userId;
        
        // If it's not a valid UUID format, try to get from auth
        if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                userUuid = user.id;
            }
        }

        // Call database function
        const { error } = await supabase.rpc('update_user_presence', {
            p_user_id: userUuid,
            p_is_online: isOnline
        });

        if (error) {
            console.error("Presence function error:", error);
            throw error;
        }

        console.log(`✅ Presence updated via function: ${isOnline ? 'Online' : 'Offline'}`);
        this.retryCount = 0;
        return true;

    } catch (error) {
        console.error(`❌ Presence update failed:`, error.message);
        return false;
    }
}

    async stop() {
        this.isTracking = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Mark as offline on exit using function
        if (this.userId) {
            try {
                await this.updatePresenceWithFunction(false);
            } catch (error) {
                console.log("Note: Could not update offline status on exit");
            }
        }

        console.log("👋 Presence tracking stopped");
    }

    async checkOnlineStatus(userId) {
        try {
            // Use select with simple condition - no RLS recursion
            const { data: presence, error } = await supabase
                .from('user_presence')
                .select('is_online, last_seen')
                .eq('user_id', userId)
                .maybeSingle(); // Use maybeSingle to avoid errors if no record

            if (error || !presence) {
                return { online: false, lastSeen: null };
            }

            if (presence.is_online) {
                return { online: true, lastSeen: presence.last_seen };
            }

            const lastSeen = new Date(presence.last_seen);
            const now = new Date();
            const minutesAway = (now - lastSeen) / (1000 * 60);

            return { 
                online: minutesAway < 5,
                lastSeen: presence.last_seen 
            };

        } catch (error) {
            console.error("Error checking online status:", error);
            return { online: false, lastSeen: null };
        }
    }
}

// Export singleton instance
const presenceTracker = new PresenceTracker();
export default presenceTracker;