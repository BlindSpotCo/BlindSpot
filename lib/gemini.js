// Shared Gemini model list and request helper.
//
// On 18 Sep 2026 Google limited the 2.5 models to projects that had already
// been using them ("For any new projects, use our latest models: 3.5
// Flash-Lite or 3.8 Flash"). Every route here asked only for 2.5 models, so
// on a key without that history every call failed and every report shipped
// with no written text and no image captions. The current models go first
// now; 2.5 stays last for keys that still have it.
//
// GEMINI_MODELS (comma-separated env var) overrides the list without a
// redeploy of code, for the next time this happens.
export const GEMINI_MODELS = (process.env.GEMINI_MODELS || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
  .concat((process.env.GEMINI_MODELS ? [] : ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']));

// Captions are a small, simple job: the fast Flash-Lite goes first there,
// which also keeps them off the Flash quota the written report needs.
export const GEMINI_MODELS_LITE_FIRST = [
  ...GEMINI_MODELS.filter((m) => /lite/.test(m)),
  ...GEMINI_MODELS.filter((m) => !/lite/.test(m)),
];

// Models this server instance has been told it can't use (404 not found,
// 403 no access). Skipped for the rest of the instance's life instead of
// costing a round trip on every call.
export const deadModels = new Set();

// How long a 429 asks us to wait, from the RetryInfo detail, in ms.
export function retryDelayMs(errText) {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(errText || '');
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
}

// One line describing a failed response, for logs and for the reason the
// browser console shows.
export function describeFailure(model, status, errText) {
  let msg = '';
  try { msg = JSON.parse(errText)?.error?.message || ''; } catch {}
  return `${status} ${model}${msg ? `: ${msg.slice(0, 160)}` : ''}`;
}

export const geminiUrl = (model) =>
  `${process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`;

// The 3.x models control thinking with thinkingLevel, not thinkingBudget,
// and think by default -- which spends the output-token allowance before
// any text is written. So on those: budget 0 becomes the lowest level, and
// a call that set nothing gets 'low' so the text isn't starved.
function adaptConfig(model, generationConfig) {
  const cfg = { ...(generationConfig || {}) };
  if (!/^gemini-3/.test(model)) return cfg;
  const tc = cfg.thinkingConfig;
  if (!tc || tc.thinkingBudget === 0) cfg.thinkingConfig = { thinkingLevel: tc ? 'minimal' : 'low' };
  return cfg;
}

// POST one generateContent request. If the model rejects the thinking
// settings (400 mentioning thinking), it is retried once without them and
// with more output room. Returns the fetch Response.
export async function fetchGemini(model, { contents, generationConfig, signal } = {}) {
  const send = (cfg) => fetch(`${geminiUrl(model)}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: cfg }),
    signal,
  });
  const cfg = adaptConfig(model, generationConfig);
  const res = await send(cfg);
  if (res.status !== 400 || !cfg.thinkingConfig) return res;
  const text = await res.text();
  if (!/thinking/i.test(text)) return new Response(text, { status: res.status, headers: res.headers });
  const { thinkingConfig, ...rest } = cfg;
  return send({ ...rest, maxOutputTokens: (rest.maxOutputTokens || 4096) + 8192 });
}
