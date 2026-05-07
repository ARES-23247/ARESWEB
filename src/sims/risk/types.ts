export type GamePhase = 'setup' | 'deploy' | 'attack' | 'reinforce' | 'gameover';

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'black';

export interface Territory {
  id: string;
  name: string;
  owner: PlayerColor | null;
  armies: number;
  neighbors: string[];
  continent: string;
  x: number;
  y: number;
}

export interface Continent {
  name: string;
  bonus: number;
  territories: string[];
}

export interface Player {
  color: PlayerColor;
  name: string;
  emoji: string;
  isAI: boolean;
}

export interface PlayerConfig {
  color: PlayerColor;
  name: string;
  emoji: string;
  isAI: boolean;
  isActive: boolean;
}

export interface BattleResult {
  attackerLosses: number;
  defenderLosses: number;
}
