// call/utils/userSync.js - Get user from RelayTalk

// Configuration for main RelayTalk Supabase
const MAIN_SUPABASE_URL = 'https://blxtldgnssvasuinpyit.supabase.co'
const MAIN_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'

let mainSupabase = null

// Initialize main Supabase client
async function getMainSupabase() {
    if (mainSupabase) return mainSupabase

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    mainSupabase = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_ANON_KEY)
    return mainSupabase
}

// Get user from main RelayTalk's localStorage
export function getRelayTalkUser() {
    try {
        const possibleKeys = [
            'supabase.auth.token',
            'sb-auth-token',
            'sb-refresh-token'
        ]

        let authData = null
        for (const key of possibleKeys) {
            const data = localStorage.getItem(key)
            if (data) {
                authData = data
                console.log(`✅ Found auth in: ${key}`)
                break
            }
        }

        if (!authData) {
            console.log('No auth data found')
            return null
        }

        const parsed = JSON.parse(authData)
        let session = null

        if (parsed.currentSession) {
            session = parsed.currentSession
        } else if (parsed.user) {
            session = parsed
        } else if (parsed.access_token) {
            session = { user: parsed.user || parsed }
        } else if (Array.isArray(parsed) && parsed[0]?.user) {
            session = parsed[0]
        }

        if (!session?.user) return null

        const user = session.user

        return {
            id: user.id,
            email: user.email || '',
            username: user.user_metadata?.username || 
                     user.email?.split('@')[0] || 
                     'User',
            avatar_url: user.user_metadata?.avatar_url || null
        }

    } catch (e) {
        console.error('Error getting user:', e)
        return null
    }
}

// Sync user to Call database
export async function syncUserToDatabase(supabase, user) {
    try {
        console.log('🔄 Syncing user to Call DB:', user.email)

        const { data: existing, error: checkError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle()

        if (checkError) throw checkError

        if (existing) {
            const { data: updated, error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    status: 'online',
                    last_seen: new Date().toISOString(),
                    username: existing.username || user.username,
                    email: user.email,
                    avatar_url: user.avatar_url || existing.avatar_url
                })
                .eq('id', user.id)
                .select()
                .single()

            if (updateError) throw updateError
            console.log('✅ User updated in Call DB')
            return updated || existing
        }

        const newUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
            status: 'online',
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString()
        }

        const { data: created, error: insertError } = await supabase
            .from('profiles')
            .insert([newUser])
            .select()
            .single()

        if (insertError) throw insertError

        console.log('✅ User created in Call DB')
        return created

    } catch (error) {
        console.error('❌ Sync failed:', error)
        throw error
    }
}

// Get caller info
export async function getCallerInfo(supabase, callerId) {
    try {
        const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', callerId)
            .single()

        return data || { username: 'Unknown', avatar_url: null }
    } catch (error) {
        return { username: 'Unknown', avatar_url: null }
    }
}

// Update user status
export async function updateUserStatus(supabase, userId, status) {
    try {
        await supabase
            .from('profiles')
            .update({ 
                status: status,
                last_seen: new Date().toISOString()
            })
            .eq('id', userId)
    } catch (error) {
        console.error('Error updating status:', error)
    }
}
