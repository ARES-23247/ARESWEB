import { Territory, PlayerColor, BattleResult } from '../types';

export function rollDice(): number[] {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

export function simulateAttack(attackDice: number[], defendDice: number[]): BattleResult {
  const sortedAttack = [...attackDice].sort((a, b) => b - a);
  const sortedDefend = [...defendDice].sort((a, b) => b - a);
  const rounds = Math.min(sortedAttack.length, sortedDefend.length);

  let attackerLosses = 0;
  let defenderLosses = 0;

  for (let i = 0; i < rounds; i++) {
    if (sortedAttack[i] > sortedDefend[i]) {
      defenderLosses++;
    } else {
      attackerLosses++;
    }
  }

  return { attackerLosses, defenderLosses };
}

export function resolveAttack(
  territories: Territory[],
  attackerId: string,
  defenderId: string,
  battleResult: BattleResult,
  attackerColor: PlayerColor
): Territory[] {
  return territories.map(t => {
    if (t.id === attackerId) {
      return { ...t, armies: Math.max(1, t.armies - battleResult.attackerLosses) };
    }
    if (t.id === defenderId) {
      const newArmies = t.armies - battleResult.defenderLosses;
      if (newArmies <= 0) {
        return { ...t, owner: attackerColor, armies: 1 };
      }
      return { ...t, armies: newArmies };
    }
    return t;
  });
}

export function canDeploy(territories: Territory[], territoryId: string, playerColor: PlayerColor): boolean {
  const t = territories.find(x => x.id === territoryId);
  return t !== undefined && t.owner === playerColor;
}

export function canAttack(territories: Territory[], from: string, to: string, playerColor: PlayerColor): boolean {
  const fromT = territories.find(x => x.id === from);
  const toT = territories.find(x => x.id === to);
  return (
    fromT !== undefined &&
    toT !== undefined &&
    fromT.owner === playerColor &&
    toT.owner !== null &&
    toT.owner !== playerColor &&
    fromT.armies > 1 &&
    fromT.neighbors.includes(to)
  );
}

export function canReinforce(territories: Territory[], from: string, to: string, playerColor: PlayerColor): boolean {
  const fromT = territories.find(x => x.id === from);
  const toT = territories.find(x => x.id === to);
  return (
    fromT !== undefined &&
    toT !== undefined &&
    fromT.owner === playerColor &&
    toT.owner === playerColor &&
    fromT.armies > 1 &&
    fromT.neighbors.includes(to)
  );
}

export function reinforce(
  territories: Territory[],
  from: string,
  to: string,
  amount: number
): Territory[] {
  return territories.map(t => {
    if (t.id === from) {
      return { ...t, armies: t.armies - amount };
    }
    if (t.id === to) {
      return { ...t, armies: t.armies + amount };
    }
    return t;
  });
}

export function calculateDeployCount(territories: Territory[], playerColor: PlayerColor): number {
  const ownedCount = territories.filter(t => t.owner === playerColor).length;
  return Math.max(3, Math.floor(ownedCount / 3));
}
