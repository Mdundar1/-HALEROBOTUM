-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE (Mirroring existing structure + Supabase Auth compatibility)
-- We will use a public 'users' table that syncs with auth.users or just simpler custom auth for now.
-- Consistency Phase: Let's stick to the structure we had in SQLite but use postgres types.
create table if not exists public.users (
    id uuid primary key default uuid_generate_v4(),
    email text unique not null,
    password text not null, -- Storing bcrypt hash here for custom auth
    name text,
    phone text,
    company text,
    role text default 'user', -- 'user' or 'admin'
    email_verified boolean default false,
    verified_at timestamptz,
    created_at timestamptz default now()
);

-- 2. SUBSCRIPTION PLANS (Replicating the 'init_plans.cjs' logic)
create table if not exists public.subscription_plans (
    id text primary key, -- 'starter', 'pro', 'enterprise'
    name text not null,
    price numeric not null,
    duration_months integer not null,
    features jsonb,
    tag text,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Seed Plans
insert into public.subscription_plans (id, name, price, duration_months, features, tag)
values 
    ('starter', 'Başlangıç', 0, 999, '["1 Proje Hakkı", "Temel Metraj Analizi", "Standart Raporlama", "Poz Arama Motoru"]', null),
    ('pro', 'Profesyonel', 2950, 12, '["Sınırsız Proje", "Gelişmiş AI Analiz", "Excel & PDF Export", "7/24 Öncelikli Destek", "Güncel Birim Fiyatlar"]', 'En Popüler'),
    ('enterprise', 'Kurumsal', 0, 12, '["Özel Sunucu Kurulumu", "API Erişimi", "Çoklu Kullanıcı", "Özel Entegrasyon", "SLA Garantisi"]', null)
on conflict (id) do update 
set name = excluded.name, price = excluded.price, features = excluded.features, tag = excluded.tag;

-- 3. PROJECTS
create table if not exists public.projects (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete cascade,
    name text not null,
    description text,
    status text default 'draft', -- 'draft', 'completed'
    total_cost numeric default 0,
    created_at timestamptz default now()
);

-- 4. PROJECT ITEMS
create table if not exists public.project_items (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade,
    raw_line text,
    unit text,
    matched_poz_code text,
    matched_poz_description text,
    matched_poz_unit text,
    matched_poz_unit_price numeric,
    quantity numeric default 1,
    total_price numeric default 0,
    match_score numeric,
    metadata jsonb,
    created_at timestamptz default now()
);

-- 5. POZ_ITEMS (The Dataset)
create table if not exists public.poz_items (
    id uuid primary key default uuid_generate_v4(),
    code text unique not null,
    description text not null,
    unit text,
    unit_price numeric,
    created_at timestamptz default now()
);

-- 6. SUBSCRIPTIONS (User subscriptions)
create table if not exists public.subscriptions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete cascade,
    plan_id text references public.subscription_plans(id),
    status text default 'active', -- 'active', 'expired', 'cancelled'
    starts_at timestamptz default now(),
    ends_at timestamptz,
    created_at timestamptz default now()
);

-- RLS POLICIES (Row Level Security) --
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
-- poz_items is public read usually, but admin write
alter table public.poz_items enable row level security; 

-- Policies using Generic Auth (Since we use custom auth with 'users' table, standard RLS using auth.uid() might strictly not apply if we are not using Supabase Auth. 
-- BUT, if we migrate to Supabase Auth later, RLS is needed. 
-- FOR PHASE 1, to make the 'Anon Key' work with our Custom Logic, we should probably allow public read/write OR use a Service Key in the backend. 
-- SINCE we are moving to Vercel (Client side calls?), we NEED RLS. 
-- HOWEVER, implementing Supabase Auth (signin) is the best way to get a 'uid'. 
-- IF we stick to 'Custom JWT', Supabase doesn't know who the user is unless we sign the JWT with Supabase Secret.
-- STRATEGY: For this migration, we will use 'Postgres Functions' for sensitive ops OR 'Service Role' from the Backend API (Next.js API Routes).
-- IF we use Next.js API Routes with Service Role, we can bypass RLS.
-- SO: Disable RLS for now or allow Anon for everything (Insecure but functional for 'Demo'), OR strict RLS and use Service Key on Server.
-- DECISION: Next.js API Routes will use SERVICE_ROLE_KEY (which we need to get from user). 
-- Wait, user didn't give Service Role Key. 
-- So we MUST Rely on Supabase Auth or give Anon full access (bad).
-- Ok, let's create a policy that allows Anon to do basic things for now, but really we should get the Service Key.

-- 1. USERS: Only users can see/edit their own data
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" on public.users for select using (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" on public.users for update using (auth.uid() = id);

-- 2. PROJECTS: Strictly owner-based access
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" on public.projects for select using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" on public.projects for insert with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" on public.projects for update using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" on public.projects for delete using (auth.uid() = user_id);

-- 3. PROJECT ITEMS: Cascade from project ownership
DROP POLICY IF EXISTS "Users can view their own project items" ON public.project_items;
CREATE POLICY "Users can view their own project items" on public.project_items for select using (
    exists (select 1 from public.projects where id = project_items.project_id and user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can manage their own project items" ON public.project_items;
CREATE POLICY "Users can manage their own project items" on public.project_items for all using (
    exists (select 1 from public.projects where id = project_items.project_id and user_id = auth.uid())
);

-- 4. SUBSCRIPTIONS: Owner-only
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);

-- 5. POZ_ITEMS: Public read-only, Admin write (via Service Role)
DROP POLICY IF EXISTS "Anyone can view poz items" ON public.poz_items;
CREATE POLICY "Anyone can view poz items" on public.poz_items for select using (true);

DROP POLICY IF EXISTS "Only service role can modify poz items" ON public.poz_items;
CREATE POLICY "Only service role can modify poz items" on public.poz_items for all using (false) with check (false);

-- 6. SUBSCRIPTION PLANS: Public read-only
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view subscription plans" on public.subscription_plans for select using (true);
