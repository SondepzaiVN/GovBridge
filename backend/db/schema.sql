-- GovBridge security-first database schema draft.
-- Step 1 uses the backend auth store as a transition layer; this schema is the
-- target for the next migration to PostgreSQL.

create table if not exists agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province_code text,
  district_code text,
  ward_code text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  email text unique,
  phone text unique,
  citizen_id_hash text unique,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('nguoi-dan', 'can-bo', 'admin')),
  status text not null default 'active' check (status in ('active', 'locked', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists citizen_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  citizen_id_encrypted text,
  date_of_birth date,
  address_encrypted text,
  verified_level text not null default 'self_registered',
  updated_at timestamptz not null default now()
);

create table if not exists officer_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  agency_id uuid not null references agencies(id),
  position text,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists applications (
  id text primary key,
  owner_user_id uuid not null references users(id),
  service_id text not null,
  receiving_agency_id uuid references agencies(id),
  status text not null,
  data_json jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_applications_owner on applications(owner_user_id);
create index if not exists idx_applications_agency_status on applications(receiving_agency_id, status);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  application_id text references applications(id) on delete cascade,
  owner_user_id uuid not null references users(id),
  storage_key text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  checksum_sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_owner on attachments(owner_user_id);
create index if not exists idx_attachments_application on attachments(application_id);

create table if not exists auth_sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_auth_sessions_user on auth_sessions(user_id);
create index if not exists idx_auth_sessions_expires_at on auth_sessions(expires_at);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  action text not null,
  resource_type text not null,
  resource_id text not null,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_resource on audit_logs(resource_type, resource_id);
create index if not exists idx_audit_logs_actor on audit_logs(actor_user_id);
