// app/api/floor-plan/analyze/route.js
// Accepts an uploaded floor-plan file (PDF/JPG/PNG), converts it to an
// image if needed, and asks Gemini Vision for a structured room-by-room
// furnishing breakdown — reuses the SAME GEMINI_API_KEY and calling
// pattern as /api/sunscout/report/analyse, so no new env var or provider
// is needed. Runs server-side only -- this does not call out to any
// external floor-plan service.

import { NextResponse } from 'next/server';
import { fileToImageDataUrl, FloorPlanInputError } from '@/lib/floorplan/toImage';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const PROMPT_BASE = `You are a senior interior designer looking at an uploaded floor plan image, briefed to design this specific home in real depth — not a generic checklist. Your goal is to help build this person's dream home within the real constraints of this exact layout.

Identify every distinct labeled or clearly-implied room/space in the plan (bedroom, living room, kitchen, dining, bathroom, balcony, study, etc). For EACH room, go deep — the way a real designer would present a room concept to a client:

- A vivid, specific vision for the room: what it could feel like once done, given its shape, light, and where it sits in the home (2-4 sentences, not a generic platitude).
- A colour and material palette for that room: wall colour/finish, one or two accent colours, and a textile/material direction (e.g. "warm terracotta walls, brass accents, natural linen and jute textures") — grounded in the room's light and purpose, not copy-pasted across rooms.
- A full furniture list: each piece with WHERE exactly to place it relative to doors/windows/walls visible in the plan and WHY, a rough size guidance so it actually fits this room (e.g. "a sofa no deeper than 90cm here to keep the walkway clear"), and a material/finish suggestion.
- A lighting plan: ambient, task, and accent lighting specific to this room's use and natural light.
- Textiles & decor: rug, curtains/blinds, art/decor, and greenery suggestions that fit the room's palette and light.
- One alternative furniture arrangement for this room, briefly described, in case the primary layout doesn't suit them.
- Any real layout cautions (blocked traffic flow, awkward corners, a door that would hit furniture, poor natural light for the suggested use, etc).

Then, for the WHOLE home: write a short, warm, specific paragraph painting what the finished home could feel like walking through it room to room (not generic real-estate copy — reference actual rooms and how they connect), describe a cohesive colour/material story that ties the rooms together as one coherent home rather than disconnected rooms, and give an ordered, practical shopping/setup priority list (what to invest in and do first, what can wait).

Also estimate, for each room, a "pin" position: the (x, y) point at the visual center of that room in the image, as a FRACTION of the image width and height (0 = left/top edge, 1 = right/bottom edge, e.g. a room in the upper-left quadrant might be x:0.22, y:0.28). This is used to place a marker on top of the image, so it must correspond to where that room actually sits in the picture.

If room dimensions are labeled on the plan, use them. If not, only give a rough relative sense of size (e.g. "appears compact, roughly 10x10ft") and do not invent a false-precision number. Same discipline everywhere: be specific and concrete, but never invent a fact (an exact price, an exact measurement) the plan doesn't actually support — hedge honestly instead.`;

const PROMPT_JSON_SHAPE = `Respond with ONLY valid JSON, no markdown code fences, no preamble or trailing text, matching exactly this shape:

{
  "dream_home_vision": "a warm, specific 3-5 sentence paragraph painting the finished home room-to-room, referencing actual rooms from this plan",
  "whole_home_palette": "2-3 sentences on the colour/material story tying every room together into one coherent home",
  "shopping_priority": ["string — ordered, e.g. '1. Sofa and dining table — anchor pieces, get these first' ... include 4-8 items"],
  "rooms": [
    {
      "name": "string, e.g. Living Room",
      "pin": { "x": 0.0-1.0, "y": 0.0-1.0 },
      "dimensions_note": "string — labeled size, or a rough relative estimate with a caveat, or null if truly unreadable",
      "vibe": "2-4 vivid, specific sentences on what this room could feel like",
      "color_palette": { "walls": "string", "accents": "string", "textiles": "string" },
      "furniture": [
        { "item": "string", "placement": "string — where and why", "size_guidance": "string, rough size/clearance guidance so it fits this room, or omit if not applicable", "material": "string, finish/material suggestion, or omit", "note": "string, optional extra tip, or omit" }
      ],
      "lighting_plan": ["string — 2-4 tips covering ambient/task/accent lighting for this room"],
      "textiles_and_decor": ["string — 2-4 tips: rug, curtains/blinds, art/decor, greenery"],
      "alternative_layout": "string — one alternate furniture arrangement idea, briefly described, or omit if the room is too small to vary",
      "cautions": ["string — any real layout issue specific to this room, omit array if none"]
    }
  ],
  "layout_notes": ["string — whole-plan observations: traffic flow, natural light path, awkward adjacencies, etc"],
  "preference_notes": ["string — one entry per requested style/space-feel/must-have, saying plainly where and how it was worked in, OR — if it genuinely doesn't fit this layout well — saying so honestly and why, instead of forcing it in somewhere unrealistic. Omit this array entirely if no preferences were given."],
  "confidence_note": "one honest sentence on how legible/labeled this particular plan was, and what that means for how much to trust the above"
}

If the image is not a floor plan at all, return {"rooms": [], "layout_notes": [], "confidence_note": "This does not appear to be a floor plan."} and nothing else.`;

function buildPrompt(preferences) {
  let prefBlock = '';
  if (preferences) {
    const lines = [];
    if (preferences.style && preferences.style !== 'No preference') lines.push(`Preferred style: ${preferences.style}`);
    if (preferences.spaceFeel && preferences.spaceFeel !== 'No preference') lines.push(`Preferred space feel: ${preferences.spaceFeel}`);
    if (Array.isArray(preferences.mustHaves) && preferences.mustHaves.length) lines.push(`Must-have items/features to try to fit in somewhere sensible: ${preferences.mustHaves.join(', ')}`);
    if (preferences.notes && preferences.notes.trim()) lines.push(`Additional notes from the homeowner: ${preferences.notes.trim()}`);
    if (lines.length) {
      prefBlock = `\n\nTHE HOMEOWNER'S PREFERENCES — everyone's dream home is different, so tailor every room's furniture and style suggestions around these where the layout genuinely allows it. Do not force a must-have into a room where it would not realistically fit or would create a real problem (blocking a door, no clearance, wrong room type) — instead say so honestly in preference_notes and suggest the closest reasonable alternative if one exists.\n${lines.map(l => `- ${l}`).join('\n')}`;
    }
  }
  return `${PROMPT_BASE}${prefBlock}\n\n${PROMPT_JSON_SHAPE}`;
}

function extractJson(text) {
  if (!text) return null;
  let cleaned = text.trim();
  // Defensive: strip markdown fences even though the prompt asks for none —
  // vision models occasionally add them anyway.
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampPin(pin) {
  if (!pin || typeof pin.x !== 'number' || typeof pin.y !== 'number') return { x: 0.5, y: 0.5 };
  return { x: Math.min(1, Math.max(0, pin.x)), y: Math.min(1, Math.max(0, pin.y)) };
}

export async function POST(req) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Server is missing GEMINI_API_KEY — cannot run floor-plan analysis.' },
      { status: 500 }
    );
  }

  let imageDataUrl;
  let preferences = null;
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    imageDataUrl = await fileToImageDataUrl(file);
    const prefRaw = formData.get('preferences');
    if (prefRaw) {
      try { preferences = JSON.parse(prefRaw); } catch { preferences = null; }
    }
  } catch (err) {
    if (err instanceof FloorPlanInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Floor plan file handling failed:', err);
    return NextResponse.json({ error: 'Could not read that file. Please try a clearer PDF, JPG, or PNG.' }, { status: 400 });
  }

  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  const inlineData = { mimeType: match[1], data: match[2] };
  const contents = [{ role: 'user', parts: [{ text: buildPrompt(preferences) }, { inlineData }] }];

  let data = null;
  let rawText = '';
  try {
    const callGemini = async (msgContents) => {
      for (const model of GEMINI_MODELS) {
        const res = await fetch(`${GEMINI_URL(model)}?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: msgContents,
            generationConfig: { maxOutputTokens: 32768, temperature: 0.3 },
          }),
        });
        if (res.ok) return res.json();
        const errText = await res.text();
        console.error(`Gemini Vision request failed (${model}):`, res.status, errText);
        if (res.status !== 429) return null;
      }
      return null;
    };

    data = await callGemini(contents);
    if (data) {
      let candidate = data?.candidates?.[0];
      rawText = candidate?.content?.parts?.[0]?.text || '';
      let finishReason = candidate?.finishReason;

      // The much richer per-room detail this now asks for can run long
      // enough to hit the token cap mid-JSON — if so, ask Gemini to
      // continue exactly where it left off and stitch the raw text
      // together before parsing, same continuation pattern used by
      // /api/sunscout/report/analyse for its (much longer) prose reports.
      let continuations = 0;
      while (finishReason === 'MAX_TOKENS' && continuations < 3) {
        continuations++;
        const followUpContents = [
          ...contents,
          { role: 'model', parts: [{ text: rawText }] },
          { role: 'user', parts: [{ text: 'Continue exactly where you left off, character-for-character, so the two pieces of text concatenate into one valid JSON document. Do not repeat anything already written, do not restart, do not add commentary.' }] },
        ];
        const contData = await callGemini(followUpContents);
        if (!contData) break;
        const contCandidate = contData?.candidates?.[0];
        const contText = contCandidate?.content?.parts?.[0]?.text || '';
        if (!contText) break;
        rawText += contText;
        finishReason = contCandidate?.finishReason;
      }
    }
  } catch (err) {
    console.error('Gemini Vision request errored:', err);
  }

  if (!data) {
    return NextResponse.json({ error: 'AI analysis request failed. Please try again in a moment.' }, { status: 502 });
  }

  const parsed = extractJson(rawText);

  if (!parsed) {
    return NextResponse.json({ error: 'Could not parse the AI response. Please try again.' }, { status: 502 });
  }

  const rooms = Array.isArray(parsed.rooms) ? parsed.rooms.map((r, i) => ({
    name: r.name || `Room ${i + 1}`,
    pin: clampPin(r.pin),
    dimensions_note: r.dimensions_note || null,
    vibe: r.vibe || r.style_suggestion || null,
    color_palette: r.color_palette && typeof r.color_palette === 'object' ? {
      walls: r.color_palette.walls || null,
      accents: r.color_palette.accents || null,
      textiles: r.color_palette.textiles || null,
    } : null,
    furniture: Array.isArray(r.furniture) ? r.furniture.filter(f => f && f.item).map(f => ({
      item: f.item,
      placement: f.placement || null,
      size_guidance: f.size_guidance || null,
      material: f.material || null,
      note: f.note || null,
    })) : [],
    lighting_plan: Array.isArray(r.lighting_plan) ? r.lighting_plan.filter(Boolean) : [],
    textiles_and_decor: Array.isArray(r.textiles_and_decor) ? r.textiles_and_decor.filter(Boolean) : [],
    alternative_layout: r.alternative_layout || null,
    cautions: Array.isArray(r.cautions) ? r.cautions.filter(Boolean) : [],
  })) : [];

  return NextResponse.json({
    imageDataUrl,
    dream_home_vision: parsed.dream_home_vision || null,
    whole_home_palette: parsed.whole_home_palette || null,
    shopping_priority: Array.isArray(parsed.shopping_priority) ? parsed.shopping_priority.filter(Boolean) : [],
    rooms,
    layout_notes: Array.isArray(parsed.layout_notes) ? parsed.layout_notes.filter(Boolean) : [],
    preference_notes: Array.isArray(parsed.preference_notes) ? parsed.preference_notes.filter(Boolean) : [],
    confidence_note: parsed.confidence_note || null,
  });
}
