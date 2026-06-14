import type { GameState, PlayerKey, GameStep, PlayerGameState } from './gameTypes';

const BASIC_LANDS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest']);

function detectLand(name: string): boolean {
  return BASIC_LANDS.has(name) || /\bland\b/i.test(name);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function mkPlayer(name: string, deck: string[]): PlayerGameState {
  const lib = shuffle(deck);
  return {
    name,
    life: 20,
    poison: 0,
    library: lib,
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    ready: false,
    mulligans: 0,
    revealedHand: false,
  };
}

function addLog(state: GameState, msg: string): void {
  state.log = [...state.log.slice(-19), msg];
}

export function initGame(p1Name: string, p1Deck: string[], p2Name: string, p2Deck: string[]): GameState {
  return {
    phase: 'setup',
    turn: 1,
    activePlayer: 'player1',
    step: 'main1',
    players: {
      player1: mkPlayer(p1Name, p1Deck),
      player2: mkPlayer(p2Name, p2Deck),
    },
    log: ['Game created. Draw your opening hands.'],
    winner: undefined,
  };
}

export function drawOpeningHand(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  const p = s.players[player];
  p.hand = p.library.splice(0, 7);
  addLog(s, `${player} drew opening hand.`);
  return s;
}

// London mulligan: shuffle the hand back, draw a fresh 7, and remember how many
// cards must be put on the bottom when the hand is kept (one per mulligan taken).
export function mulligan(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  const p = s.players[player];
  p.library = shuffle([...p.library, ...p.hand]);
  p.hand = p.library.splice(0, Math.min(7, p.library.length));
  p.mulligans = (p.mulligans ?? 0) + 1;
  addLog(s, `${player} mulliganed (London) — will put ${p.mulligans} on the bottom when keeping.`);
  return s;
}

export function keepHand(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  s.players[player].ready = true;
  const bothReady = s.players.player1.ready && s.players.player2.ready;
  if (bothReady) {
    s.phase = 'playing';
    addLog(s, 'Both players kept. Game begins!');
  } else {
    addLog(s, `${player} kept their hand.`);
  }
  return s;
}

// Keep after a London mulligan: put the chosen cards on the bottom, then ready up.
export function keepWithBottom(state: GameState, player: PlayerKey, bottomIndices: number[]): GameState {
  const s = clone(state);
  const p = s.players[player];
  const set = new Set(bottomIndices);
  const bottomed: string[] = [];
  const kept: string[] = [];
  p.hand.forEach((c, i) => { if (set.has(i)) bottomed.push(c); else kept.push(c); });
  p.hand = kept;
  p.library.push(...bottomed);
  p.ready = true;
  addLog(s, `${player} kept ${kept.length} and put ${bottomed.length} on the bottom.`);
  if (s.players.player1.ready && s.players.player2.ready) {
    s.phase = 'playing';
    addLog(s, 'Both players kept. Game begins!');
  }
  return s;
}

export function toggleRevealHand(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  const p = s.players[player];
  p.revealedHand = !p.revealedHand;
  addLog(s, `${player} ${p.revealedHand ? 'revealed their hand to the opponent' : 'hid their hand'}.`);
  return s;
}

export function drawCard(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  const p = s.players[player];
  if (p.library.length === 0) {
    s.phase = 'ended';
    s.winner = player === 'player1' ? 'player2' : 'player1';
    addLog(s, `${player} tried to draw from an empty library and loses! ${s.winner} wins!`);
    return s;
  }
  p.hand.push(p.library.shift()!);
  addLog(s, `${player} drew a card.`);
  return s;
}

export function playCard(state: GameState, player: PlayerKey, handIdx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.hand.splice(handIdx, 1);
  p.battlefield.push({
    uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: card,
    tapped: false,
    counters: 0,
    stunCounters: 0,
    isToken: false,
    note: '',
    isLand: detectLand(card),
    transformed: false,
  });
  addLog(s, `${player} played ${card}.`);
  return s;
}

export function discardCard(state: GameState, player: PlayerKey, handIdx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.hand.splice(handIdx, 1);
  p.graveyard.push(card);
  addLog(s, `${player} discarded ${card}.`);
  return s;
}

export function tapToggle(state: GameState, player: PlayerKey, uid: string): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) card.tapped = !card.tapped;
  return s;
}

export function untapAll(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  s.players[player].battlefield.forEach(c => {
    if ((c.stunCounters ?? 0) > 0) {
      c.stunCounters = c.stunCounters - 1;
    } else {
      c.tapped = false;
    }
  });
  return s;
}

export function addStunCounter(state: GameState, player: PlayerKey, uid: string, delta = 1): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) {
    card.stunCounters = Math.max(0, (card.stunCounters ?? 0) + delta);
    if (delta > 0) card.tapped = true;
  }
  return s;
}

export function addCounter(state: GameState, player: PlayerKey, uid: string, delta: number): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) card.counters += delta;
  return s;
}

function clearReferences(state: GameState, removedUid: string): void {
  for (const p of Object.values(state.players)) {
    for (const c of p.battlefield) {
      if (c.blocking === removedUid) c.blocking = undefined;
      if (c.targeting === removedUid) c.targeting = undefined;
    }
  }
}

export function moveToGraveyard(state: GameState, player: PlayerKey, uid: string): GameState {
  const s = clone(state);
  const p = s.players[player];
  const idx = p.battlefield.findIndex(c => c.uid === uid);
  if (idx >= 0) {
    const [card] = p.battlefield.splice(idx, 1);
    clearReferences(s, uid);
    if (!card.isToken) p.graveyard.push(card.name);
    addLog(s, `${card.name} → ${player}'s graveyard.`);
  }
  return s;
}

export function returnToHand(state: GameState, player: PlayerKey, uid: string): GameState {
  const s = clone(state);
  const p = s.players[player];
  const idx = p.battlefield.findIndex(c => c.uid === uid);
  if (idx >= 0) {
    const [card] = p.battlefield.splice(idx, 1);
    clearReferences(s, uid);
    if (!card.isToken) p.hand.push(card.name);
  }
  return s;
}

export function exileCard(state: GameState, player: PlayerKey, uid: string): GameState {
  const s = clone(state);
  const p = s.players[player];
  const idx = p.battlefield.findIndex(c => c.uid === uid);
  if (idx >= 0) {
    const [card] = p.battlefield.splice(idx, 1);
    clearReferences(s, uid);
    if (!card.isToken) p.exile.push(card.name);
    addLog(s, `${card.name} → ${player}'s exile.`);
  }
  return s;
}

export function graveToHand(state: GameState, player: PlayerKey, idx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.graveyard.splice(idx, 1);
  p.hand.push(card);
  addLog(s, `${card} returned from graveyard to ${player}'s hand.`);
  return s;
}

export function exileToHand(state: GameState, player: PlayerKey, idx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.exile.splice(idx, 1);
  p.hand.push(card);
  addLog(s, `${card} returned from exile to ${player}'s hand.`);
  return s;
}

export function createToken(state: GameState, player: PlayerKey, name: string): GameState {
  const s = clone(state);
  s.players[player].battlefield.push({
    uid: `token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    tapped: false,
    counters: 0,
    isToken: true,
    stunCounters: 0,
    note: '',
    isLand: false,
    transformed: false,
  });
  addLog(s, `${player} created ${name} token.`);
  return s;
}

export function adjustLife(state: GameState, player: PlayerKey, delta: number): GameState {
  const s = clone(state);
  s.players[player].life += delta;
  if (s.players[player].life <= 0 && s.phase === 'playing') {
    s.phase = 'ended';
    s.winner = player === 'player1' ? 'player2' : 'player1';
    addLog(s, `${player} reached 0 life. ${s.winner} wins!`);
  }
  return s;
}

export function adjustPoison(state: GameState, player: PlayerKey, delta: number): GameState {
  const s = clone(state);
  s.players[player].poison += delta;
  if (s.players[player].poison >= 10 && s.phase === 'playing') {
    s.phase = 'ended';
    s.winner = player === 'player1' ? 'player2' : 'player1';
    addLog(s, `${player} has 10 poison. ${s.winner} wins!`);
  }
  return s;
}

const STEPS: GameStep[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];

export function nextStep(state: GameState): GameState {
  let s = clone(state);
  const idx = STEPS.indexOf(s.step);
  if (idx < STEPS.length - 1) {
    s.step = STEPS[idx + 1];
    if (s.step === 'untap') {
      s = untapAll(s, s.activePlayer);
    }
  } else {
    // End of turn → next player
    s.activePlayer = s.activePlayer === 'player1' ? 'player2' : 'player1';
    s.step = 'untap';
    s.turn++;
    addLog(s, `Turn ${s.turn} — ${s.activePlayer}'s turn.`);
    s = untapAll(s, s.activePlayer);
  }
  return s;
}

export function endTurn(state: GameState): GameState {
  let s = clone(state);
  s.activePlayer = s.activePlayer === 'player1' ? 'player2' : 'player1';
  s.step = 'untap';
  s.turn++;
  addLog(s, `Turn ${s.turn} — ${s.activePlayer}'s turn.`);
  s = untapAll(s, s.activePlayer);
  return s;
}

export function concede(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  s.phase = 'ended';
  s.winner = player === 'player1' ? 'player2' : 'player1';
  addLog(s, `${player} conceded. ${s.winner} wins!`);
  return s;
}

export function transformCard(state: GameState, player: PlayerKey, uid: string): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) {
    card.transformed = !card.transformed;
    addLog(s, `${card.name} ${card.transformed ? 'transformed' : 'transformed back'}.`);
  }
  return s;
}

export function setBlocking(state: GameState, player: PlayerKey, uid: string, targetUid: string | null): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) card.blocking = targetUid ?? undefined;
  return s;
}

export function setTargeting(state: GameState, player: PlayerKey, uid: string, target: string | null): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) card.targeting = target ?? undefined;
  return s;
}

export function toggleLandRow(state: GameState, player: PlayerKey, uid: string): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) card.isLand = !card.isLand;
  return s;
}

export function setNote(state: GameState, player: PlayerKey, uid: string, note: string): GameState {
  const s = clone(state);
  const card = s.players[player].battlefield.find(c => c.uid === uid);
  if (card) card.note = note;
  return s;
}

// Move a card from graveyard or exile onto the battlefield
export function zoneToBattlefield(state: GameState, player: PlayerKey, zone: 'graveyard' | 'exile', idx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [name] = p[zone].splice(idx, 1);
  p.battlefield.push({
    uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name, tapped: false, counters: 0, stunCounters: 0, isToken: false, note: '',
    isLand: detectLand(name), transformed: false,
  });
  addLog(s, `${name} → ${player}'s battlefield from ${zone}.`);
  return s;
}

// Move a card from graveyard to exile or exile to graveyard
export function swapZones(state: GameState, player: PlayerKey, from: 'graveyard' | 'exile', idx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const to: 'graveyard' | 'exile' = from === 'graveyard' ? 'exile' : 'graveyard';
  const [name] = p[from].splice(idx, 1);
  p[to].push(name);
  addLog(s, `${name} → ${player}'s ${to}.`);
  return s;
}

export function millCards(state: GameState, player: PlayerKey, count: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const actual = Math.min(count, p.library.length);
  const milled = p.library.splice(0, actual);
  p.graveyard.push(...milled);
  addLog(s, `${player} milled ${actual} card${actual !== 1 ? 's' : ''}.`);
  return s;
}

// keepOnTop: cards to keep on top (in order), bottomCards: cards to put on bottom
export function resolveScry(state: GameState, player: PlayerKey, keepOnTop: string[], putOnBottom: string[]): GameState {
  const s = clone(state);
  const p = s.players[player];
  // Remove scryed cards from front of library then prepend/append as decided
  const total = keepOnTop.length + putOnBottom.length;
  p.library.splice(0, total);
  p.library.unshift(...keepOnTop);
  p.library.push(...putOnBottom);
  addLog(s, `${player} scryed ${total}.`);
  return s;
}

// ── Library manipulation ────────────────────────────────────────────────────

export function handToLibrary(state: GameState, player: PlayerKey, handIdx: number, position: 'top' | 'bottom'): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.hand.splice(handIdx, 1);
  if (card === undefined) return s;
  if (position === 'top') p.library.unshift(card); else p.library.push(card);
  addLog(s, `${player} put ${card} on ${position} of library.`);
  return s;
}

export function libraryToHand(state: GameState, player: PlayerKey, idx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.library.splice(idx, 1);
  if (card === undefined) return s;
  p.hand.push(card);
  addLog(s, `${player} took ${card} from library to hand.`);
  return s;
}

export function libraryToBattlefield(state: GameState, player: PlayerKey, idx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [name] = p.library.splice(idx, 1);
  if (name === undefined) return s;
  p.battlefield.push({
    uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name, tapped: false, counters: 0, stunCounters: 0, isToken: false, note: '',
    isLand: detectLand(name), transformed: false,
  });
  addLog(s, `${name} → ${player}'s battlefield from library.`);
  return s;
}

export function libraryToGraveyard(state: GameState, player: PlayerKey, idx: number): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.library.splice(idx, 1);
  if (card === undefined) return s;
  p.graveyard.push(card);
  addLog(s, `${player} put ${card} from library into graveyard.`);
  return s;
}

// Reorder a library card to the top or bottom (manual scry/surveil control).
export function moveLibraryCard(state: GameState, player: PlayerKey, idx: number, position: 'top' | 'bottom'): GameState {
  const s = clone(state);
  const p = s.players[player];
  const [card] = p.library.splice(idx, 1);
  if (card === undefined) return s;
  if (position === 'top') p.library.unshift(card); else p.library.push(card);
  addLog(s, `${player} moved ${card} to ${position} of library.`);
  return s;
}

export function battlefieldToLibrary(state: GameState, player: PlayerKey, uid: string, position: 'top' | 'bottom'): GameState {
  const s = clone(state);
  const p = s.players[player];
  const idx = p.battlefield.findIndex(c => c.uid === uid);
  if (idx < 0) return s;
  const [card] = p.battlefield.splice(idx, 1);
  clearReferences(s, uid);
  if (!card.isToken) {
    if (position === 'top') p.library.unshift(card.name); else p.library.push(card.name);
  }
  addLog(s, `${card.name} → ${position} of ${player}'s library.`);
  return s;
}

export function shuffleLibrary(state: GameState, player: PlayerKey): GameState {
  const s = clone(state);
  const lib = s.players[player].library;
  for (let i = lib.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lib[i], lib[j]] = [lib[j], lib[i]];
  }
  addLog(s, `${player} shuffled their library.`);
  return s;
}
