// File: utils/auth.js
// Authentication functions for Luster

import { supabase } from './supabase.js'

export const auth = {
  // Sign up new user
  async signUp(username, password, fullName = null) {
    try {
      // Create email from username
      const email = `${username}@luster.app`
      
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: username,
            full_name: fullName || username
          }
        }
      })
      
      if (authError) throw authError
      
      // Create profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: username,
          full_name: fullName || username,
          avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
          status: 'online'
        })
      
      if (profileError) {
        // If profile creation fails, delete the auth user
        await supabase.auth.admin.deleteUser(authData.user.id)
        throw profileError
      }
      
      return {
        success: true,
        user: authData.user,
        message: 'Account created successfully!'
      }
      
    } catch (error) {
      console.error('Signup error:', error)
      return {
        success: false,
        error: error.message,
        message: this.getErrorMessage(error)
      }
    }
  },
  
  // Sign in existing user
  async signIn(username, password) {
    try {
      const email = `${username}@luster.app`
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      })
      
      if (error) throw error
      
      return {
        success: true,
        user: data.user,
        message: 'Login successful!'
      }
      
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.message,
        message: this.getErrorMessage(error)
      }
    }
  },
  
  // Sign out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      return { success: true, message: 'Logged out successfully' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },
  
  // Get current user
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      
      return { success: true, user: data.user }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },
  
  // Check if user is logged in
  async isLoggedIn() {
    const result = await this.getCurrentUser()
    return result.success
  },
  
  // Error messages for users
  getErrorMessage(error) {
    const message = error.message.toLowerCase()
    
    if (message.includes('already registered')) {
      return 'Username already taken. Please choose another.'
    }
    if (message.includes('invalid login')) {
      return 'Invalid username or password.'
    }
    if (message.includes('password')) {
      return 'Password must be at least 6 characters.'
    }
    if (message.includes('email')) {
      return 'Please enter a valid username.'
    }
    
    return 'Something went wrong. Please try again.'
  },
  
  // Listen for auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}