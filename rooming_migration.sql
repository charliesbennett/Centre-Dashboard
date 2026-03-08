-- Rooming module migration
-- Run in Supabase SQL editor (Database > SQL Editor > New query)

-- Houses per centre
create table if not exists rooming_houses (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid references centres(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Rooms within houses
create table if not exists rooming_rooms (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid references centres(id) on delete cascade,
  house_id uuid references rooming_houses(id) on delete cascade,
  floor_label text default '',
  room_name text not null,
  capacity int default 2,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Individual bed slot assignments (one row per named occupant)
create table if not exists rooming_assignments (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid references centres(id) on delete cascade,
  room_id uuid references rooming_rooms(id) on delete cascade,
  slot_index int default 0,
  occupant_name text default '',
  group_id uuid references groups(id) on delete set null,
  occupant_type text default 'student',
  notes text default '',
  created_at timestamptz default now()
);

-- Enable RLS (match existing tables pattern)
alter table rooming_houses enable row level security;
alter table rooming_rooms enable row level security;
alter table rooming_assignments enable row level security;

-- Permissive policies (match existing pattern - anon read/write)
create policy "Allow all rooming_houses" on rooming_houses for all using (true) with check (true);
create policy "Allow all rooming_rooms" on rooming_rooms for all using (true) with check (true);
create policy "Allow all rooming_assignments" on rooming_assignments for all using (true) with check (true);

-- Overview overrides are stored in existing programme_settings table
-- as setting_key = 'rooming_overrides', setting_value = JSON string
-- No migration needed for that.
