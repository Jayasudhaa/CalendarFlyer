/**
 * server/utils/captionEventParser.js — best-effort event extraction from a
 * single Instagram caption (or any other free-text post/announcement),
 * using Claude the same way routes/documents.js's /search does: a strict
 * "don't invent facts" system prompt, never a confident guess dressed up
 * as a fact. A caption is not structured data -- there's no schema.org
 * markup like eventSourceParser.js gets from a real event page, just
 * whatever the org happened to type (dates written a dozen different
 * ways, hashtags, emoji, sometimes mixed English/Telugu/Tamil). An LLM
 * handles that variety far better than a hand-rolled regex would, but the
 * output is still a GUESS -- every candidate this produces is meant to
 * land in a human review queue (see utils/instagramCandidates.js), never
 * publish directly.
 *
 * Never throws -- a missing ANTHROPIC_API_KEY, a malformed model
 * response, or an API error all just mean "couldn't extract anything",
 * same fail-open pattern as orgImages.js/eventSourceParser.js. Callers
 * still get the raw caption either way and can queue it for a human to
 * read and fill in by hand.
 */

const Anthropic = require('@anthropic-ai/sdk');

// Lazy-initialized — same reasoning as routes/documents.js's getAnthropic():
// the SDK throws synchronously if ANTHROPIC_API_KEY is missing, and this
// module is required at server boot (routes/instagramEvents.js mounts at
// startup), so an unguarded `new Anthropic(...)` here would take the whole
// app down rather than just this one feature.
let anthropic = null;
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

const SYSTEM_PROMPT = `You read one Instagram caption from a temple/community organization and pull out whether it announces a specific upcoming event.

Rules:
- Only extract a date/time/title that is ACTUALLY STATED or unambiguously implied in the caption (e.g. "this Saturday" relative to the post date given). Never invent or guess a value that isn't grounded in the text.
- Resolve relative dates ("this Saturday", "next Friday", "tomorrow") using the POST DATE given to you, and return an absolute ISO date (YYYY-MM-DD).
- If no year is stated and the resolved date would already be in the past relative to the post date, assume the next occurrence of that date going forward.
- If the caption does not clearly announce a specific dated event (e.g. it's a general photo, a thank-you post, a recap of a past event), set is_event to false.
- Ignore hashtags and emoji when forming the title -- use the caption's own descriptive text.
- Keep the title short (under 80 characters), in the caption's own words, not reworded.
- location: only if a specific venue/address is actually named in the caption.
- Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{"is_event": boolean, "title": string|null, "date": string|null, "time": string|null, "location": string|null, "confidence": "high"|"medium"|"low"}`;

/**
 * @param {string} caption - the raw Instagram caption text
 * @param {string|null} postDateIso - ISO date (YYYY-MM-DD) the post was made -- used to resolve relative dates
 * @returns {Promise<{is_event:boolean, title:?string, date:?string, time:?string, location:?string, confidence:string}|null>}
 */
async function extractEventFromCaption(caption, postDateIso) {
  const client = getAnthropic();
  if (!client || !caption || !caption.trim()) return null;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `POST DATE: ${postDateIso || 'unknown'}\n\nCAPTION:\n${caption.slice(0, 4000)}`,
      }],
    });
    const block = (response.content || []).find((b) => b.type === 'text');
    if (!block || !block.text) return null;
    // Model is told to return ONLY JSON, but strip any stray code-fencing just in case.
    const cleaned = block.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.is_event !== 'boolean') return null;
    return {
      is_event: parsed.is_event,
      title: parsed.title || null,
      date: parsed.date || null,
      time: parsed.time || null,
      location: parsed.location || null,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    };
  } catch (err) {
    console.error('[captionEventParser] Extraction failed:', err.message);
    return null;
  }
}

module.exports = { extractEventFromCaption };
