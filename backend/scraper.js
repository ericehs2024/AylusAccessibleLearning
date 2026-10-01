// Volunteer Auto Logger — ported from aylus/backend/index.js
// Provides POST /api/scrape : { url, startDate, endDate, aliases } -> [{ name, hours, date, sourceUrl }]

const cheerio = require('cheerio');
const http = require('http');
const https = require('https');
const axios = require('axios');
const db = require('./db');

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 20, keepAliveMsecs: 1000 });
axios.defaults.httpAgent = new http.Agent({ keepAlive: true, maxSockets: 20, keepAliveMsecs: 1000 });
axios.defaults.httpsAgent = keepAliveAgent;

const pageCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        console.error(`[scrape] Error: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results.filter(r => r !== undefined);
}

async function fetchHtml(url, retries = 2) {
  const cached = pageCache.get(url);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.html;
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 12000,
        validateStatus: () => true,
      });
      if (response.status === 200 && response.data && response.data.length > 100) {
        pageCache.set(url, { html: response.data, time: Date.now() });
        return response.data;
      }
      console.log(`[fetch] Unexpected response: ${response.status} for ${url}`);
      if (attempt < retries) continue;
      return null;
    } catch (error) {
      console.log(`[fetch] Error: ${error.message} for ${url}`);
      if (attempt < retries) continue;
      return null;
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pageCache) {
    if (now - value.time > CACHE_TTL_MS) pageCache.delete(key);
  }
}, CACHE_TTL_MS);

function extractAllLinks($) {
  const results = [];
  const seen = new Set();
  $('div.entry-content script').remove();
  $('div.entry-content style').remove();
  $('div.entry-content li a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (href && text && !seen.has(href)) {
      seen.add(href);
      results.push({ url: href, text });
    }
  });
  console.log(`[links] Extracted ${results.length} links from div.entry-content li`);
  return results;
}

function extractContentText(html) {
  const $ = cheerio.load(html);
  $('#content script').remove();
  $('#content style').remove();
  let text = $('#content').text();
  if (!text.trim()) text = $('body').text();
  return text.replace(/\s+/g, ' ').trim();
}

const MONTH_NAMES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function extractActivityLinks(allLinks, pageUrl) {
  const results = [];
  const seen = new Set();
  const baseHref = new URL(pageUrl).href;
  const pageHost = new URL(pageUrl).hostname;
  for (const link of allLinks) {
    let absUrl;
    try { absUrl = new URL(link.url, pageUrl).href; } catch { continue; }
    if (absUrl === baseHref) continue;
    if (seen.has(absUrl)) continue;
    seen.add(absUrl);
    let linkHost;
    try { linkHost = new URL(absUrl).hostname; } catch { continue; }
    if (linkHost !== pageHost && !linkHost.endsWith('aylus.org')) continue;
    results.push({ url: absUrl, date: null, text: link.text });
  }
  console.log(`[act] Found ${results.length} activity links (date via Gemini classifier) - filtered external`);
  return results;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

let geminiQueue = Promise.resolve();
let lastGeminiCallAt = 0;
const GEMINI_MIN_INTERVAL_MS = 4200;
const GEMINI_TPM_BUDGET = 180000;
let geminiTokenWindow = [];
const GEMINI_RPD_MAX = 900;
const GEMINI_RPD_WARN = 750;
let geminiCallsToday = 0;
let geminiDayKey = new Date().toDateString();

function ensureGeminiDailyQuota() {
  const today = new Date().toDateString();
  if (today !== geminiDayKey) { geminiDayKey = today; geminiCallsToday = 0; }
  if (geminiCallsToday >= GEMINI_RPD_MAX) throw new Error('Daily Gemini quota reached, please try again tomorrow');
}
function countGeminiCall() {
  geminiCallsToday += 1;
  if (geminiCallsToday >= GEMINI_RPD_WARN) console.warn(`[gemini] WARNING: ${geminiCallsToday} calls today (hard limit ${GEMINI_RPD_MAX})`);
}
async function throttleGemini(promptTokens = 0) {
  const prev = geminiQueue;
  let release;
  geminiQueue = new Promise(r => { release = r; });
  await prev;
  try {
    const rpmWait = lastGeminiCallAt + GEMINI_MIN_INTERVAL_MS - Date.now();
    if (rpmWait > 0) {
      console.log(`[gemini] Throttling ${Math.ceil(rpmWait / 1000)}s to stay under RPM limit...`);
      await sleep(rpmWait);
    }
    const now = Date.now();
    geminiTokenWindow = geminiTokenWindow.filter(e => e.at > now - 60000);
    const windowTokens = geminiTokenWindow.reduce((sum, e) => sum + e.tokens, 0);
    if (windowTokens > 0 && windowTokens + promptTokens > GEMINI_TPM_BUDGET) {
      const oldest = geminiTokenWindow[0];
      const wait = oldest.at + 60000 - now;
      if (wait > 0) {
        console.log(`[gemini] Throttling ${Math.ceil(wait / 1000)}s for TPM budget (${windowTokens}+${promptTokens} est. tokens in window)`);
        await sleep(wait);
      }
    }
    geminiTokenWindow.push({ tokens: promptTokens, at: Date.now() });
    lastGeminiCallAt = Date.now();
  } finally { release(); }
}

// Retry hints from Google APIs: RetryInfo.retryDelay ("38s") in a 429/503 JSON
// body, or the Retry-After response header. Returns whole seconds or null.
function parseRetryAfterSec(bodyText, headers) {
  try {
    const ra = headers && typeof headers.get === 'function' ? headers.get('retry-after') : null;
    if (ra) {
      const secs = parseInt(String(ra).trim(), 10);
      if (Number.isFinite(secs) && secs >= 0) return secs;
      const when = Date.parse(ra);
      if (!Number.isNaN(when)) return Math.max(0, Math.ceil((when - Date.now()) / 1000));
    }
  } catch {}
  try {
    const details = JSON.parse(bodyText || '')?.error?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        const m = String(d?.retryDelay || '').trim().match(/^(\d+(?:\.\d+)?)s$/);
        if (m) return Math.max(0, Math.ceil(parseFloat(m[1])));
      }
    }
  } catch {}
  return null;
}

// Attach the server-asked wait to an error so it survives re-wrapping up the chain.
function withRetryAfterSec(err, secs) {
  if (err && Number.isFinite(secs) && secs >= 0) {
    if (!Number.isFinite(err.retryAfterSec) || secs > err.retryAfterSec) err.retryAfterSec = secs;
  }
  return err;
}

async function geminiCallWithRetry(prompt, pageUrl = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const maxRetries = 3;
  const GEMINI_TIMEOUT_MS = 90 * 1000;
  const GEMINI_PROMPT_MAX_CHARS = 750000;
  if (prompt.length > GEMINI_PROMPT_MAX_CHARS) throw new Error(`Prompt too large (${prompt.length} chars, max ${GEMINI_PROMPT_MAX_CHARS}); narrow the date range and retry`);
  ensureGeminiDailyQuota();
  const estTokens = Math.ceil(prompt.length / 3);
  let lastRetryAfterSec = null; // server-asked wait from 429/503 (RetryInfo.retryDelay / Retry-After header)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await throttleGemini(estTokens);
      countGeminiCall();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      let response;
      try {
        const useCodeExec = process.env.GEMINI_CODE_EXECUTION === 'true';
        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 65536 },
        };
        if (useCodeExec) body.tools = [{ code_execution: {} }];
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
        );
      } finally { clearTimeout(timeout); }
      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          let bodyText = '';
          try { bodyText = await response.text(); } catch {}
          const asked = parseRetryAfterSec(bodyText, response.headers);
          if (asked !== null) lastRetryAfterSec = lastRetryAfterSec === null ? asked : Math.max(lastRetryAfterSec, asked);
          console.log(`[gemini] Rate limited on attempt ${attempt + 1}${lastRetryAfterSec !== null ? ` (server asked retry after ${lastRetryAfterSec}s)` : ''}, waiting 60s...`);
          if (attempt < maxRetries - 1) { await sleep(60000); continue; }
          throw withRetryAfterSec(new Error(`Rate limit exceeded after ${maxRetries} attempts`), lastRetryAfterSec);
        }
        const body = (await response.text()).slice(0, 500);
        throw new Error(`API error: ${response.status} ${body}`);
      }
      const data = await response.json();
      try {
        const realTokens = data.usageMetadata?.promptTokenCount;
        if (Number.isFinite(realTokens) && realTokens > 0 && geminiTokenWindow.length) {
          const last = geminiTokenWindow[geminiTokenWindow.length - 1];
          if (realTokens < last.tokens) last.tokens = realTokens;
        }
      } catch {}
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p.text || '').join('\n').trim();
      if (text) return text;
      const candidate = data.candidates?.[0]?.content?.parts?.[0];
      return candidate?.text || '';
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`Gemini request timed out after ${GEMINI_TIMEOUT_MS / 1000}s; the date range may be too large, please narrow it and retry`);
      withRetryAfterSec(error, lastRetryAfterSec);
      console.error(`[gemini] Call failed (attempt ${attempt + 1}): ${error.message}`);
      if (attempt < maxRetries - 1) {
        const isRateLimit = error.message.includes('429') || error.message.includes('503');
        const waitTime = isRateLimit ? 60000 : 10000;
        console.log(`[gemini] Waiting ${waitTime / 1000}s before retry...`);
        await sleep(waitTime);
      } else throw error;
    }
  }
  throw new Error('Gemini API exhausted all retries');
}

const GEMINI_PER_ACTIVITY_CAP = 10000;
const GEMINI_BATCH_SIZE = 14;

function normalizeDateStr(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1],10), mo = parseInt(m[2],10), d = parseInt(m[3],10);
  if (mo<1||mo>12||d<1||d>31) return null;
  const dt = new Date(Date.UTC(y, mo-1, d));
  if (dt.getUTCFullYear()!==y || dt.getUTCMonth()+1!==mo || dt.getUTCDate()!==d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
function isDateInRange(dateStr, startStr, endStr) {
  const d = normalizeDateStr(dateStr);
  if (!d) return false;
  const s = startStr ? normalizeDateStr(startStr) : null;
  const e = endStr ? normalizeDateStr(endStr) : null;
  if (s && d < s) return false;
  if (e && d > e) return false;
  return true;
}
function normalizeHours(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v*100)/100 : null;
  if (typeof v === 'string') {
    const m = v.match(/(\d+(?:\.\d+)?)/);
    if (m) { const n = parseFloat(m[1]); return Number.isFinite(n) ? Math.round(n*100)/100 : null; }
  }
  return null;
}
function canonicalNameBackend(name, aliases) {
  if (!name) return '';
  const norm = String(name).replace(/\s+/g,' ').trim();
  const low = norm.toLowerCase();
  for (const a of aliases || []) {
    const primary = String(a.name||'').replace(/\s+/g,' ').trim();
    if (!primary) continue;
    if (primary.toLowerCase()===low) return primary;
    const alts = String(a.aliases||'').split(',').map(s=>s.replace(/\s+/g,' ').trim().toLowerCase()).filter(Boolean);
    if (alts.includes(low)) return primary;
  }
  return norm;
}
function smartTruncate(text, cap) {
  if (text.length <= cap) return text;
  const hoursBlocks = [...text.matchAll(/\b(?:Volunteer Hours|Hours|timesheet|records?|time logs?|logged)\b[\s\S]{0,400}/gi)].map(m=>m[0]);
  const hoursText = hoursBlocks.join('\n');
  if (hoursText.length >= cap * 0.8) return hoursText.slice(0, cap);
  const remaining = cap - hoursText.length - 50;
  const headLen = Math.floor(remaining * 0.3);
  const tailLen = remaining - headLen;
  return text.slice(0, headLen) + '\n...[truncated]...\n' + hoursText + '\n...[truncated]...\n' + text.slice(-tailLen);
}
function verifyAndFilterRecords(records, startDate, endDate, aliases) {
  const validAliases = Array.isArray(aliases) ? aliases.filter(a=>String(a.name||'').trim() && String(a.aliases||'').trim()) : [];
  const seen = new Set();
  const out = [];
  let droppedBadDate = 0, droppedOutOfRange = 0, droppedBadHours = 0, droppedDupe = 0, fixedCanonical = 0;
  for (const r of records) {
    if (!r || typeof r.name !== 'string') continue;
    const date = normalizeDateStr(String(r.date||'').trim());
    if (!date) { droppedBadDate++; continue; }
    if (!isDateInRange(date, startDate, endDate)) { droppedOutOfRange++; continue; }
    const hours = normalizeHours(r.hours);
    if (hours === null || hours <= 0 || hours > 24) { droppedBadHours++; continue; }
    const name = canonicalNameBackend(r.name, validAliases);
    if (name !== String(r.name).replace(/\s+/g,' ').trim()) fixedCanonical++;
    const url = String(r.sourceUrl || r.url || '').trim();
    const baseKey = `${name.toLowerCase()}|${date}|${url}|${hours}`;
    let key = baseKey;
    let suffix = 1;
    while (seen.has(key)) { suffix++; key = `${baseKey}#${suffix}`; }
    seen.add(key);
    out.push({ name, hours, date, sourceUrl: url });
  }
  console.log(`[verify] kept ${out.length} / ${records.length} (badDate:${droppedBadDate} outOfRange:${droppedOutOfRange} badHours:${droppedBadHours} canonicalFixed:${fixedCanonical})`);
  const totals = {};
  for (const r of out) { totals[r.name] = (totals[r.name]||0)+r.hours; }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]*100)/100;
  console.log(`[verify] sandbox totals: ${Object.keys(totals).length} volunteers`);
  return out;
}
function buildVolunteerPrompt(activityTexts, startDate = null, endDate = null, aliases = []) {
  let aliasLine = '';
  const validAliases = Array.isArray(aliases) ? aliases.filter(a => a && String(a.name || '').trim() && String(a.aliases || '').trim()) : [];
  if (validAliases.length > 0) {
    aliasLine = '\nName alias rules (same person, report under primary):\n' + validAliases.map(a => `  - "${a.name.trim()}" == "${a.aliases.trim()}"`).join('\n') + '\n';
  }
  let promptText = `You are a precise data extractor. Extract EVERY volunteer record from the activity reports below.${aliasLine}
Rules:
- For each volunteer mentioned, emit ONE record: {"name":"Full Name","hours":<number>,"date":"YYYY-MM-DD","sourceUrl":"https://..."}
- hours: numeric only, e.g. 2, 2.5, 3. If a range like "2-3 hours" use the actual hours listed per person (not the range). Ignore non-volunteer text.
- If SAME volunteer appears multiple times in SAME activity (e.g., "Xiao Mao: 1.5h (curriculum) + Xiao Mao: 1.5h (teaching)"), emit A SEPARATE record for EACH occurrence (both will be summed). Do NOT deduplicate same-person same-hours.
- date: MUST be YYYY-MM-DD. Infer from URL and report text (look for "Date:" or title). If activity spans multiple days, use its start date.
- sourceUrl: copy the Activity URL given in the header.
- Do NOT filter by date range. Do NOT sum/aggregate across different volunteers. Transcribe raw.
- Return ONLY a JSON array. If no volunteers, return [].

Activities:
`;
  for (let i = 0; i < activityTexts.length; i++) {
    const act = activityTexts[i];
    const truncated = smartTruncate(act.text, GEMINI_PER_ACTIVITY_CAP);
    promptText += `\n--- Activity ${i + 1} | URL: ${act.sourceUrl || act.url} ---\n${truncated}\n`;
  }
  return promptText;
}
async function filterLinksByGeminiDate(rawLinks, effStart, effEnd) {
  if (!effStart && !effEnd) return rawLinks;
  if (rawLinks.length === 0) return rawLinks;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.warn('[date-filter] GEMINI_API_KEY missing, skipping Gemini URL filter, keeping all'); return rawLinks; }
  const rangeDesc = effStart && effEnd ? `${effStart} to ${effEnd} inclusive` : effStart ? `on or after ${effStart}` : `on or before ${effEnd}`;
  let prompt = `You are a date classifier. Given the requested range: ${rangeDesc} (YYYY-MM-DD, inclusive), decide which activity links are INSIDE the range or have UNKNOWN date.\n`;
  prompt += `Rules:\n- Parse date from link URL only. URL structure: https://aylus.org/{YYYY/MM/DD}/slug-text-with-real-date/\n  The first YYYY/MM/DD is publish date (context). The slug after contains the real event date(s) like "-aug-17-to-aug-28-", "-july-12-2026-", "-7-18-26-", "-sep-03-2026-". Extract real date(s) from slug; if slug date has month+day but NO year, use year from publish YYYY (e.g., URL 2026/09/03/...-aug-17-to-aug-28- -> 2026-08-17 to 2026-08-28).\n- Formats in slug: 07-02-26, 7/2/26, 7-18-26, aug-17, July 12, Jul. 2, 2026, etc. For ranges like aug-17-to-aug-28 keep if ANY day overlaps  (e.g., 2026-08-17 to 2026-08-28 overlaps 2026-08-19 -> KEEP).\n- TYPO HANDLING: slug sometimes has 5-digit year like "-20243" (meaning 2024 + event #3) or "-20245" — use first 4 digits as year (20243 -> 2024). If year >2100 or <2000, treat as typo/unknown -> KEEP (do NOT mark outside).\n- If URL host is NOT aylus.org (e.g., handinhandwegrow.org, docs.google.com/forms, forms.gle, external), mark as OUTSIDE - not an activity.\n- If URL slug contains a clear single real date outside ${rangeDesc}, mark as OUTSIDE.\n- If URL slug has NO date or ambiguous date BUT is aylus.org link, mark as KEEP (unknown - page will be checked).\n- Return ONLY a JSON array of indices to KEEP (0-based). Example for 5 links where 0,2 are in range and 4 unknown aylus link: [0,2,4]\n`;
  prompt += `If all are outside, return [].\n\nLinks:\n`;
  rawLinks.forEach((link, idx) => {
    const safeUrl = String(link.url || '').slice(0, 400);
    prompt += `${idx}: url="${safeUrl}"\n`;
  });
  console.log(`[date-filter] Gemini URL classifier: sending ${rawLinks.length} links for range ${rangeDesc}`);
  let raw;
  try { raw = await geminiCallWithRetry(prompt); } catch (e) { throw new Error(`Gemini error, please retry later: ${e.message}`); }
  let cleaned = (raw || '').replace(/```json\n?/g, '').replace(/```/g, '').trim();
  if (!cleaned) throw new Error('Gemini error, please retry later: classifier returned empty response');
  const firstBracket = cleaned.indexOf('['); const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1) cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  let keepIndices;
  try { keepIndices = JSON.parse(cleaned); } catch (e) { throw new Error(`Gemini error, please retry later: classifier returned invalid JSON (${cleaned.slice(0,200)})`); }
  if (!Array.isArray(keepIndices)) throw new Error('Gemini error, please retry later: classifier did not return array');
  const keepSet = new Set(keepIndices.filter(n => Number.isInteger(n) && n >= 0 && n < rawLinks.length));
  const filtered = rawLinks.filter((_, idx) => keepSet.has(idx));
  console.log(`[date-filter] Gemini URL classifier kept ${filtered.length}/${rawLinks.length}`);
  return filtered;
}

async function extractVolunteersBatched(activityTexts, startDate = null, endDate = null, aliases = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set, cannot extract volunteers');
  if (activityTexts.length === 0) return [];
  const batches = [];
  for (let i=0;i<activityTexts.length;i+=GEMINI_BATCH_SIZE) batches.push(activityTexts.slice(i,i+GEMINI_BATCH_SIZE));
  console.log(`[gemini-vol] Chunked ${activityTexts.length} activities into ${batches.length} batch(es) of ≤${GEMINI_BATCH_SIZE}`);
  const GEMINI_BATCH_CONCURRENCY = 2;
  const batchResults = new Array(batches.length);
  let nextBatch = 0;
  let batchError = null;
  async function geminiWorker() {
    while (nextBatch < batches.length && !batchError) {
      const idx = nextBatch++;
      try {
        const batchPrompt = buildVolunteerPrompt(batches[idx], null, null, aliases);
        const raw = await geminiCallWithRetry(batchPrompt);
        let cleaned = (raw || '').replace(/```json\n?/g, '').replace(/```/g, '').trim();
        if (!cleaned) throw new Error(`Gemini error, please retry later: batch ${idx+1} returned empty response`);
        const firstBracket = cleaned.indexOf('['); const lastBracket = cleaned.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) cleaned = cleaned.slice(firstBracket, lastBracket+1);
        let parsed;
        try { parsed = JSON.parse(cleaned); } catch (e) { throw new Error(`Gemini error, please retry later: batch ${idx+1} returned invalid JSON`); }
        if (!Array.isArray(parsed)) throw new Error(`Gemini error, please retry later: batch ${idx+1} did not return array`);
        console.log(`[gemini-vol] batch ${idx+1}/${batches.length}: ${parsed.length} raw records`);
        batchResults[idx] = parsed;
      } catch (error) {
        console.error(`[gemini-vol] batch ${idx+1} failed: ${error.message}`);
        const retryAfterSec = Number.isFinite(error.retryAfterSec) ? error.retryAfterSec : null;
        const keep = (e) => withRetryAfterSec(e, retryAfterSec);
        if (error.message.includes('Server busy') || error.message.includes('Gemini error, please retry later')) batchError = keep(error);
        else if (error.message.includes('Rate limit') || error.message.includes('429') || error.message.includes('503')) batchError = keep(new Error('Gemini error, please retry later: rate limited'));
        else if (error.message.includes('too large') || error.message.includes('timed out')) batchError = keep(new Error('Gemini error, please retry later: response too large or timed out'));
        else batchError = keep(new Error(`Gemini error, please retry later: ${error.message}`));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(GEMINI_BATCH_CONCURRENCY, batches.length) }, () => geminiWorker()));
  if (batchError) throw batchError;
  const allRaw = batchResults.flat();
  console.log(`[gemini-vol] All batches raw total: ${allRaw.length}`);
  const verified = verifyAndFilterRecords(allRaw, startDate, endDate, aliases);
  return verified;
}

function registerScraperRoutes(app) {
  app.post('/api/scrape', async (req, res) => {
    const { url, startDate, endDate, aliases } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const startTime = Date.now();
    // Fire-and-forget run log (never blocks/fails the response; helper catches its own errors)
    const logRun = (status, reason, activityCount, recordCount, sDate, eDate) => {
      db.logScrapeRun({
        branchUrl: url,
        status,
        reason,
        elapsedSeconds: Math.round(((Date.now() - startTime) / 1000) * 10) / 10,
        startDate: sDate !== undefined ? sDate : effStart,
        endDate: eDate !== undefined ? eDate : effEnd,
        activityCount: activityCount || 0,
        recordCount: recordCount || 0,
      });
    };
    const normStart = startDate ? normalizeDateStr(String(startDate).trim()) : null;
    const normEnd = endDate ? normalizeDateStr(String(endDate).trim()) : null;
    if (startDate && !normStart) { logRun('failure', `Invalid startDate: ${startDate} (expected YYYY-MM-DD)`, 0, 0, startDate, endDate); return res.status(400).json({ error: `Invalid startDate: ${startDate} (expected YYYY-MM-DD)` }); }
    if (endDate && !normEnd) { logRun('failure', `Invalid endDate: ${endDate} (expected YYYY-MM-DD)`, 0, 0, startDate, endDate); return res.status(400).json({ error: `Invalid endDate: ${endDate} (expected YYYY-MM-DD)` }); }
    if (normStart && normEnd && normStart > normEnd) { logRun('failure', 'Start date cannot be after end date', 0, 0, startDate, endDate); return res.status(400).json({ error: 'Start date cannot be after end date' }); }
    if (normStart && normEnd) {
      const diffDays = (new Date(normEnd) - new Date(normStart)) / (1000*60*60*24);
      if (diffDays > 365) { logRun('failure', 'Date range cannot exceed 365 days', 0, 0, startDate, endDate); return res.status(400).json({ error: 'Date range cannot exceed 365 days' }); }
    }
    const effStart = normStart || startDate || null;
    const effEnd = normEnd || endDate || null;
    console.log('=== Scrape Request ===');
    console.log(`[request] URL: ${url}`);
    console.log(`[request] startDate: ${effStart} endDate: ${effEnd}`);
    console.log(`[request] Started at: ${new Date().toISOString()}`);
    try {
      console.log('[timing] Fetching main page...');
      const mainHtml = await fetchHtml(url);
      if (!mainHtml) { logRun('failure', 'FETCH_FAILED: branch page fetch returned empty', 0, 0); return res.status(502).json({ error: 'Failed in fetching original activity posts. Please retry.', code: 'FETCH_FAILED' }); }
      const $ = cheerio.load(mainHtml);
      const allLinks = extractAllLinks($);
      console.log(`[timing] Main page fetched: ${Date.now() - startTime}ms`);
      let rawLinks = extractActivityLinks(allLinks, url);
      if (rawLinks.length === 0) {
        console.log('[scrape] No entry found');
        logRun('success', 'ok: no activity found', 0, 0);
        return res.json({ success: true, data: [], message: 'no activity found' });
      }
      if (effStart || effEnd) {
        const before = rawLinks.length;
        const filtered = await filterLinksByGeminiDate(rawLinks, effStart, effEnd);
        console.log(`[date-filter] URL classifier result: ${before} → ${filtered.length}`);
        rawLinks = filtered;
        if (rawLinks.length === 0) { logRun('success', 'ok: no activity in range', 0, 0); return res.json({ success: true, data: [] }); }
      }
      console.log(`[scrape] === Fetching ${rawLinks.length} activity pages (15 concurrent) ===`);
      const pageResults = await mapLimit(rawLinks, 15, async (link) => {
        const detailHtml = await fetchHtml(link.url);
        if (!detailHtml) return null;
        const text = extractContentText(detailHtml);
        console.log(`[scrape] ${link.url}: ${text.length} chars`);
        return { url: link.url, sourceUrl: link.url, date: link.date, text };
      });
      const activityTexts = pageResults.filter(r => r && r.text.trim());
      console.log(`[timing] All pages fetched: ${Date.now() - startTime}ms`);
      console.log(`[scrape] === All pages fetched, sending to Gemini in ${Math.ceil(activityTexts.length/GEMINI_BATCH_SIZE)} chunk(s) ===`);
      console.log(`[timing] Before volunteer extraction: ${Date.now() - startTime}ms`);
      const allVolunteers = await extractVolunteersBatched(activityTexts, effStart, effEnd, aliases);
      console.log(`[timing] Volunteer extraction done: ${Date.now() - startTime}ms`);
      console.log(`[scrape] Total volunteer records: ${allVolunteers.length}`);
      logRun('success', 'ok', activityTexts.length, allVolunteers.length);
      res.json({ success: true, data: allVolunteers });
    } catch (error) {
      console.error('Scraping error:', error.message, error.retryAfterSec != null ? `(server asked retry after ${error.retryAfterSec}s)` : '');
      if (res.headersSent) return;
      const msg = error.message || '';
      // Actionable input errors keep their message (tell user to narrow range)
      const isInputTooLarge = msg.includes('too large') || msg.includes('timed out');
      if (isInputTooLarge) { logRun('failure', `AI_INPUT_TOO_LARGE: ${msg}`); return res.status(500).json({ error: msg, code: 'AI_INPUT_TOO_LARGE' }); }
      // Daily quota is exhausted until tomorrow, not minutes — say so explicitly
      if (/daily|tomorrow/i.test(msg)) { logRun('failure', `AI_BUSY daily quota: ${msg}`); return res.status(503).json({ error: 'AI usage limit reached for today, please retry tomorrow.', code: 'AI_BUSY' }); }
      // Gemini / rate-limit signals -> friendly AI-busy message (details stay in server console only)
      const isRateLimit = /429|503|rate limit|server busy|quota|too many|gemini/i.test(msg);
      if (isRateLimit) {
        const serverAskedSec = Number.isFinite(error.retryAfterSec) ? error.retryAfterSec : 0;
        const retryInSec = serverAskedSec + 5 * 60; // server interval + 5 min buffer
        const retryMin = Math.max(1, Math.ceil(retryInSec / 60));
        logRun('failure', `AI_BUSY rate limited: ${msg}`);
        return res.status(503).json({ error: `AI is busy, please retry after ${retryMin} minutes.`, code: 'AI_BUSY', retryAfterSec: serverAskedSec, retryInSec });
      }
      // All other scraping failures -> friendly fetch message (raw detail stays in server console only)
      logRun('failure', `FETCH_FAILED: ${msg}`);
      return res.status(500).json({ error: 'Failed in fetching original activity posts. Please retry.', code: 'FETCH_FAILED' });
    }
  });

  // health for scraper config
  app.get('/api/scrape/health', (req,res)=>{
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ ok: true, geminiConfigured: hasKey, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' });
  });
}

module.exports = { registerScraperRoutes };
