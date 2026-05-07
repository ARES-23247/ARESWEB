import { Territory, PlayerColor } from '../types';

export interface AIAttack {
  from: string;
  to: string;
}

export function aiDeploy(territories: Territory[], playerColor: PlayerColor, count: number): Territory[] {
  const myTerritories = territories.filter(t => t.owner === playerColor);
  const borderTerritories = myTerritories.filter(t =>
    t.neighbors.some(nId => {
      const n = territories.find(x => x.id === nId);
      return n && n.owner !== playerColor;
    })
  );

  // Prioritize borders, especially weak ones
  const sorted = [...borderTerritories].sort((a, b) => a.armies - b.armies);

  const newTerritories = [...territories];
  for (let i = 0; i < count && sorted.length > 0; i++) {
    const target = sorted[i % sorted.length];
    const idx = newTerritories.findIndex(t => t.id === target.id);
    if (idx >= 0) newTerritories[idx] = { ...target, armies: target.armies + 1 };
  }

  return newTerritories;
}

export function aiSelectAttack(territories: Territory[], playerColor: PlayerColor): AIAttack | null {
  const myTerritories = territories.filter(t => t.owner === playerColor && t.armies > 1);
  const attacks: { from: string; to: string; strength: number }[] = [];

  myTerritories.forEach(from => {
    from.neighbors.forEach(nId => {
      const to = territories.find(t => t.id === nId);
      if (to && to.owner !== playerColor) {
        const strength = from.armies - to.armies;
        if (strength > 0) {
          attacks.push({ from: from.id, to: to.id, strength });
        }
      }
    });
  });

  if (attacks.length === 0) return null;

  // Pick best attack, with some randomness
  attacks.sort((a, b) => b.strength - a.strength);
  const top = attacks.slice(0, Math.max(1, Math.floor(attacks.length / 3)));
  return top[Math.floor(Math.random() * top.length)];
}
