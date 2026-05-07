-- Hotties That Hit: Meshy 3D asset cache.
-- Stores generated text-to-3D models so we don't re-burn API credits per page load.

create table if not exists hotties.meshy_assets (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,                 -- stable label, e.g. 'hero', 'court-vibe-griffith'
  prompt text not null,
  prompt_hash text not null,                 -- hash of prompt+art_style for cache invalidation
  art_style text not null default 'realistic',
  task_id text,                              -- Meshy preview task id
  refine_task_id text,                       -- Meshy refine task id (optional, higher quality)
  status text not null default 'PENDING',    -- mirrors Meshy task status
  glb_url text,
  fbx_url text,
  usdz_url text,
  thumbnail_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists meshy_assets_status_idx on hotties.meshy_assets (status);
create index if not exists meshy_assets_prompt_hash_idx on hotties.meshy_assets (prompt_hash);

grant select on hotties.meshy_assets to anon, authenticated;
grant all on hotties.meshy_assets to service_role;
