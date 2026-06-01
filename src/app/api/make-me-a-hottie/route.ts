import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';

export const runtime = 'nodejs';
// gpt-image-1 edits routinely take 60-120s. Vercel Pro allows up to 300s.
export const maxDuration = 300;

type Gender = 'female' | 'male';

const POSES = [
  'walking confidently toward camera, racket over shoulder, fierce eye contact',
  'looking over shoulder with a sultry smirk, racket in hand',
  'sitting courtside on a bench, legs crossed elegantly, holding racket loosely',
  'leaning against a chain-link fence, arms folded, racket resting against fence, smouldering gaze',
  'mid-serve motion, arm extended overhead, powerful athletic stance',
  'mid-forehand swing, full rotation, explosive power, muscles defined',
  'mid-backhand, perfect two-handed form, focused intense expression',
  'adjusting a visor or headband, glancing at camera through lashes',
  'holding racket over shoulder casually, relaxed confident stance, slight head tilt',
  'resting on a bench after a match, towel around neck, glistening skin',
  'laughing softly with racket in hand, candid magnetic energy',
  'picking up tennis balls from the court, playful but graceful bend',
  'kneeling to tie shoes courtside, glancing up at camera with intensity',
  'drinking water courtside, refreshed and glowing, golden hour light on skin',
  'victory pose after winning, arms raised, triumphant and powerful',
  'dynamic action shot, sprinting toward a ball, hair and clothing in motion',
  'casual candid moment, fixing hair while holding racket, soft seductive expression',
  'spinning racket in hand, showing off skill with a confident half-smile',
  'stretching arms before a match, warming up, lean defined physique on display',
  'pointing racket at camera with a playful challenge expression and raised eyebrow',
];

const BACKGROUNDS = [
  'luxury rooftop tennis club with city skyline at golden hour, warm rim light',
  'palm-lined courts at sunset, warm amber and pink sky, lens flare',
  'Miami-style open-air tennis venue, lush tropical surroundings, neon accents',
  'Beverly Hills private country club, manicured hedges and white architecture, soft afternoon light',
  'modern glass-and-steel city courts with glowing skyscrapers at night, dramatic shadows',
  'coastal tennis resort overlooking the ocean, breezy and bright, salt-air haze',
  'packed stadium under dramatic floodlights, night match atmosphere, deep cinematic shadows',
  'tropical tennis club surrounded by flowering vines and soft lanterns, dusk glow',
  'sleek indoor luxury tennis facility with polished floors and warm moody lighting',
  'red European clay courts framed by cypress trees and terracotta villas, Tuscan light',
  'Japanese-inspired tennis venue with cherry blossoms, lanterns and a full moon',
  'desert sunset courts, orange and purple sky, distant mountains, long shadows',
  'high-end private club with ivy-covered walls and perfectly groomed court, golden light',
  'neon-lit evening court with glowing pink and purple light reflections on wet surface',
  'rain-reflection court after a match, wet surface reflecting city lights, cinematic mood',
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
  'wide establishing shot with subject prominent in foreground, shallow depth of field',
  'tight portrait framing, face and upper body fill the frame, bokeh background',
];

const FEMALE_WARDROBE = [
  'sleek black tennis crop top with a short pleated tennis skirt, athletic and form-fitting',
  'fitted white sports bra under an open sheer black blouse with a leather mini skirt and ankle boots, country-club night-out energy',
  'monochrome neon pink tennis dress hugging an athletic figure, designer label aesthetic',
  'minimalist white tennis dress with subtle gold detailing, elegant and toned',
  'pastel coordinated set — sports bra and tennis skirt — luxe athleisure',
  'all-black performance set with a fitted tank and skort, sleek and powerful',
  'open black silk shirt over a tennis bra and skirt, sultry off-duty player look',
  'cropped polo and pleated skirt in coordinated tones, preppy and athletic',
];

const MALE_WARDROBE = [
  'fitted black athletic polo and tailored tennis shorts, broad shoulders, defined arms',
  'sleeveless performance shirt and athletic shorts showing toned arms and chest, fit and powerful',
  'open white linen shirt over a fitted tank with athletic shorts, country-club off-duty energy',
  'monochrome black performance tee tucked into tennis shorts, sleek and athletic',
  'classic white polo with subtle accent stripe and tailored athletic shorts, preppy and strong',
  'navy or hunter green athletic polo with white shorts, classic tennis-club look, muscular build',
  'fitted athletic henley with sleeves pushed up and tennis shorts, rugged and confident',
  'compression top under an unzipped track jacket with athletic shorts, lean defined physique',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPrompt(gender: Gender): string {
  const pose = pick(POSES);
  const background = pick(BACKGROUNDS);
  const slogan = pick(SLOGANS);
  const angle = pick(CAMERA_ANGLES);
  const wardrobe = gender === 'female' ? pick(FEMALE_WARDROBE) : pick(MALE_WARDROBE);

  const genderDirective =
    gender === 'female'
      ? 'The subject is an ADULT WOMAN. Render with feminine features and a fit, athletic, elegant female figure. Never put the subject in masculine attire.'
      : 'The subject is an ADULT MAN. Render with masculine features, a strong jawline, and a fit, athletic, muscular male physique. NEVER put the subject in a skirt, dress, crop top, sports bra, or any feminine clothing. Men wear athletic shorts, polos, performance shirts, or tank tops only.';

  return `Transform the uploaded person into a high-end, semi-realistic modern anime portrait. Keep their face, hair, skin tone, eye color and facial structure clearly recognizable — this should look like THEM, just stylized.

SUBJECT GENDER (CRITICAL — DO NOT IGNORE):
${genderDirective}

STYLE:
Premium semi-realistic anime / cinematic illustration — closer to high-end Japanese promotional art or a luxury sports-fashion editorial than cartoonish comic art. Painterly textures, soft realistic skin shading, glossy highlights, subtle film grain, photographic depth-of-field, cinematic color grading. Sultry, alluring, aspirational, magazine-cover quality. Confident and sexy without being lewd. Fit, toned, athletic body. Adult subject only.

POSE:
${pose}.

BACKGROUND:
${background}.

CAMERA ANGLE:
${angle}.

WARDROBE (must match the SUBJECT GENDER above):
${wardrobe}. The outfit should flatter the body and look expensive, sleek, and tennis-appropriate. Coordinate the palette with the scene.

BRAND ELEMENT:
Include exactly ONE tasteful design element somewhere in the background — a neon sign, mural, scoreboard, banner, projected text, or wall art — that reads exactly: "${slogan}". Use a stylish typeface that fits the scene. Do not repeat the slogan; do not add other readable text.

COMPOSITION:
Social-media profile-photo worthy. Strong focal point on the subject. Dynamic depth, cinematic lighting, glow and rim light on the body. Premium lifestyle aesthetic. Subject should look confident, magnetic, sultry, athletic, alluring — like the cover of a luxury tennis magazine.

QUALITY CONTROLS:
Exactly two arms. Exactly two hands. Five fingers per hand. Correct racket grip. Realistic anatomy and proportions. Preserve major identifying features from the uploaded photo (hair color, eye color, skin tone, facial structure, visible tattoos). No duplicated limbs. No extra fingers. No background crowds. No childlike features. No comic-book outlines or flat cel-shading — keep it painterly and semi-realistic.`;
}

export async function POST(req: NextRequest) {
  let imageFile: File | null = null;
  let gender: Gender = 'female';

  try {
    const form = await req.formData();
    const raw = form.get('image');
    const rawGender = form.get('gender');
    if (raw instanceof File && raw.size > 0) {
      imageFile = raw;
    }
    if (rawGender === 'male' || rawGender === 'female') {
      gender = rawGender;
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

  const prompt = buildPrompt(gender);

  try {
    const openai = getOpenAI();

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
