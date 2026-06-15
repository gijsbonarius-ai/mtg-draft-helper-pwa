/**
 * Precompute card effects for the cube.
 *
 * For every card in CUBE_CARDS this script fetches the card's oracle text from
 * Scryfall and asks Claude (Haiku) to turn it into a typed list of effects that
 * the game engine understands. The result is written to src/lib/cardEffects.json,
 * keyed by exact card name, and loaded at runtime by cardAutomation.ts.
 *
 * The cube is fixed, so this runs ONCE (or whenever cards change). The output is
 * committed to the repo, so the running app makes no API calls and works offline.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run generate-effects
 *
 * It is resumable: cards already present in cardEffects.json are skipped, so you
 * can stop and re-run without paying for them again.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { CUBE_CARDS } from '../src/lib/cards';
import type { ParsedEffect } from '../src/lib/cardAutomation';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/lib/cardEffects.json');

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You convert Magic: The Gathering oracle text into a structured list of immediate, automatable game effects for a simple 2-player game engine.

Only model IMMEDIATE, ONE-SHOT effects that resolve when a spell is cast or a permanent enters the battlefield. The engine supports exactly these effect types:

- draw         — a player draws cards. amount = number of cards.
- life_gain    — a player gains life. amount = life gained.
- life_loss    — a player loses life. amount = life lost.
- damage       — deal damage to a player or creature. amount = damage.
- destroy_creature — destroy a target creature. amount = null.
- exile_creature   — exile a target creature. amount = null.
- plus_counter — put +1/+1 counters on a target creature. amount = count.
- minus_counter— put -1/-1 counters on a target creature. amount = count.
- mill         — a player puts cards from library into graveyard. amount = count.
- bounce_creature — return a target creature to its owner's hand. amount = null.
- tap_creature — tap a target creature. amount = null. (Only for "tap target creature", not tapping as a cost or a repeatable ability.)
- poison       — a player gets poison counters. amount = number.
- destroy_all_creatures — destroy ALL creatures (a board wipe / "destroy all creatures"). amount = null, target = all_players. Use ONLY for unconditional board wipes; if it's conditional ("creatures with power 4 or greater", "creatures you don't control"), use manual.
- scry         — scry N (look at the top N cards and reorder). amount = N, target = self. Use only for the keyword "scry"; surveil and "look at the top" are manual.
- create_token — create one or more tokens. amount = number of tokens, token = a short token name such as "Treasure", "Clue", "1/1 white Soldier", "2/2 Zombie". Use only for fixed/known tokens; for X tokens, copies of another permanent, or conditional tokens, use manual.
- manual       — anything the engine cannot represent (see below).

"target" must be one of:
- self                  — the controller (you)
- opp                   — the opponent
- all_players           — every player
- all_opponents         — every opponent
- choose                — a chosen player
- choose_creature_self  — a creature you control
- choose_creature_opp   — a creature the opponent controls
- choose_creature_any   — any creature

Rules:
- Output ONLY effects that are explicitly stated in the oracle text. Never invent effects.
- A card may produce several effects (e.g. "draw a card and gain 2 life" → two effects).
- Use type "manual" (target "self", amount null) with a short plain-English instruction in "description" for anything the engine can't auto-apply: counterspells, tutors/searches, bounce, copying, scry/surveil, static or continuous abilities, triggered/activated abilities, the stack, modal choices, conditional effects, tokens, and anything ambiguous. It is much better to return "manual" than to approximate.
- For a permanent whose only text is combat stats / keywords (a vanilla creature, or a land), return an empty effects array.
- "description" is shown to the player; keep it short and imperative (e.g. "Deal 3 damage to any target", "Search your library for a creature card").`;

const EFFECT_LIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    effects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: [
              'draw', 'damage', 'life_gain', 'life_loss', 'destroy_creature',
              'exile_creature', 'plus_counter', 'minus_counter', 'mill',
              'bounce_creature', 'tap_creature', 'poison',
              'destroy_all_creatures', 'scry', 'create_token', 'manual',
            ],
          },
          amount: { type: ['integer', 'null'] },
          target: {
            type: 'string',
            enum: [
              'self', 'opp', 'choose_creature_self', 'choose_creature_opp',
              'choose_creature_any', 'all_players', 'all_opponents', 'choose',
            ],
          },
          description: { type: 'string' },
          token: { type: ['string', 'null'] },
        },
        required: ['type', 'amount', 'target', 'description', 'token'],
      },
    },
  },
  required: ['effects'],
} as const;

// Scryfall requires identifying User-Agent and Accept headers, or it returns 403.
const SCRYFALL_HEADERS = {
  'User-Agent': 'mtg-draft-helper-pwa/1.0 (cube effect generator)',
  'Accept': 'application/json',
};

function faceOracle(card: any): string {
  if (card.oracle_text) return card.oracle_text as string;
  if (Array.isArray(card.card_faces)) {
    return card.card_faces.map((f: any) => f.oracle_text ?? '').filter(Boolean).join('\n//\n');
  }
  return '';
}

/**
 * Download Scryfall's "oracle cards" bulk dataset once and build a
 * name -> oracle text map. One download instead of 540 requests avoids the
 * per-request rate limiting (HTTP 429) entirely. Front-face names of
 * double-faced cards are also mapped, since the cube list uses those.
 */
async function loadOracleMap(): Promise<Map<string, string>> {
  const idxRes = await fetch('https://api.scryfall.com/bulk-data', { headers: SCRYFALL_HEADERS });
  if (!idxRes.ok) throw new Error(`Scryfall bulk index HTTP ${idxRes.status}`);
  const idx: any = await idxRes.json();
  const entry = idx.data.find((d: any) => d.type === 'oracle_cards');
  if (!entry) throw new Error('Could not find the oracle_cards bulk dataset');

  console.log('Downloading Scryfall oracle bulk data (one-time, ~tens of MB)...');
  const dlRes = await fetch(entry.download_uri, { headers: SCRYFALL_HEADERS });
  if (!dlRes.ok) throw new Error(`Scryfall bulk download HTTP ${dlRes.status}`);
  const cards: any[] = await dlRes.json();

  const map = new Map<string, string>();
  for (const c of cards) {
    if (!c.name) continue;
    const oracle = faceOracle(c);
    map.set(c.name, oracle);
    if (Array.isArray(c.card_faces)) {
      for (const f of c.card_faces) {
        if (f.name && !map.has(f.name)) map.set(f.name, oracle);
      }
    }
  }
  console.log(`Loaded oracle text for ${map.size} card names.`);
  return map;
}

function load(): Record<string, ParsedEffect[]> {
  if (!existsSync(OUTPUT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data: Record<string, ParsedEffect[]>) {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  // Stable key order keeps the committed JSON diff-friendly.
  const sorted = Object.fromEntries(Object.keys(data).sort().map(k => [k, data[k]]));
  writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

async function interpret(client: Anthropic, cardName: string, oracle: string): Promise<ParsedEffect[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: EFFECT_LIST_SCHEMA } },
    messages: [{ role: 'user', content: `Card: ${cardName}\n\nOracle text:\n${oracle}` }],
  } as any);

  const text = response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  const parsed = JSON.parse(text) as { effects: Array<ParsedEffect & { amount: number | null }> };
  return parsed.effects.map(e => {
    const effect: ParsedEffect = { type: e.type, target: e.target, description: e.description };
    if (e.amount != null) effect.amount = e.amount;
    if (e.token) effect.token = e.token;
    if (e.type === 'manual') effect.oracle = oracle;
    return effect;
  });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY in your environment first.');
    process.exit(1);
  }
  const client = new Anthropic();

  const oracleMap = await loadOracleMap();

  const cards = Array.from(new Set(CUBE_CARDS));
  // REGENERATE=1 re-interprets every card from scratch (use after the effect
  // vocabulary changes); otherwise already-done cards are skipped.
  const out = process.env.REGENERATE ? {} : load();
  const todo = cards.filter(c => !(c in out));
  console.log(`${cards.length} cards, ${cards.length - todo.length} already done, ${todo.length} to do.`);

  let done = 0;
  for (const card of todo) {
    try {
      const oracle = oracleMap.get(card);
      if (oracle === undefined) {
        console.warn(`! "${card}" not found in Scryfall data — skipping`);
        continue;
      }
      if (oracle.trim() === '') {
        out[card] = []; // land / vanilla creature — no rules text, no effects
        continue;
      }
      out[card] = await interpret(client, card, oracle);
      done++;
      const kinds = out[card].length ? out[card].map(e => e.type).join(', ') : 'none';
      console.log(`✓ ${card} → [${kinds}]`);
    } catch (err) {
      console.error(`✗ ${card}:`, err instanceof Error ? err.message : err);
    }
    if (done % 10 === 0) save(out); // checkpoint so progress survives interruptions
  }

  save(out);
  console.log(`Done. ${Object.keys(out).length} cards written to ${OUTPUT_PATH}`);
}

main();
