import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://czbfggjyzmrivupvygbi.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6YmZnZ2p5em1yaXZ1cHZ5Z2JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3OTEzMjEsImV4cCI6MjA4NzM2NzMyMX0.dJ7iVO6_rIYriSpFyBPJUaf1vJN62RYFqYOe5dQxNJE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: false,
    storageKey: "uklc-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});
