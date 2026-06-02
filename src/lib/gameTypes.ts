export type PlayerKey = 'player1' | 'player2';

export type GameStep = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';

export interface BattlefieldCard {
  uid: string;
  name: string;
  tapped: boolean;
  counters: number;
  isToken: boolean;
  note: string;
  isLand: boolean;
}

export interface PlayerGameState {
  name: string;
  life: number;
  poison: number;
  library: string[];
  hand: string[];
  battlefield: BattlefieldCard[];
  graveyard: string[];
  exile: string[];
  ready: boolean;
}

export interface GameState {
  phase: 'setup' | 'playing' | 'ended';
  turn: number;
  activePlayer: PlayerKey;
  step: GameStep;
  players: {
    player1: PlayerGameState;
    player2: PlayerGameState;
  };
  log: string[];
  winner?: PlayerKey;
}

export interface GameSession {
  id: string;
  room_code: string;
  state: GameState;
  created_at: string;
  updated_at: string;
}
