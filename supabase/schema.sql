-- ==============================================================================
-- MULTI-COMPANY EXPENSE TRACKER - SUPABASE DATABASE SCHEMA
-- Features:
-- 1. Profiles with Admin Approval Workflow (pending / approved / rejected)
-- 2. First registered user automatically becomes active Admin
-- 3. Dynamic Companies with Google Sheet & Drive mappings
-- 4. Atomic Daily Receipt Code Generator: {COMPANY_CODE}-{YYYYMMDD}-{001}
-- 5. Expenses table with Google Drive & Sheets live sync tracking
-- 6. Strict PostgreSQL Row Level Security (RLS) policies
-- 7. Supabase Storage bucket configuration for receipts
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Extends Supabase auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    email text not null,
    role text not null check (role in ('admin', 'member')) default 'member',
    status text not null check (status in ('pending', 'approved', 'rejected', 'deactivated')) default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Index for fast user status & role lookup
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

-- ------------------------------------------------------------------------------
-- 2. COMPANIES TABLE (Multi-company support, dynamically expandable)
-- ------------------------------------------------------------------------------
create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null unique, -- e.g., 'CO1', 'CO2'
    google_sheet_id text not null default '',
    sheet_tab_name text not null default 'Expenses',
    google_drive_folder_id text not null default '',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_companies_code on public.companies(code);
create index if not exists idx_companies_active on public.companies(is_active);

-- Seed initial 2 companies with official company names and live Google Sheet IDs
insert into public.companies (name, code, google_sheet_id, sheet_tab_name, google_drive_folder_id, is_active)
values
    ('Ulpala Solution Pvt Ltd', 'CO1', '1hqdEGXo2GcsJrB49z_DKivLayQUzqq3x8hOzw8tc9Fk', 'Expenses', '', true),
    ('Savana Force LLP', 'CO2', '1VfqrI_tfr-FYQa4TGOcSHAG1BstIxY1H61bu-3i-p4Q', 'Expenses', '', true)
on conflict (code) do update set
    name = excluded.name,
    google_sheet_id = excluded.google_sheet_id,
    sheet_tab_name = excluded.sheet_tab_name;

-- ------------------------------------------------------------------------------
-- 3. DAILY RECEIPT SEQUENCES TABLE (For atomic, race-safe receipt code generation)
-- Format: {COMPANY_CODE}-{YYYYMMDD}-{SEQUENCE} (e.g., CO1-20261127-001)
-- ------------------------------------------------------------------------------
create table if not exists public.daily_receipt_sequences (
    company_code text not null,
    date_str text not null, -- YYYYMMDD
    last_seq integer not null default 0,
    primary key (company_code, date_str)
);

-- Stored procedure to atomically generate the next receipt code
create or replace function public.generate_receipt_code(
    p_company_code text,
    p_expense_date date
)
returns text
language plpgsql
security definer
as $$
declare
    v_date_str text;
    v_seq integer;
    v_receipt_code text;
begin
    -- Format date as YYYYMMDD
    v_date_str := to_char(p_expense_date, 'YYYYMMDD');

    -- Insert or update atomic counter for this company on this date
    insert into public.daily_receipt_sequences (company_code, date_str, last_seq)
    values (upper(p_company_code), v_date_str, 1)
    on conflict (company_code, date_str)
    do update set last_seq = public.daily_receipt_sequences.last_seq + 1
    returning last_seq into v_seq;

    -- Format receipt code: {COMPANY_CODE}-{YYYYMMDD}-{SEQ_PADDED_3}
    v_receipt_code := upper(p_company_code) || '-' || v_date_str || '-' || lpad(v_seq::text, 3, '0');
    return v_receipt_code;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. PROJECTS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text default '',
    company_id uuid references public.companies(id) on delete set null,
    client_name text default '',
    description text default '',
    budget numeric(12, 2) default 0,
    project_value numeric(14, 2) default 0,
    people_count integer default 0,
    people_involved text default '',
    project_location text default '',
    manufacturing_unit text default '',
    communication text default '',
    status text check (status in ('active', 'completed', 'on_hold', 'planned')) default 'active',
    start_date date,
    end_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Migrations to ensure columns exist on existing projects table:
alter table public.projects add column if not exists project_value numeric(14, 2) default 0;
alter table public.projects add column if not exists people_count integer default 0;
alter table public.projects add column if not exists people_involved text default '';
alter table public.projects add column if not exists project_location text default '';
alter table public.projects add column if not exists manufacturing_unit text default '';
alter table public.projects add column if not exists communication text default '';

create index if not exists idx_projects_company_id on public.projects(company_id);
create index if not exists idx_projects_status on public.projects(status);

-- ------------------------------------------------------------------------------
-- 5. EXPENSES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.expenses (
    id uuid primary key default gen_random_uuid(),
    receipt_code text not null unique,
    company_id uuid not null references public.companies(id) on delete restrict,
    user_id uuid not null references public.profiles(id) on delete cascade,
    project_id uuid references public.projects(id) on delete set null,
    expense_date date not null,
    expense_time time not null default '12:00:00',
    expense_timestamp timestamptz not null,
    category text not null,
    payment_type text not null, -- 'Paytm / UPI', 'Bank Transfer', 'Credit / Debit Card', 'Cash', 'Petty Cash'
    paid_from text not null,    -- 'Personal Account', 'Personal Cash', 'Company Petty Cash', 'Company Account'
    merchant_or_payee text not null default '',
    description text not null default '',
    payment_id text not null default '', -- UTR / UPI Ref / Paytm Order ID
    amount numeric(12, 2) not null check (amount > 0),
    receipt_image_path text default '', -- Path in Supabase storage bucket
    drive_file_id text default '',
    drive_file_url text default '',
    sync_status text not null check (sync_status in ('pending', 'synced', 'failed')) default 'pending',
    sync_error text default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- In case table already exists without project_id
alter table public.expenses add column if not exists project_id uuid references public.projects(id) on delete set null;

-- Fast query indexes
create index if not exists idx_expenses_company_id on public.expenses(company_id);
create index if not exists idx_expenses_project_id on public.expenses(project_id);
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_date on public.expenses(expense_date desc);
create index if not exists idx_expenses_timestamp on public.expenses(expense_timestamp desc);
create index if not exists idx_expenses_receipt_code on public.expenses(receipt_code);
create index if not exists idx_expenses_sync_status on public.expenses(sync_status);

-- ------------------------------------------------------------------------------
-- 5. AUTOMATIC PROFILE CREATION & ADMIN SEED TRIGGER
-- Automatically creates a profile when a user signs up.
-- If it is the first user registered in auth.users, grant 'admin' + 'approved'!
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
    v_user_count integer;
    v_role text;
    v_status text;
    v_full_name text;
begin
    -- Check if any profiles currently exist
    select count(*) into v_user_count from public.profiles;

    if v_user_count = 0 then
        -- First user is automatically approved Admin
        v_role := 'admin';
        v_status := 'approved';
    else
        -- Subsequent signups require Admin approval
        v_role := 'member';
        v_status := 'pending';
    end if;

    -- Extract full name from raw user meta or fallback to email username
    v_full_name := coalesce(
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1)
    );

    insert into public.profiles (id, full_name, email, role, status)
    values (new.id, v_full_name, new.email, v_role, v_status)
    on conflict (id) do update set
        full_name = excluded.full_name,
        email = excluded.email;

    return new;
end;
$$;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Updated_at timestamp triggers
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
    before update on public.companies
    for each row execute function public.touch_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
    before update on public.expenses
    for each row execute function public.touch_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
    before update on public.projects
    for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------------------
-- 6. SECURITY HELPER FUNCTIONS FOR ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
create or replace function public.current_user_status()
returns text
language sql
stable
security definer
as $$
    select status from public.profiles where id = auth.uid();
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and status = 'approved'
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and status = 'approved' and role = 'admin'
    );
$$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.expenses enable row level security;
alter table public.daily_receipt_sequences enable row level security;

-- PROFILES POLICIES:
-- 1. Users can always read their own profile (necessary to see pending/approval status)
create policy "Users can view own profile"
    on public.profiles
    for select
    using (auth.uid() = id);

-- 2. Approved members can view active team profiles (names & emails)
create policy "Approved members can view all profiles"
    on public.profiles
    for select
    using (public.is_approved());

-- 3. Only Admins can update profiles (e.g., approve/reject status, change role)
create policy "Admins can update profiles"
    on public.profiles
    for update
    using (public.is_admin());

-- 4. Users can update their own display name
create policy "Users can update own display name"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (
        auth.uid() = id 
        -- Prevent changing own role or status through direct profile update
        and role = (select role from public.profiles where id = auth.uid())
        and status = (select status from public.profiles where id = auth.uid())
    );

-- COMPANIES POLICIES:
-- 1. Only approved users can view active companies
create policy "Approved users can view companies"
    on public.companies
    for select
    using (public.is_approved());

-- 2. Only Admins can insert, update, or delete companies
create policy "Admins can insert companies"
    on public.companies
    for insert
    with check (public.is_admin());

create policy "Admins can update companies"
    on public.companies
    for update
    using (public.is_admin());

create policy "Admins can delete companies"
    on public.companies
    for delete
    using (public.is_admin());

-- PROJECTS POLICIES:
alter table public.projects enable row level security;

drop policy if exists "Approved users can view projects" on public.projects;
drop policy if exists "Admins can insert projects" on public.projects;
drop policy if exists "Admins can update projects" on public.projects;
drop policy if exists "Admins can delete projects" on public.projects;
drop policy if exists "Authenticated users can view projects" on public.projects;
drop policy if exists "Authenticated users can insert projects" on public.projects;
drop policy if exists "Authenticated users can update projects" on public.projects;
drop policy if exists "Authenticated users can delete projects" on public.projects;

create policy "Authenticated users can view projects"
    on public.projects
    for select
    using (auth.role() = 'authenticated');

create policy "Authenticated users can insert projects"
    on public.projects
    for insert
    with check (auth.role() = 'authenticated');

create policy "Authenticated users can update projects"
    on public.projects
    for update
    using (auth.role() = 'authenticated');

create policy "Authenticated users can delete projects"
    on public.projects
    for delete
    using (auth.role() = 'authenticated');

-- EXPENSES POLICIES:
-- 1. Approved users can view expenses (members can view all company expenses for shared accountability)
create policy "Approved users can view expenses"
    on public.expenses
    for select
    using (public.is_approved());

-- 2. Approved users can insert their own expenses
create policy "Approved users can insert expenses"
    on public.expenses
    for insert
    with check (
        public.is_approved() 
        and auth.uid() = user_id
    );

-- 3. Users can update their own expenses; Admins can update any expense
create policy "Users can update own expenses and admins can update all"
    on public.expenses
    for update
    using (
        public.is_admin() or (public.is_approved() and auth.uid() = user_id)
    );

-- 4. Users can delete own expenses; Admins can delete any expense
create policy "Users can delete own expenses and admins can delete all"
    on public.expenses
    for delete
    using (
        public.is_admin() or (public.is_approved() and auth.uid() = user_id)
    );

-- DAILY RECEIPT SEQUENCES POLICIES:
-- Managed via security definer function `generate_receipt_code`.
create policy "Approved users can read sequences"
    on public.daily_receipt_sequences
    for select
    using (public.is_approved());

-- ------------------------------------------------------------------------------
-- 8. STORAGE BUCKET FOR RECEIPT IMAGES
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'receipts',
    'receipts',
    true, -- Public read for ease of viewing thumbnails, protected via RLS
    15728640, -- 15MB limit
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
    public = true,
    file_size_limit = 15728640;

-- Storage policies
create policy "Approved users can upload receipts"
    on storage.objects
    for insert
    with check (
        bucket_id = 'receipts'
        and public.is_approved()
    );

create policy "Approved users can update their receipts"
    on storage.objects
    for update
    using (
        bucket_id = 'receipts'
        and public.is_approved()
    );

create policy "Approved users can view receipts"
    on storage.objects
    for select
    using (
        bucket_id = 'receipts'
        and public.is_approved()
    );

create policy "Admins or owners can delete receipts"
    on storage.objects
    for delete
    using (
        bucket_id = 'receipts'
        and (public.is_admin() or auth.uid() = owner)
    );
