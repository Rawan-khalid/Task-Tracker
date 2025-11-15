import { createClient } from '@supabase/supabase-js';

// --- IMPORTANT ---
// 1. Create a Supabase project at https://supabase.com/
// 2. Go to your project's "API" settings.
// 3. Find your "Project URL" and "anon" "public" key.
// 4. Replace the placeholder values below with your actual credentials.
// -----------------
export const supabaseUrl = 'https://byiuqmdkmvmdnlxtqnwf.supabase.co'; // Replace with your Supabase project URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aXVxbWRrbXZtZG5seHRxbndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjU4NTgsImV4cCI6MjA3ODgwMTg1OH0.N6U1sHjrYWGDuZACo-PgLmzdRCnO4Iif7sYvGAGomq8'; // Replace with your Supabase anon public key

// NOTE ON SESSIONS: Supabase client automatically handles session persistence
// in localStorage. The duration of the session (specifically the refresh token
// lifetime) is configured in your Supabase project's dashboard under
// Authentication -> Settings. To keep users logged in for longer periods (e.g., a year),
// you must adjust the "JWT expiry limit" setting there. This client-side code
// will respect that setting and keep the user logged in accordingly.

// FIX: Removed the placeholder check for Supabase credentials. Since the credentials
// have been filled, this check is no longer needed and was causing a TypeScript
// error due to comparing constant literal types that have no overlap.

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    // FIX: Explicitly provide the browser's native `fetch` to the Supabase client
    // using an arrow function to ensure the correct context. This is an alternative
    // approach to resolve the "Cannot read properties of undefined (reading 'fetch')" error,
    // as the previous `.bind` method may not work in all environments.
    // FIX: Add explicit types for `...args` to resolve TypeScript error about spread arguments.
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  },
});