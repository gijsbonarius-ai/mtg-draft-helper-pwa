import precomputedEffects from './cardEffects.json';

export type EffectTarget =
  | 'self'
  | 'opp'
  | 'choose_creature_self'
  | 'choose_creature_opp'
  | 'choose_creature_any'
  | 'all_players'
  | 'all_opponents'
  | 'choose';

export interface ParsedEffect {
  type: 'draw' | 'damage' | 'life_gain' | 'life_loss' | 'destroy_creature' | 'exile_creature' | 'plus_counter' | 'minus_counter' | 'mill' | 'bounce_creature' | 'tap_creature' | 'poison' | 'destroy_all_creatures' | 'scry' | 'manual';
  amount?: number;
  target: EffectTarget;
  description: string;
  /** Original oracle text — included for `manual` effects the engine can't auto-apply, so the player can resolve them by hand. */
  oracle?: string;
}

/**
 * Effects precomputed offline by `scripts/generateCardEffects.ts` (Claude reads
 * each card's Scryfall oracle text once and emits a typed effect list), keyed by
 * exact card name. Empty until the generator has been run.
 */
const PRECOMPUTED = precomputedEffects as Record<string, ParsedEffect[]>;

/** Returns the precomputed effects for a card, or null if it hasn't been generated yet. */
export function getPrecomputedEffects(cardName: string): ParsedEffect[] | null {
  return PRECOMPUTED[cardName] ?? null;
}

const oracleCache = new Map<string, string>();

export async function fetchOracleText(cardName: string): Promise<string | null> {
  if (oracleCache.has(cardName)) return oracleCache.get(cardName)!;
  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.oracle_text ?? data.card_faces?.[0]?.oracle_text ?? null;
    if (text) oracleCache.set(cardName, text);
    return text ?? null;
  } catch {
    return null;
  }
}

export function parseEffects(oracleText: string): ParsedEffect[] {
  const effects: ParsedEffect[] = [];
  const t = oracleText;

  // each player draws N cards (check before simple draw to avoid double-adding)
  const eachDraw = /each player draws (\d+) cards?/i.exec(t);
  if (eachDraw) {
    const n = parseInt(eachDraw[1], 10);
    effects.push({ type: 'draw', amount: n, target: 'all_players', description: `Each player draws ${n} card${n > 1 ? 's' : ''}` });
  } else {
    // draw a card
    const drawOne = /draw a card/i.exec(t);
    if (drawOne) {
      effects.push({ type: 'draw', amount: 1, target: 'self', description: 'Draw 1 card' });
    } else {
      const drawN = /draw (\d+) cards?/i.exec(t);
      if (drawN) {
        const n = parseInt(drawN[1], 10);
        effects.push({ type: 'draw', amount: n, target: 'self', description: `Draw ${n} card${n > 1 ? 's' : ''}` });
      }
    }
  }

  // life gain
  const lifeGain = /(?:you gain|gain) (\d+) life/i.exec(t);
  if (lifeGain) {
    const n = parseInt(lifeGain[1], 10);
    effects.push({ type: 'life_gain', amount: n, target: 'self', description: `Gain ${n} life` });
  }

  // each opponent loses N life (check before self life loss)
  const oppLifeLoss = /each opponent loses (\d+) life/i.exec(t);
  if (oppLifeLoss) {
    const n = parseInt(oppLifeLoss[1], 10);
    effects.push({ type: 'life_loss', amount: n, target: 'all_opponents', description: `Each opponent loses ${n} life` });
  } else {
    const lifeLossSelf = /(?:you lose|lose) (\d+) life/i.exec(t);
    if (lifeLossSelf) {
      const n = parseInt(lifeLossSelf[1], 10);
      effects.push({ type: 'life_loss', amount: n, target: 'self', description: `Lose ${n} life` });
    }
  }

  // damage patterns — first match wins
  const damagePatterns: Array<[RegExp, EffectTarget]> = [
    [/deals (\d+) damage to target opponent/i, 'opp'],
    [/deals (\d+) damage to each opponent/i, 'all_opponents'],
    [/deals (\d+) damage to any target/i, 'choose_creature_any'],
    [/deals (\d+) damage to target creature or player/i, 'choose_creature_any'],
    [/deals (\d+) damage to target creature/i, 'choose_creature_any'],
    [/deals (\d+) damage to target player/i, 'choose'],
  ];

  for (const [re, tgt] of damagePatterns) {
    const m = re.exec(t);
    if (m) {
      const n = parseInt(m[1], 10);
      const desc = tgt === 'opp' ? 'opponent' : tgt === 'all_opponents' ? 'each opponent' : 'chosen target';
      effects.push({ type: 'damage', amount: n, target: tgt, description: `Deal ${n} damage to ${desc}` });
      break;
    }
  }

  // destroy target creature
  if (/destroy target creature/i.test(t)) {
    effects.push({ type: 'destroy_creature', target: 'choose_creature_any', description: 'Destroy target creature' });
  }

  // exile target creature
  if (/exile target creature/i.test(t)) {
    effects.push({ type: 'exile_creature', target: 'choose_creature_any', description: 'Exile target creature' });
  }

  // +1/+1 counters
  const plusCounter = /put (\d+) \+1\/\+1 counter/i.exec(t);
  if (plusCounter) {
    const n = parseInt(plusCounter[1], 10);
    effects.push({ type: 'plus_counter', amount: n, target: 'choose_creature_any', description: `Put ${n} +1/+1 counter${n > 1 ? 's' : ''} on target creature` });
  }

  // -1/-1 counters
  const minusCounter = /put (\d+) -1\/-1 counter/i.exec(t);
  if (minusCounter) {
    const n = parseInt(minusCounter[1], 10);
    effects.push({ type: 'minus_counter', amount: n, target: 'choose_creature_any', description: `Put ${n} -1/-1 counter${n > 1 ? 's' : ''} on target creature` });
  }

  // mill
  const millTarget = /target player mills (\d+)/i.exec(t);
  if (millTarget) {
    const n = parseInt(millTarget[1], 10);
    effects.push({ type: 'mill', amount: n, target: 'choose', description: `Target player mills ${n}` });
  } else {
    const mill = /mills? (\d+) cards?/i.exec(t);
    if (mill) {
      const n = parseInt(mill[1], 10);
      effects.push({ type: 'mill', amount: n, target: 'choose', description: `Mill ${n} cards` });
    }
  }

  return effects;
}

/**
 * Resolve a card's effects, preferring the precomputed Claude interpretations and
 * falling back to the live Scryfall fetch + regex parser when a card hasn't been
 * generated yet.
 */
export async function resolveEffects(cardName: string): Promise<ParsedEffect[]> {
  const pre = getPrecomputedEffects(cardName);
  if (pre) return pre;
  const oracle = await fetchOracleText(cardName);
  return oracle ? parseEffects(oracle) : [];
}
