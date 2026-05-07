// Meshy AI text-to-3D client. Docs: https://docs.meshy.ai/
// Used by /api/meshy/* to generate cached 3D assets that <model-viewer> renders
// in the browser. The MESHY_API_KEY env var is injected by Doppler.

const BASE = 'https://api.meshy.ai/openapi/v2';

export interface MeshyTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'EXPIRED';
  progress?: number; // 0-100
  prompt?: string;
  art_style?: string;
  thumbnail_url?: string | null;
  model_urls?: {
    glb?: string | null;
    fbx?: string | null;
    obj?: string | null;
    usdz?: string | null;
  } | null;
  task_error?: { message?: string } | null;
  created_at?: number;
  finished_at?: number;
}

export interface CreateTextTo3DOptions {
  prompt: string;
  artStyle?: 'realistic' | 'sculpture';
  mode?: 'preview' | 'refine';
  negativePrompt?: string;
  seed?: number;
  // For mode='refine' — the SUCCEEDED preview task id to refine.
  previewTaskId?: string;
}

function authHeaders(): HeadersInit {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error('MESHY_API_KEY is not set (configured via Doppler).');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

/** Kick off a text-to-3D task. Returns the Meshy task id. */
export async function createTextTo3D(opts: CreateTextTo3DOptions): Promise<string> {
  const body: Record<string, unknown> = {
    mode: opts.mode ?? 'preview',
    prompt: opts.prompt,
    art_style: opts.artStyle ?? 'realistic',
  };
  if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt;
  if (opts.seed !== undefined) body.seed = opts.seed;
  if (opts.mode === 'refine' && opts.previewTaskId) {
    body.preview_task_id = opts.previewTaskId;
  }

  const res = await fetch(`${BASE}/text-to-3d`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meshy create failed (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as { result: string };
  return json.result;
}

/** Fetch a Meshy task's current status + asset URLs. */
export async function getTask(taskId: string): Promise<MeshyTask> {
  const res = await fetch(`${BASE}/text-to-3d/${taskId}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meshy get failed (${res.status}): ${txt}`);
  }
  return (await res.json()) as MeshyTask;
}

/** Stable hash for prompt-based cache keys. */
export function promptHash(prompt: string, artStyle = 'realistic'): string {
  // Tiny non-cryptographic hash; collisions don't matter, this is just a cache key.
  const s = `${artStyle}::${prompt.trim().toLowerCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}
