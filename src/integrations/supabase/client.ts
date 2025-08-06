import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mxrjsclpdwmrrvmzmqmo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cmpzY2xwZHdtcnJ2bXptcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODYzMTIsImV4cCI6MjA2OTk2MjMxMn0.GPD_SYgcmCTHokdzUMV-mGqMvDd5LK-KQH9pjhd8UoY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})