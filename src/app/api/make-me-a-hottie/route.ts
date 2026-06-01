import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const POSES = [
  'walking confidently toward camera, racket over shoulder',
  'looking over shoulder with a smirk, racket in hand',
  'sitting courtside on a bench, legs crossed, holding racket loosely',
  'leaning against a chain-link fence, arms folded, racket resting against fence',
  'mid-serve motion, arm extended overhead, powerful stance',
  'mid-forehand swing, full rotation, explosive power',
  'mid-backhand, perfect two-handed form, focused expression',
  'adjusting a visor or headband, glancing at camera',
  'holding racket over shoulder casually, relaxed confident stance',
  'resting on a bench after a match, towel around neck',
  'laughing and smiling with racket in hand, joyful energy',
  'picking up tennis balls from the court, playful bend',
  'tying shoes courtside, glancing up at camera',
  'drinking water courtside, refreshed and glowing',
  'victory pose after winning, fist pump or arms raised',
  'dynamic action shot, sprinting toward a ball',
  'casual candid moment, fixing hair while holding racket',
  'spinning racket in hand, showing off skill',
  'stretching arms before a match, warming up',
  'pointing racket at camera with a playful challenge expression',
];

const BACKGROUNDS = [
  'luxury rooftop tennis club with city skyline at golden hour',
  'palm-lined courts at sunset, warm amber and pink sky',
  'Miami-style open-air tennis venue, lush tropical surroundings',
  'Beverly Hills private country club, manicured hedges and white architecture',
  'modern glass-and-steel city courts with glowing skyscrapers at night',
  'coastal tennis resort overlooking the ocean, breezy and bright',
  'packed stadium under dramatic stadium lights, night match atmosphere',
  'tropical tennis club surrounded by flowering vines and soft lanterns',
  'sleek indoor luxury tennis facility with polished floors and warm lighting',
  'red European clay courts framed by cypress trees and terracotta villas',
  'Japanese-inspired tennis venue with cherry blossoms and lanterns',
  'desert sunset courts, orange and purple sky, distant mountains',
  'high-end private club with ivy-covered walls and perfectly groomed court',
  'neon-lit evening court with glowing pink and purple light reflections',
  'rain-reflection court after a match, wet surface reflecting city lights',
];

const SLOGANS = [
  'Pretty. Focused. Unstoppable.',
  'Serve Looks.',
  'Love All. Hit Hard.',
  'Built Different.',
  'Good Vibes. Great Tennis.',
  'Court Crush.',
  'Confidence Wins.',
  'Strong Looks Good.',
  'Racquets & Red Flags.',
  'Hot Serve Summer.',
  'Main Character Energy.',
  'Flirting With The Baseline.',
  'Cute But Competitive.',
  'Stay Golden.',
  'Play Bold.',
  'Match Point Mentality.',
  'Sunshine & Topspin.',
  'Tennis Is My Love Language.',
  'Serving Confidence.',
  'Looks Like A Winner.',
  'Catch Me At The Net.',
  'Better Every Set.',
  'Court Side Energy.',
  'Winning Is Attractive.',
];

const CAMERA_ANGLES = [
  'slightly low angle, heroic and powerful perspective',
  'eye-level, intimate and direct',
  'three-quarter view, cinematic portrait angle',
  'slightly high angle, graceful and editorial',
  'dramatic side profile, strong and focused',
  'over-the-shoulder looking forward',
  'wide establishing shot with subject prominent in foreground',
  'tight portrait framing, face and upper body fill the frame',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPrompt(): string {
  const pose = pick(POSES);
  const background = pick(BACKGROUNDS);
  const slogan = pick(SLOGANS);
  const angle = pick(CAMERA_ANGLES);

  return `Create a highly detailed modern anime illustration based on the uploaded person's facial features, hair, skin tone, and overall likeness.

STYLE:
Premium contemporary anime aesthetic. Attractive, confident, stylish, aspirational. Similar quality level to high-end sports anime promotional artwork. Cinematic lighting, vibrant colors, glossy highlights. Clean face rendering with strong resemblance to the uploaded photo. Fashionable and athletic rather than exaggerated. Adult subjects only.

POSE:
${pose}.

BACKGROUND:
${background}.

CAMERA ANGLE:
${angle}.

WARDROBE:
Fashionable tennis-inspired outfit — could be a modern tennis dress, tennis skirt with crop top, performance tennis apparel, country-club chic, or luxury athletic fashion. Use a coordinated color palette that complements the scene.

BRAND ELEMENT:
Somewhere in the background include a tasteful design element (neon sign, mural, scoreboard, banner, or wall art) that reads exactly: "${slogan}"

COMPOSITION:
Social-media profile-photo friendly. Strong focal point on the subject. Dynamic depth and cinematic lighting. Premium lifestyle aesthetic. Subject feels confident, social, athletic, and approachable.

QUALITY:
Exactly two arms. Exactly two hands. Correct anatomy. Correct racket grip. Natural fingers. Natural facial proportions. No duplicated limbs. No extra fingers. Preserve major identifying features from the uploaded photo including hair color, eye color, skin tone, and facial structure.`;
}

export async function POST(req: NextRequest) {
  // Accept multipart/form-data with an "image" field
  let imageFile: File | null = null;

  try {
    const form = await req.formData();
    const raw = form.get('image');
    if (raw instanceof File && raw.size > 0) {
      imageFile = raw;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  if (!imageFile) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Enforce 8 MB cap to avoid runaway costs
  if (imageFile.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 8 MB)' }, { status: 413 });
  }

  const prompt = buildPrompt();

  try {
    const openai = getOpenAI();

    // gpt-image-1 supports image inputs via images.edit and returns base64
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      n: 1,
      size: '1024x1024',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('No image returned from OpenAI');
    }

    return NextResponse.json({ image: b64 });
  } catch (err) {
    console.error('[make-me-a-hottie]', err);
    const msg = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
