// File: utils/supabase.js
// Supabase connection for Luster Chat App - UPDATED

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// 🔑 Your Supabase credentials
const supabaseUrl = 'https://blxtldgnssvasuinpyit.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJseHRsZGduc3N2YXN1aW5weWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODIxODIsImV4cCI6MjA4MjY1ODE4Mn0.Dv04IOAY76o2ccu5dzwK3fJjzo93BIoK6C2H3uWrlMw'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ✅ IMPORTANT: Make available globally for console debugging
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  console.log("🌐 Supabase client made globally available");
}

// Debug: Check if client works
supabase.auth.getUser().then(({ data: { user } }) => {
  if (user) {
    console.log("✅ Supabase client working, user:", user.email);
  } else {
    console.log("✅ Supabase client working, no user logged in");
  }
}).catch(error => {
  console.error("❌ Supabase client error:", error);
});

// Export for use in other files
export { supabase }