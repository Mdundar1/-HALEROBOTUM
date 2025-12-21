import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️  FATAL: SUPABASE_URL and either SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY environment variables are required.');
    process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

console.log('✓ Supabase client initialized');

export default supabase;
