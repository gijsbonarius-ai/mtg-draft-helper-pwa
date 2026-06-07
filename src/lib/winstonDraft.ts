import type { DraftState } from './types';
import { CUBE_CARDS } from './cards';

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

function checkDone(state: DraftState): DraftState {
  if (state.deck.length === 0 && state.piles.every(p => p.length === 0)) {
    state.phase = 'done';
  }
  return state;
}

export function initDraft(hostName: string, cardCount: number = 360): DraftState {
  const shuffled = shuffle(CUBE_CARDS).slice(0, cardCount);
  return {
    phase: 'waiting',
    deck: shuffled.slice(3),
    piles: [[shuffled[0]], [shuffled[1]], [shuffled[2]]],
    players: {
      player1: { name: hostName, picks: [] },
      player2: { name: '', picks: [] },
    },
    currentPlayer: 'player1',
    currentPileIndex: 0,
  };
}

export function joinDraft(state: DraftState, guestName: string): DraftState {
  const s = clone(state);
  s.players.player2.name = guestName;
  s.phase = 'drafting';
  return s;
}

export function takePile(state: DraftState): DraftState {
  const s = clone(state);
  const player = s.currentPlayer;
  const idx = s.currentPileIndex;

  s.players[player].picks.push(...s.piles[idx]);

  if (s.deck.length > 0) {
    s.piles[idx] = [s.deck.shift()!];
  } else {
    s.piles[idx] = [];
  }

  s.currentPlayer = player === 'player1' ? 'player2' : 'player1';
  s.currentPileIndex = 0;
  return checkDone(s);
}

export function passPile(state: DraftState): DraftState {
  const s = clone(state);
  const idx = s.currentPileIndex;

  if (s.deck.length > 0) {
    s.piles[idx].push(s.deck.shift()!);
  }

  s.currentPileIndex = idx + 1;

  if (s.currentPileIndex >= 3) {
    // Forced draw: take top card from deck if available (all 3 piles were passed)
    const forced = s.deck.shift();
    if (forced !== undefined) {
      s.players[s.currentPlayer].picks.push(forced);
    }
    s.currentPlayer = s.currentPlayer === 'player1' ? 'player2' : 'player1';
    s.currentPileIndex = 0;
    return checkDone(s);
  }

  return s;
}
