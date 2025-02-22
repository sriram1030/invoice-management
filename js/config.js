import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabaseUrl = 'https://zpjrivjogqljxnodmtbj.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwanJpdmpvZ3Fsanhub2RtdGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4NzgxNDUsImV4cCI6MjA1NTQ1NDE0NX0.FQ_ru6GJAOBvjJVTw6qr0RdntCDHh8KmUAUfCxxGROA';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);