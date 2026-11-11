import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SHARED_WMS_URL;
const supabaseAnonKey = import.meta.env.VITE_SHARED_WMS_ANON_KEY;

export const sharedWmsClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
