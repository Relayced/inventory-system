-- Allow admins (profiles.role = 'admin') to read all sales/history data
-- Run this in Supabase SQL Editor.

-- Ensure RLS is enabled
alter table if exists sales enable row level security;
alter table if exists sale_items enable row level security;

-- Admins can read all sales
create policy if not exists "Admin can read all sales"
on sales
for select
using (
  exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- Admins can read all sale_items
create policy if not exists "Admin can read all sale_items"
on sale_items
for select
using (
  exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
