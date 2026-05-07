// Meshy 3D asset endpoint.
//
// GET  /api/meshy/asset?slug=hero
//   → returns cached asset row (creates it + kicks off a Meshy task on first hit
//     if MESHY_API_KEY is configured). If the task is still running, refreshes
//     its status from Meshy before responding.
//
// POST /api/meshy/asset
//   { slug, prompt, artStyle?, refresh? }
//   → upserts a slug→prompt mapping and kicks off a new Meshy task.
//     Requires CRON_SECRET via x-cron-secret header (admin-only).
//
// Cache table: hotties.meshy_assets (see supabase/meshy_assets.sql).

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { createTextTo3D, getTask, promptHash, type MeshyTask } from '@/lib/meshy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Default prompts for well-known slugs so the homepage works out of the box.
const DEFAULT_PROMPTS: Record<string, { prompt: string; artStyle?: 'realistic' | 'sculpture' }> = {
  hero: {
    prompt:
      'A glowing hot-pink neon tennis racket with a fluorescent yellow tennis ball balanced on the strings, sleek modern design, polished metallic frame, studio lighting, magenta rim light, transparent background',
    artStyle: 'realistic',
  },
  ball: {
    prompt:
      'A photorealistic fluorescent yellow tennis ball with white seams, slightly fuzzy felt surface, isolated on transparent background',
    artStyle: 'realistic',
  },
  trophy: {
    prompt:
      'A glossy hot-pink chrome tennis trophy cup with a small tennis ball on top, art deco base, neon Miami vibe',
    artStyle: 'realistic',
  },
};

interface AssetRow {
  id: string;
  slug: string;
  prompt: string;
  prompt_hash: string;
  art_style: string;
  task_id: string | null;
  status: string;
  glb_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  updated_at: string;
  completed_at: string | null;
}

function publicShape(a: AssetRow) {
  return {
    slug: a.slug,
    status: a.status,
    glb_url: a.glb_url,
    thumbnail_url: a.thumbnail_url,
    prompt: a.prompt,
    art_style: a.art_style,
    error: a.error_message,
    updated_at: a.updated_at,
    completed_at: a.completed_at,
  };
}

async function refreshFromMeshy(supabase: ReturnType<typeof getServiceClient>, row: AssetRow) {
  if (!row.task_id) return row;
  if (row.status === 'SUCCEEDED' || row.status === 'FAILED') return row;
  let task: MeshyTask;
  try {
    task = await getTask(row.task_id);
  } catch (e) {
    return row;
  }
  const updates: Partial<AssetRow> & { updated_at: string } = {
    status: task.status,
    updated_at: new Date().toISOString(),
  };
  if (task.status === 'SUCCEEDED') {
    updates.glb_url = task.model_urls?.glb ?? null;
    updates.thumbnail_url = task.thumbnail_url ?? null;
    updates.completed_at = new Date().toISOString();
  } else if (task.status === 'FAILED' || task.status === 'EXPIRED' || task.status === 'CANCELED') {
    updates.error_message = task.task_error?.message ?? task.status;
  }
  const { data } = await supabase
    .from('meshy_assets')
    .update(updates)
    .eq('id', row.id)
    .select('*')
    .single();
  return (data as AssetRow) ?? row;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const supabase = getServiceClient();
  const { data: existing } = await supabase
    .from('meshy_assets')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  // No row yet — try to auto-create from default prompt if we know this slug.
  if (!existing) {
    const def = DEFAULT_PROMPTS[slug];
    if (!def) return NextResponse.json({ error: 'unknown slug' }, { status: 404 });
    if (!process.env.MESHY_API_KEY) {
      return NextResponse.json({ slug, status: 'NOT_CONFIGURED' }, { status: 200 });
    }
    let taskId: string | null = null;
    let errMsg: string | null = null;
    try {
      taskId = await createTextTo3D({
        prompt: def.prompt,
        artStyle: def.artStyle ?? 'realistic',
        mode: 'preview',
      });
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }
    const { data: inserted } = await supabase
      .from('meshy_assets')
      .insert({
        slug,
        prompt: def.prompt,
        prompt_hash: promptHash(def.prompt, def.artStyle ?? 'realistic'),
        art_style: def.artStyle ?? 'realistic',
        task_id: taskId,
        status: taskId ? 'PENDING' : 'FAILED',
        error_message: errMsg,
      })
      .select('*')
      .single();
    return NextResponse.json(publicShape(inserted as AssetRow));
  }

  const refreshed = await refreshFromMeshy(supabase, existing as AssetRow);
  return NextResponse.json(publicShape(refreshed));
}

export async function POST(req: NextRequest) {
  // Admin-only — gated by CRON_SECRET so randoms can't burn Meshy credits.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | { slug?: string; prompt?: string; artStyle?: 'realistic' | 'sculpture'; refresh?: boolean }
    | null;
  if (!body?.slug || !body.prompt) {
    return NextResponse.json({ error: 'slug and prompt required' }, { status: 400 });
  }
  if (!process.env.MESHY_API_KEY) {
    return NextResponse.json({ error: 'MESHY_API_KEY not configured' }, { status: 500 });
  }

  const supabase = getServiceClient();
  const artStyle = body.artStyle ?? 'realistic';
  const hash = promptHash(body.prompt, artStyle);

  const { data: existing } = await supabase
    .from('meshy_assets')
    .select('*')
    .eq('slug', body.slug)
    .maybeSingle();

  // If the prompt is unchanged and we already have a finished asset, no-op
  // unless `refresh: true` is requested.
  if (existing && (existing as AssetRow).prompt_hash === hash && !body.refresh) {
    const refreshed = await refreshFromMeshy(supabase, existing as AssetRow);
    return NextResponse.json({ reused: true, asset: publicShape(refreshed) });
  }

  const taskId = await createTextTo3D({ prompt: body.prompt, artStyle, mode: 'preview' });

  if (existing) {
    const { data } = await supabase
      .from('meshy_assets')
      .update({
        prompt: body.prompt,
        prompt_hash: hash,
        art_style: artStyle,
        task_id: taskId,
        status: 'PENDING',
        glb_url: null,
        thumbnail_url: null,
        error_message: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as AssetRow).id)
      .select('*')
      .single();
    return NextResponse.json({ reused: false, asset: publicShape(data as AssetRow) });
  }

  const { data } = await supabase
    .from('meshy_assets')
    .insert({
      slug: body.slug,
      prompt: body.prompt,
      prompt_hash: hash,
      art_style: artStyle,
      task_id: taskId,
      status: 'PENDING',
    })
    .select('*')
    .single();
  return NextResponse.json({ reused: false, asset: publicShape(data as AssetRow) });
}
