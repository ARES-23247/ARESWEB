import { Continent, PlayerConfig } from './types';

export const PLAYER_COLORS: Record<PlayerColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  black: '#71717a',
};

export const CONTINENTS: Continent[] = [
  { name: 'North America', bonus: 5, territories: [] },
  { name: 'South America', bonus: 2, territories: [] },
  { name: 'Europe', bonus: 5, territories: [] },
  { name: 'Africa', bonus: 3, territories: [] },
  { name: 'Asia', bonus: 7, territories: [] },
  { name: 'Australia', bonus: 2, territories: [] },
];

export const DEFAULT_PLAYERS: PlayerConfig[] = [
  { color: 'red', name: 'Red Empire', emoji: '🔴', isAI: false, isActive: true },
  { color: 'blue', name: 'Blue Legion', emoji: '🔵', isAI: true, isActive: true },
  { color: 'green', name: 'Green Horde', emoji: '🟢', isAI: true, isActive: true },
  { color: 'yellow', name: 'Golden Khanate', emoji: '🟡', isAI: true, isActive: true },
  { color: 'purple', name: 'Purple Dynasty', emoji: '🟣', isAI: true, isActive: false },
  { color: 'black', name: 'Black Pact', emoji: '⚫', isAI: true, isActive: false },
];

type PlayerColor = import('./types').PlayerColor;
