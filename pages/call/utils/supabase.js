// call/utils/supabase.js - CallApp Supabase for RelayTalk

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://yrbkwfpksfvbesrjxwse.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyYmt3ZnBrc2Z2YmVzcmp4d3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNTQ3NTYsImV4cCI6MjA4NjYzMDc1Nn0.a2hWJyMENdxjXPImM13Eq31lbszsr-kyIG08X4JlgWU'

let supabaseInstance = null

export async function initializeSupabase() {
    if (supabaseInstance) {
        console.log('✅ Using existing Supabase instance')
        return supabaseInstance
    }

    console.log('🔄 Initializing Call Supabase...')

    try {
        supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false, // Don't persist - we use main app's auth
                autoRefreshToken: false
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        })

        // Test connection
        const { error } = await supabaseInstance
            .from('profiles')
            .select('count', { count: 'exact', head: true })

        if (error) {
            console.warn('⚠️ Supabase connection warning:', error.message)
        } else {
            console.log('✅ Call Supabase connected')
        }

        return supabaseInstance

    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error)
        throw error
    }
}

export const supabase = supabaseInstance
