export type PlayerKey = 'player1' | 'player2';

export interface PlayerState {
  name: string;
  picks: string[];
}

export interface DraftState {
  phase: 'waiting' | 'drafting' | 'done';
  deck: string[];
  piles: string[][];
  players: {
    player1: PlayerState;
    player2: PlayerState;
  };
  currentPlayer: PlayerKey;
  currentPileIndex: number;
  deckBuilds?: {
    player1?: string[];
    player2?: string[];
  };
}

export interface DraftSession {
  id: string;
  room_code: string;
  state: DraftState;
  created_at: string;
  updated_at: string;
}
