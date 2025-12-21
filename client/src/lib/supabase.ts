import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables (may be empty during build)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
    if (!_supabase && supabaseUrl && supabaseAnonKey) {
        _supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
    return _supabase;
}

export function getSupabaseAdmin(): SupabaseClient | null {
    if (!_supabaseAdmin && supabaseUrl && supabaseServiceKey) {
        _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }
    return _supabaseAdmin;
}

// For backward compatibility - now properly typed as nullable
export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const supabaseAdmin: SupabaseClient | null = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;


// Database types
export interface User {
    id: string;
    email: string;
    password: string;
    name: string | null;
    email_verified: boolean;
    verified_at: string | null;
    created_at: string;
}

export interface Project {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    total_cost: number;
    created_at: string;
}

export interface ProjectItem {
    id: string;
    project_id: string;
    raw_line: string | null;
    unit: string | null;
    matched_poz_code: string | null;
    matched_poz_description: string | null;
    matched_poz_unit: string | null;
    matched_poz_unit_price: number | null;
    quantity: number;
    total_price: number;
    match_score: number | null;
    created_at: string;
}

export interface PozItem {
    id: string;
    code: string;
    description: string;
    unit: string | null;
    unit_price: number | null;
    created_at: string;
}
