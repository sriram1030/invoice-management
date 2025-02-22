import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabaseUrl = 'URL-SUPABASE';
export const supabaseAnonKey = 'API-KEY';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);