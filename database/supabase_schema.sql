-- Supabase Schema for Cost Estimator v2
-- Run this in Supabase SQL Editor

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    company_name TEXT,
    tax_office TEXT,
    tax_number TEXT,
    billing_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification Codes Table
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    duration_months INTEGER NOT NULL,
    features JSONB,
    discount_percent INTEGER DEFAULT 0,
    tag TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES subscription_plans(id),
    status TEXT DEFAULT 'active',
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    tender_registration_number TEXT,
    total_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Items Table
CREATE TABLE IF NOT EXISTS project_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    raw_line TEXT,
    unit TEXT,
    matched_poz_code TEXT,
    matched_poz_description TEXT,
    matched_poz_unit TEXT,
    matched_poz_unit_price NUMERIC,
    quantity NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0,
    match_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poz Dataset Table
CREATE TABLE IF NOT EXISTS poz_dataset (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    unit TEXT,
    unit_price NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Subscription Plans
INSERT INTO subscription_plans (id, name, price, duration_months, features, discount_percent, tag, is_active) VALUES
('plan-3-months', '3 Aylık Paket', 2699, 3, '{"unlimited_search": true, "all_agencies": true, "support": "fast"}', 0, NULL, TRUE),
('plan-6-months', '6 Aylık Paket', 4799, 6, '{"unlimited_search": true, "all_agencies": true, "support": "fast", "transport_module": true}', 10, 'Popüler', TRUE),
('plan-12-months', '12 Aylık Paket', 6999, 12, '{"unlimited_search": true, "all_agencies": true, "support": "fast", "api_access": true}', 20, 'En Avantajlı', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_items_project_id ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_poz_dataset_code ON poz_dataset(code);

-- RLS Policies (Optional - for direct client access, but we use server-side access)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- etc.
