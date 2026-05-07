import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';

type GamePhase = 'setup' | 'deploy' | 'attack' | 'reinforce' | 'gameover';
// Unused type retained for potential future use
// type GameMode = 'hotseat' | 'ai';
type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'black';

interface Territory {
  id: string;
  name: string;
  owner: PlayerColor | null;
  armies: number;
  neighbors: string[];
  continent: string;
  x: number;
  y: number;
}

interface Continent {
  name: string;
  bonus: number;
  territories: string[];
}

interface Player {
  color: PlayerColor;
  name: string;
  emoji: string;
  isAI: boolean;
}

// Unused constant retained for potential future use
// const PLAYERS: Player[] = [
//   { color: 'red', name: 'Red Empire', emoji: '🔴', isAI: false },
//   { color: 'blue', name: 'Blue Legion', emoji: '🔵', isAI: true },
//   { color: 'green', name: 'Green Horde', emoji: '🟢', isAI: true },
//   { color: 'yellow', name: 'Golden Khanate', emoji: '🟡', isAI: true },
//   { color: 'purple', name: 'Purple Dynasty', emoji: '🟣', isAI: true },
//   { color: 'black', name: 'Black Pact', emoji: '⚫', isAI: true },
// ];

const PLAYER_COLORS: Record<PlayerColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  black: '#71717a',
};

const CONTINENTS: Continent[] = [
  { name: 'North America', bonus: 5, territories: [] },
  { name: 'South America', bonus: 2, territories: [] },
  { name: 'Europe', bonus: 5, territories: [] },
  { name: 'Africa', bonus: 3, territories: [] },
  { name: 'Asia', bonus: 7, territories: [] },
  { name: 'Australia', bonus: 2, territories: [] },
];

function createWorldMap(): Territory[] {
  const territories: Territory[] = [
    // North America
    { id: 'alaska', name: 'Alaska', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 70, y: 80 },
    { id: 'nwt', name: 'NW Territory', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 130, y: 90 },
    { id: 'alberta', name: 'Alberta', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 150, y: 130 },
    { id: 'ontario', name: 'Ontario', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 190, y: 110 },
    { id: 'quebec', name: 'Quebec', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 230, y: 120 },
    { id: 'westernus', name: 'Western US', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 140, y: 180 },
    { id: 'easternus', name: 'Eastern US', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 200, y: 170 },
    { id: 'centralamerica', name: 'Central America', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 160, y: 230 },

    // South America
    { id: 'venezuela', name: 'Venezuela', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 190, y: 270 },
    { id: 'peru', name: 'Peru', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 200, y: 320 },
    { id: 'brazil', name: 'Brazil', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 250, y: 300 },
    { id: 'argentina', name: 'Argentina', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 220, y: 380 },

    // Europe
    { id: 'iceland', name: 'Iceland', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 330, y: 70 },
    { id: 'scandinavia', name: 'Scandinavia', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 380, y: 60 },
    { id: 'uk', name: 'UK', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 340, y: 100 },
    { id: 'northerneurope', name: 'Northern Europe', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 400, y: 110 },
    { id: 'westerneurope', name: 'Western Europe', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 370, y: 150 },
    { id: 'southerneurope', name: 'Southern Europe', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 430, y: 160 },

    // Africa
    { id: 'northwestafrica', name: 'NW Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 350, y: 210 },
    { id: 'egypt', name: 'Egypt', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 460, y: 200 },
    { id: 'eastafrica', name: 'East Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 500, y: 250 },
    { id: 'centralsafrica', name: 'Central Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 440, y: 280 },
    { id: 'southafrica', name: 'South Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 460, y: 360 },
    { id: 'madagascar', name: 'Madagascar', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 540, y: 330 },

    // Asia
    { id: 'ural', name: 'Ural', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 480, y: 90 },
    { id: 'siberia', name: 'Siberia', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 560, y: 60 },
    { id: 'yakutsk', name: 'Yakutsk', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 640, y: 50 },
    { id: 'kamchatka', name: 'Kamchatka', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 710, y: 70 },
    { id: 'afghanistan', name: 'Afghanistan', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 520, y: 140 },
    { id: 'china', name: 'China', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 600, y: 150 },
    { id: 'mongolia', name: 'Mongolia', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 630, y: 110 },
    { id: 'japan', name: 'Japan', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 730, y: 130 },
    { id: 'middleeast', name: 'Middle East', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 480, y: 180 },
    { id: 'india', name: 'India', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 560, y: 200 },
    { id: 'siam', name: 'Siam', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 620, y: 230 },

    // Australia
    { id: 'indonesia', name: 'Indonesia', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 640, y: 300 },
    { id: 'newguinea', name: 'New Guinea', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 700, y: 280 },
    { id: 'westernaustralia', name: 'Western Australia', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 650, y: 360 },
    { id: 'easternaustralia', name: 'Eastern Australia', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 720, y: 350 },
  ];

  // Define neighbors (simplified for gameplay)
  const neighbors: Record<string, string[]> = {
    alaska: ['nwt', 'alberta', 'kamchatka'],
    nwt: ['alaska', 'alberta', 'ontario', 'alaska'],
    alberta: ['alaska', 'nwt', 'ontario', 'westernus'],
    ontario: ['nwt', 'alberta', 'westernus', 'easternus', 'quebec'],
    quebec: ['ontario', 'easternus'],
    westernus: ['alberta', 'ontario', 'easternus', 'centralamerica'],
    easternus: ['ontario', 'quebec', 'westernus', 'centralamerica'],
    centralamerica: ['westernus', 'easternus', 'venezuela'],

    venezuela: ['centralamerica', 'peru', 'brazil'],
    peru: ['venezuela', 'brazil', 'argentina'],
    brazil: ['venezuela', 'peru', 'argentina', 'northwestafrica'],
    argentina: ['peru', 'brazil'],

    iceland: ['uk', 'scandinavia', 'greenland'],
    scandinavia: ['iceland', 'uk', 'northerneurope', 'ural'],
    uk: ['iceland', 'scandinavia', 'northerneurope', 'westerneurope'],
    northerneurope: ['scandinavia', 'uk', 'westerneurope', 'southerneurope', 'ural'],
    westerneurope: ['uk', 'northerneurope', 'southerneurope', 'northwestafrica'],
    southerneurope: ['northerneurope', 'westerneurope', 'egypt', 'middleeast'],

    northwestafrica: ['westerneurope', 'brazil', 'egypt', 'centralsafrica'],
    egypt: ['southerneurope', 'northwestafrica', 'eastafrica', 'middleeast'],
    eastafrica: ['egypt', 'centralsafrica', 'southafrica', 'madagascar', 'middleeast'],
    centralafrica: ['northwestafrica', 'egypt', 'eastafrica', 'southafrica'],
    southafrica: ['centralafrica', 'eastafrica', 'madagascar'],
    madagascar: ['eastafrica', 'southafrica'],

    ural: ['scandinavia', 'northerneurope', 'afghanistan', 'siberia', 'china'],
    siberia: ['ural', 'yakutsk', 'mongolia', 'china'],
    yakutsk: ['siberia', 'kamchatka'],
    kamchatka: ['yakutsk', 'siberia', 'mongolia', 'japan', 'alaska'],
    afghanistan: ['ural', 'china', 'india', 'middleeast'],
    china: ['ural', 'afghanistan', 'india', 'siam', 'mongolia', 'siberia'],
    mongolia: ['siberia', 'china', 'kamchatka'],
    japan: ['kamchatka', 'mongolia'],
    middleeast: ['southerneurope', 'egypt', 'eastafrica', 'india', 'afghanistan'],
    india: ['afghanistan', 'china', 'siam', 'middleeast'],
    siam: ['china', 'india', 'indonesia'],

    indonesia: ['siam', 'newguinea', 'westernaustralia', 'easternaustralia'],
    newguinea: ['indonesia', 'easternaustralia', 'westernaustralia'],
    westernaustralia: ['indonesia', 'newguinea', 'easternaustralia'],
    easternaustralia: ['indonesia', 'newguinea', 'westernaustralia'],
  };

  territories.forEach(t => {
    t.neighbors = neighbors[t.id] || [];
  });

  // Update continent territories
  territories.forEach(t => {
    const continent = CONTINENTS.find(c => c.name === t.continent);
    if (continent) {
      continent.territories.push(t.id);
    }
  });

  return territories;
}

function rollDice(): number[] {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

function simulateAttack(attackDice: number[], defendDice: number[]): { attackerLosses: number; defenderLosses: number } {
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

function getContinentBonus(territories: Territory[], playerColor: PlayerColor): number {
  let bonus = 0;
  CONTINENTS.forEach(continent => {
    const ownsAll = continent.territories.every(tId => {
      const t = territories.find(x => x.id === tId);
      return t?.owner === playerColor;
    });
    if (ownsAll) bonus += continent.bonus;
  });
  return bonus;
}

// AI Logic
function aiDeploy(territories: Territory[], playerColor: PlayerColor, count: number): Territory[] {
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

function aiSelectAttack(territories: Territory[], playerColor: PlayerColor): { from: string; to: string } | null {
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

interface PlayerConfig {
  color: PlayerColor;
  name: string;
  emoji: string;
  isAI: boolean;
  isActive: boolean;
}

const DEFAULT_PLAYERS: PlayerConfig[] = [
  { color: 'red', name: 'Red Empire', emoji: '🔴', isAI: false, isActive: true },
  { color: 'blue', name: 'Blue Legion', emoji: '🔵', isAI: true, isActive: true },
  { color: 'green', name: 'Green Horde', emoji: '🟢', isAI: true, isActive: true },
  { color: 'yellow', name: 'Golden Khanate', emoji: '🟡', isAI: true, isActive: true },
  { color: 'purple', name: 'Purple Dynasty', emoji: '🟣', isAI: true, isActive: false },
  { color: 'black', name: 'Black Pact', emoji: '⚫', isAI: true, isActive: false },
];

export default function SimComponent() {
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>(DEFAULT_PLAYERS);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [targetTerritory, setTargetTerritory] = useState<string | null>(null);
  const [deployRemaining, setDeployRemaining] = useState(5);
  const [message, setMessage] = useState('');
  const [attackDice, setAttackDice] = useState<number[]>([]);
  const [defendDice, setDefendDice] = useState<number[]>([]);
  const [battleResult, setBattleResult] = useState<{ attackerLosses: number; defenderLosses: number } | null>(null);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [reinforceAmount, setReinforceAmount] = useState(0);
  const [isAIThinking, setIsAIThinking] = useState(false);

  // Get current active player
  const currentPlayer = activePlayers[currentPlayerIdx] || DEFAULT_PLAYERS[0];
  const ownedTerritories = territories.filter(t => t.owner === currentPlayer.color);
  const totalArmies = ownedTerritories.reduce((sum, t) => sum + t.armies, 0);

  // Start game with configured players
  const startGame = useCallback(() => {
    const active = playerConfigs.filter(p => p.isActive);
    if (active.length < 2) return;

    const players: Player[] = active.map(p => ({
      color: p.color,
      name: p.name,
      emoji: p.emoji,
      isAI: p.isAI,
    }));

    const initial = createWorldMap();
    const unclaimed = [...initial].sort(() => Math.random() - 0.5);

    active.forEach((player, idx) => {
      const startCount = Math.floor(unclaimed.length / (active.length - idx));
      for (let i = 0; i < startCount && unclaimed.length > 0; i++) {
        const t = unclaimed.pop();
        if (t) {
          const tIdx = initial.findIndex(x => x.id === t.id);
          initial[tIdx] = { ...t, owner: player.color, armies: 3 };
        }
      }
    });

    setActivePlayers(players);
    setTerritories(initial);
    setCurrentPlayerIdx(0);
    setPhase('deploy');
    setDeployRemaining(5);
    setSelectedTerritory(null);
    setTargetTerritory(null);
    setAttackDice([]);
    setDefendDice([]);
    setBattleResult(null);
    setWinner(null);
    setReinforceAmount(0);
    setMessage(`🎮 ${players[0].name}'s turn - Deploy 5 armies!`);
  }, [playerConfigs]);

  // Calculate continent bonuses
  const continentBonuses = useMemo(() => {
    if (territories.length === 0) return {};
    const bonuses: Record<string, number> = {};
    playerConfigs.forEach(p => {
      bonuses[p.color] = getContinentBonus(territories, p.color);
    });
    return bonuses;
  }, [territories, playerConfigs]);

  const canDeploy = (territoryId: string): boolean => {
    const t = territories.find(x => x.id === territoryId);
    return t !== undefined && t.owner === currentPlayer.color;
  };

  const canAttack = (from: string, to: string): boolean => {
    const fromT = territories.find(x => x.id === from);
    const toT = territories.find(x => x.id === to);
    return (
      fromT !== undefined &&
      toT !== undefined &&
      fromT.owner === currentPlayer.color &&
      toT.owner !== null &&
      toT.owner !== currentPlayer.color &&
      fromT.armies > 1 &&
      fromT.neighbors.includes(to)
    );
  };

  const canReinforce = (from: string, to: string): boolean => {
    const fromT = territories.find(x => x.id === from);
    const toT = territories.find(x => x.id === to);
    return (
      fromT !== undefined &&
      toT !== undefined &&
      fromT.owner === currentPlayer.color &&
      toT.owner === currentPlayer.color &&
      fromT.armies > 1 &&
      fromT.neighbors.includes(to)
    );
  };

  const handleDeploy = useCallback(
    (territoryId: string) => {
      const t = territories.find(x => x.id === territoryId);
      const canDeployHere = t !== undefined && t.owner === currentPlayer.color;

      if (phase !== 'deploy' || deployRemaining <= 0 || !canDeployHere || currentPlayer.isAI) return;

      setTerritories(prev =>
        prev.map(t => (t.id === territoryId ? { ...t, armies: t.armies + 1 } : t))
      );
      setDeployRemaining(prev => prev - 1);

      if (deployRemaining === 1) {
        setPhase('attack');
        setMessage('Select your territory to attack from!');
      }
    },
    [phase, deployRemaining, currentPlayer, territories]
  );

  const handleAttack = useCallback(() => {
    if (!selectedTerritory || !targetTerritory || phase !== 'attack') return;

    const attacker = territories.find(t => t.id === selectedTerritory);
    const defender = territories.find(t => t.id === targetTerritory);

    if (!attacker || !defender) return;

    const attackCount = Math.min(3, attacker.armies - 1);
    const defendCount = Math.min(2, defender.armies);

    const atkDice = rollDice().slice(0, attackCount);
    const defDice = rollDice().slice(0, defendCount);

    setAttackDice(atkDice);
    setDefendDice(defDice);

    const result = simulateAttack(atkDice, defDice);
    setBattleResult(result);

    setTerritories(prev =>
      prev.map(t => {
        if (t.id === selectedTerritory) {
          return { ...t, armies: Math.max(1, t.armies - result.attackerLosses) };
        }
        if (t.id === targetTerritory) {
          const newArmies = t.armies - result.defenderLosses;
          if (newArmies <= 0) {
            return { ...t, owner: currentPlayer.color, armies: 1 };
          }
          return { ...t, armies: newArmies };
        }
        return t;
      })
    );

    setMessage(
      `Attacker rolled ${atkDice.join(', ')} | Defender rolled ${defDice.join(', ')} | ` +
        `Lost ${result.attackerLosses} vs ${result.defenderLosses}`
    );
  }, [selectedTerritory, targetTerritory, phase, territories, currentPlayer]);

  const handleReinforce = useCallback(() => {
    if (!selectedTerritory || !targetTerritory || reinforceAmount <= 0) return;

    setTerritories(prev =>
      prev.map(t => {
        if (t.id === selectedTerritory) {
          return { ...t, armies: t.armies - reinforceAmount };
        }
        if (t.id === targetTerritory) {
          return { ...t, armies: t.armies + reinforceAmount };
        }
        return t;
      })
    );

    setReinforceAmount(0);
    setMessage('Reinforced! Continue or end turn.');
  }, [selectedTerritory, targetTerritory, reinforceAmount]);

  const endTurn = useCallback(() => {
    const remainingPlayers = new Set(territories.map(t => t.owner).filter((o): o is PlayerColor => o !== null));
    const activePlayerCount = remainingPlayers.size;

    // Find next active player
    let nextIdx = (currentPlayerIdx + 1) % activePlayers.length;
    let loopCount = 0;
    while (loopCount < activePlayers.length) {
      if (remainingPlayers.has(activePlayers[nextIdx].color)) break;
      nextIdx = (nextIdx + 1) % activePlayers.length;
      loopCount++;
    }

    if (activePlayerCount === 1) {
      setWinner([...remainingPlayers][0]);
      setPhase('gameover');
      const winnerName = activePlayers.find(p => p.color === [...remainingPlayers][0])?.name;
      setMessage(`🎉 ${winnerName} conquers the world!`);
      return;
    }

    setCurrentPlayerIdx(nextIdx);
    setPhase('deploy');
    const bonus = 3 + (continentBonuses[activePlayers[nextIdx].color] || 0);
    setDeployRemaining(bonus);
    setSelectedTerritory(null);
    setTargetTerritory(null);
    setAttackDice([]);
    setDefendDice([]);
    setBattleResult(null);
    setReinforceAmount(0);

    setMessage(`${activePlayers[nextIdx].emoji} ${activePlayers[nextIdx].name}'s turn - Deploy ${bonus} armies!`);
  }, [currentPlayerIdx, territories, continentBonuses, activePlayers]);

  const handleReset = useCallback(() => {
    setPhase('setup');
    setActivePlayers([]);
    setTerritories([]);
    setSelectedTerritory(null);
    setTargetTerritory(null);
    setMessage('');
    setAttackDice([]);
    setDefendDice([]);
    setBattleResult(null);
    setWinner(null);
    setReinforceAmount(0);
  }, []);

  // AI Turn Execution
  const aiExecutingRef = useRef(false);

  useEffect(() => {
    if (!currentPlayer.isAI || winner || phase === 'gameover' || aiExecutingRef.current) return;

    aiExecutingRef.current = true;
    setIsAIThinking(true);

    const executeAITurn = async () => {
      await new Promise(r => setTimeout(r, 800));

      // Deploy phase
      if (phase === 'deploy') {
        for (let i = 0; i < deployRemaining; i++) {
          await new Promise(r => setTimeout(r, 300));
          setTerritories(prev => aiDeploy(prev, currentPlayer.color, 1));
        }
        setDeployRemaining(0);
        setPhase('attack');
        setMessage(`${currentPlayer.name} is attacking...`);
        await new Promise(r => setTimeout(r, 500));
      }

      // Attack phase
      if (phase === 'attack') {
        let attacks = 0;
        const maxAttacks = 5;

        while (attacks < maxAttacks) {
          const attack = aiSelectAttack(territories, currentPlayer.color);
          if (!attack) break;

          const attacker = territories.find(t => t.id === attack.from);
          const defender = territories.find(t => t.id === attack.to);

          if (!attacker || !defender || attacker.armies <= 1) break;

          const attackCount = Math.min(3, attacker.armies - 1);
          const defendCount = Math.min(2, defender.armies);
          const atkDice = rollDice().slice(0, attackCount);
          const defDice = rollDice().slice(0, defendCount);
          const result = simulateAttack(atkDice, defDice);

          setAttackDice(atkDice);
          setDefendDice(defDice);
          setBattleResult(result);

          await new Promise(r => setTimeout(r, 600));

          setTerritories(prev => prev.map(t => {
            if (t.id === attack.from) {
              return { ...t, armies: Math.max(1, t.armies - result.attackerLosses) };
            }
            if (t.id === attack.to) {
              const newArmies = t.armies - result.defenderLosses;
              if (newArmies <= 0) {
                return { ...t, owner: currentPlayer.color, armies: 1 };
              }
              return { ...t, armies: newArmies };
            }
            return t;
          }));

          attacks++;
          await new Promise(r => setTimeout(r, 400));
        }

        setPhase('reinforce');
        setMessage(`${currentPlayer.name} reinforces...`);
        await new Promise(r => setTimeout(r, 500));
      }

      // Reinforce phase - skip for simplicity
      setIsAIThinking(false);
      aiExecutingRef.current = false;
      endTurn();
    };

    executeAITurn();
  }, [currentPlayer.isAI, phase, territories, currentPlayer, deployRemaining, winner, endTurn]);

  const renderTerritory = (t: Territory) => {
    const isSelected = t.id === selectedTerritory;
    const isTarget = t.id === targetTerritory;
    const canActAsTarget = phase === 'attack' && selectedTerritory && canAttack(selectedTerritory, t.id);
    const canActAsReinforceTarget = phase === 'reinforce' && selectedTerritory && canReinforce(selectedTerritory, t.id);

    let fillColor = t.owner ? `${PLAYER_COLORS[t.owner]}40` : 'rgba(30,41,59,0.8)';
    let strokeColor = t.owner ? PLAYER_COLORS[t.owner] : 'rgba(71,85,105,0.5)';
    let strokeWidth = 1;

    if (isSelected) {
      fillColor = `${PLAYER_COLORS[currentPlayer.color]}80`;
      strokeWidth = 3;
    }

    if (isTarget) {
      fillColor = 'rgba(239,68,68,0.6)';
      strokeColor = '#ef4444';
      strokeWidth = 3;
    }

    if (canActAsTarget) {
      strokeColor = '#f97316';
      strokeWidth = 2;
    }

    if (canActAsReinforceTarget) {
      strokeColor = '#22c55e';
      strokeWidth = 2;
    }

    return (
      <g key={t.id} style={{ cursor: 'pointer' }}>
        <ellipse
          cx={t.x}
          cy={t.y}
          rx={22}
          ry={18}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          onClick={() => {
            if (currentPlayer.isAI || isAIThinking) return;

            if (phase === 'deploy' && canDeploy(t.id)) {
              handleDeploy(t.id);
            } else if (phase === 'attack') {
              if (!selectedTerritory) {
                if (t.owner === currentPlayer.color && t.armies > 1) {
                  setSelectedTerritory(t.id);
                  setTargetTerritory(null);
                }
              } else if (selectedTerritory === t.id) {
                setSelectedTerritory(null);
                setTargetTerritory(null);
              } else if (canAttack(selectedTerritory, t.id)) {
                setTargetTerritory(t.id);
              }
            } else if (phase === 'reinforce') {
              if (!selectedTerritory) {
                if (t.owner === currentPlayer.color && t.armies > 1) {
                  setSelectedTerritory(t.id);
                  setReinforceAmount(0);
                }
              } else if (selectedTerritory === t.id) {
                setSelectedTerritory(null);
                setTargetTerritory(null);
                setReinforceAmount(0);
              } else if (canReinforce(selectedTerritory, t.id)) {
                setTargetTerritory(t.id);
              }
            }
          }}
        />
        <text
          x={t.x}
          y={t.y - 12}
          textAnchor="middle"
          fill="#fff"
          fontSize="7"
          fontFamily="monospace"
          style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          {t.name.slice(0, 10)}
        </text>

        {/* Troop Graphics - Multiple soldier icons based on army count */}
        <g style={{ pointerEvents: 'none' }}>
          {t.owner && (() => {
            const troopColor = PLAYER_COLORS[t.owner];
            const displayCount = Math.min(t.armies, 9); // Max 9 icons displayed

            // Position troops in a 3x3 grid pattern
            const positions = [
              { dx: 0, dy: -6 },     // Top center
              { dx: -8, dy: 0 },    // Mid left
              { dx: 8, dy: 0 },     // Mid right
              { dx: -8, dy: -6 },   // Top left
              { dx: 8, dy: -6 },    // Top right
              { dx: -8, dy: 6 },    // Bottom left
              { dx: 8, dy: 6 },     // Bottom right
              { dx: 0, dy: 6 },     // Bottom center
              { dx: 0, dy: 0 },     // Center
            ];

            // Castle for territories with 10+ armies
            if (t.armies >= 10) {
              return (
                <g transform={`translate(${t.x}, ${t.y - 2})`}>
                  {/* Castle icon */}
                  <path
                    d="M-8,8 L-8,0 L-5,0 L-5,-4 L-2,-4 L-2,0 L2,0 L2,-4 L5,-4 L5,0 L8,0 L8,8 Z"
                    fill={troopColor}
                    opacity="0.8"
                    stroke="#fff"
                    strokeWidth="0.5"
                  />
                  {/* Flag */}
                  <line x1="0" y1="-4" x2="0" y2="-10" stroke="#fff" strokeWidth="1" />
                  <path
                    d="M0,-10 L4,-8 L0,-6 Z"
                    fill="#fff"
                  />
                  {/* Army count */}
                  <text
                    x="0"
                    y="14"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="Orbitron"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                  >
                    {t.armies}
                  </text>
                </g>
              );
            }

            return positions.slice(0, displayCount).map((pos, i) => (
              <g key={i} transform={`translate(${t.x + pos.dx}, ${t.y + pos.dy})`}>
                {/* Soldier silhouette */}
                <ellipse
                  cx="0"
                  cy="-2"
                  rx="3"
                  ry="2"
                  fill={troopColor}
                  opacity="0.9"
                />
                <circle
                  cx="0"
                  cy="-5"
                  r="1.8"
                  fill={troopColor}
                  opacity="0.9"
                />
                {/* Weapon */}
                <line
                  x1="2"
                  y1="-4"
                  x2="4"
                  y2="-8"
                  stroke={troopColor}
                  strokeWidth="1"
                  opacity="0.7"
                />
              </g>
            ));
          })()}
        </g>
      </g>
    );
  };

  return (
    <div
      className="sim-container"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        gap: '14px',
        overflow: 'auto',
        color: 'var(--ares-offwhite)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <span className="sim-title" style={{ margin: 0, fontSize: '22px' }}>⚔️ TERRITORY CONQUEST</span>
        <span style={{ fontSize: '12px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>
          {phase.toUpperCase()} PHASE
        </span>
        {isAIThinking && (
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a855f7', animation: 'pulse 1s infinite' }}>
            🤖 AI THINKING...
          </span>
        )}
      </div>

      {/* Setup Screen */}
      {phase === 'setup' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            padding: '30px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '12px',
            border: '1px solid var(--ares-gray-dark)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🌍 World Domination Setup</div>
            <div style={{ fontSize: '14px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>
              Select 2-6 players and choose AI or Human control
            </div>
          </div>

          {/* Player Config */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px',
              width: '100%',
              maxWidth: '900px',
            }}
          >
            {playerConfigs.map((config, idx) => (
              <div
                key={config.color}
                style={{
                  padding: '16px',
                  background: config.isActive ? `${PLAYER_COLORS[config.color]}15` : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${config.isActive ? PLAYER_COLORS[config.color] : 'var(--ares-gray-dark)'}`,
                  borderRadius: '8px',
                  opacity: config.isActive ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{config.emoji}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: '"Orbitron", sans-serif' }}>
                      {config.name}
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--ares-muted)' }}>
                      {config.color.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const activeCount = playerConfigs.filter(p => p.isActive).length;
                      if (config.isActive || activeCount > 2) {
                        setPlayerConfigs(prev =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, isActive: !p.isActive, isAI: !p.isActive ? p.isAI : true } : p
                          )
                        );
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: config.isActive ? `${PLAYER_COLORS[config.color]}30` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${config.isActive ? PLAYER_COLORS[config.color] : 'var(--ares-gray-dark)'}`,
                      color: config.isActive ? PLAYER_COLORS[config.color] : 'var(--ares-muted)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {config.isActive ? '✓ ACTIVE' : 'INACTIVE'}
                  </button>

                  <button
                    onClick={() => {
                      setPlayerConfigs(prev =>
                        prev.map((p, i) => (i === idx ? { ...p, isAI: !p.isAI } : p))
                      );
                    }}
                    disabled={!config.isActive}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: config.isActive && !config.isAI ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)',
                      border: config.isActive && !config.isAI ? '1px solid #22c55e' : '1px solid #a855f7',
                      color: config.isActive && !config.isAI ? '#22c55e' : '#a855f7',
                      borderRadius: '4px',
                      cursor: config.isActive ? 'pointer' : 'default',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      opacity: config.isActive ? 1 : 0.4,
                    }}
                  >
                    {config.isAI ? '🤖 AI' : '👤 HUMAN'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Select */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setPlayerConfigs([
                  { ...DEFAULT_PLAYERS[0], isActive: true, isAI: false },
                  { ...DEFAULT_PLAYERS[1], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[2], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[3], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[4], isActive: false, isAI: true },
                  { ...DEFAULT_PLAYERS[5], isActive: false, isAI: true },
                ]);
              }}
              style={{
                padding: '10px 20px',
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '12px',
              }}
            >
              1 HUMAN vs 3 AI
            </button>
            <button
              onClick={() => {
                setPlayerConfigs([
                  { ...DEFAULT_PLAYERS[0], isActive: true, isAI: false },
                  { ...DEFAULT_PLAYERS[1], isActive: true, isAI: false },
                  { ...DEFAULT_PLAYERS[2], isActive: true, isAI: false },
                  { ...DEFAULT_PLAYERS[3], isActive: true, isAI: false },
                  { ...DEFAULT_PLAYERS[4], isActive: false, isAI: true },
                  { ...DEFAULT_PLAYERS[5], isActive: false, isAI: true },
                ]);
              }}
              style={{
                padding: '10px 20px',
                background: 'rgba(34,197,94,0.2)',
                border: '1px solid #22c55e',
                color: '#22c55e',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '12px',
              }}
            >
              4 HUMAN HOTSEAT
            </button>
            <button
              onClick={() => {
                setPlayerConfigs([
                  { ...DEFAULT_PLAYERS[0], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[1], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[2], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[3], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[4], isActive: true, isAI: true },
                  { ...DEFAULT_PLAYERS[5], isActive: true, isAI: true },
                ]);
              }}
              style={{
                padding: '10px 20px',
                background: 'rgba(168,85,247,0.2)',
                border: '1px solid #a855f7',
                color: '#a855f7',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '12px',
              }}
            >
              6 AI BATTLE
            </button>
          </div>

          {/* Start Button */}
          <button
            onClick={startGame}
            disabled={playerConfigs.filter(p => p.isActive).length < 2}
            style={{
              padding: '16px 48px',
              background: playerConfigs.filter(p => p.isActive).length >= 2
                ? 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)'
                : 'rgba(255,255,255,0.05)',
              border: playerConfigs.filter(p => p.isActive).length >= 2
                ? '1px solid #ef4444'
                : '1px solid var(--ares-gray-dark)',
              color: playerConfigs.filter(p => p.isActive).length >= 2 ? '#fff' : 'var(--ares-muted)',
              borderRadius: '8px',
              cursor: playerConfigs.filter(p => p.isActive).length >= 2 ? 'pointer' : 'default',
              fontFamily: '"Orbitron", sans-serif',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
          >
            🎮 START GAME
          </button>

          <div style={{ fontSize: '11px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>
            Select at least 2 players to start
          </div>
        </div>
      )}

      {/* Game Content - Only show when not in setup */}
      {phase !== 'setup' && (
        <>
      {/* Current Player Info */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          padding: '12px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          border: `2px solid ${PLAYER_COLORS[currentPlayer.color]}`,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '20px' }}>{currentPlayer.emoji}</span>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: '"Orbitron", sans-serif' }}>
            {currentPlayer.name} {currentPlayer.isAI && <span style={{ fontSize: '11px', color: '#a855f7' }}>(AI)</span>}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--ares-muted)' }}>
            {ownedTerritories.length} territories | {totalArmies} armies
            {continentBonuses[currentPlayer.color] > 0 && (
              <span style={{ color: '#eab308' }}> | +{continentBonuses[currentPlayer.color]} continent bonus</span>
            )}
          </div>
        </div>
        {phase === 'deploy' && (
          <div style={{ marginLeft: 'auto', fontSize: '14px', fontFamily: 'monospace' }}>
            Deploy: <span style={{ color: PLAYER_COLORS[currentPlayer.color] }}>{deployRemaining}</span> remaining
          </div>
        )}
      </div>

      {/* Message */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: '"Orbitron", sans-serif',
          fontSize: '14px',
          fontWeight: 'bold',
          color: phase === 'gameover' ? '#4ade80' : 'var(--ares-cyan)',
          padding: '10px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '8px',
          border: '1px solid rgba(0,200,255,0.15)',
        }}
      >
        {message}
      </div>

      {/* Game Map */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <svg
          width="800"
          height="450"
          style={{ background: 'rgba(15,23,42,0.9)', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.5)' }}
        >
          {/* Ocean background with grid */}
          <defs>
            <pattern id="oceanGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(56,189,248,0.08)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#oceanGrid)" />

          {/* Continent labels */}
          <text x="160" y="30" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="16" fontWeight="bold" fontFamily="Orbitron">NORTH AMERICA</text>
          <text x="230" y="420" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14" fontWeight="bold" fontFamily="Orbitron">SOUTH AMERICA</text>
          <text x="380" y="30" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14" fontWeight="bold" fontFamily="Orbitron">EUROPE</text>
          <text x="450" y="320" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14" fontWeight="bold" fontFamily="Orbitron">AFRICA</text>
          <text x="600" y="30" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14" fontWeight="bold" fontFamily="Orbitron">ASIA</text>
          <text x="680" y="420" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14" fontWeight="bold" fontFamily="Orbitron">AUSTRALIA</text>

          {territories.map(renderTerritory)}

          {/* Connection lines for special adjacencies */}
          <line x1="95" y1="85" x2="700" y2="75" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4,2" />
          <line x1="260" y1="305" x2="350" y2="220" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4,2" />
        </svg>

        {/* Control Panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
            minWidth: '220px',
          }}
        >
          {/* Phase Controls */}
          {phase === 'attack' && selectedTerritory && !currentPlayer.isAI && (
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--ares-muted)', marginBottom: '8px' }}>
                ATTACK PHASE
              </div>
              {targetTerritory ? (
                <button
                  onClick={handleAttack}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  ⚔️ ATTACK!
                </button>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--ares-muted)' }}>Select enemy neighbor</div>
              )}
            </div>
          )}

          {phase === 'reinforce' && selectedTerritory && targetTerritory && !currentPlayer.isAI && (
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--ares-muted)', marginBottom: '8px' }}>
                REINFORCE: {reinforceAmount}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    onClick={() => setReinforceAmount(n)}
                    style={{
                      padding: '8px 12px',
                      background: reinforceAmount === n ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.05)',
                      border: reinforceAmount === n ? '1px solid #22c55e' : '1px solid var(--ares-gray-dark)',
                      color: reinforceAmount === n ? '#22c55e' : 'var(--ares-muted)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={handleReinforce}
                  disabled={reinforceAmount === 0}
                  style={{
                    padding: '8px 12px',
                    background: reinforceAmount > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                    border: reinforceAmount > 0 ? '1px solid #22c55e' : '1px solid var(--ares-gray-dark)',
                    color: reinforceAmount > 0 ? '#22c55e' : 'var(--ares-muted)',
                    borderRadius: '4px',
                    cursor: reinforceAmount > 0 ? 'pointer' : 'default',
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: '10px',
                  }}
                >
                  MOVE
                </button>
              </div>
            </div>
          )}

          {/* Phase Navigation */}
          {phase !== 'gameover' && !currentPlayer.isAI && (
            <>
              {phase === 'deploy' && deployRemaining === 0 && (
                <button
                  onClick={() => {
                    setPhase('attack');
                    setMessage('Select your territory to attack from!');
                  }}
                  style={{
                    padding: '10px',
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: '11px',
                  }}
                >
                  → ATTACK PHASE
                </button>
              )}
              {phase === 'attack' && (
                <button
                  onClick={() => {
                    setPhase('reinforce');
                    setMessage('Move armies between adjacent territories!');
                    setSelectedTerritory(null);
                    setTargetTerritory(null);
                  }}
                  style={{
                    padding: '10px',
                    background: 'rgba(34,197,94,0.2)',
                    border: '1px solid #22c55e',
                    color: '#22c55e',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: '11px',
                  }}
                >
                  → REINFORCE
                </button>
              )}
              {phase === 'reinforce' && (
                <button
                  onClick={endTurn}
                  style={{
                    padding: '10px',
                    background: 'rgba(234,179,8,0.2)',
                    border: '1px solid #eab308',
                    color: '#eab308',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: '11px',
                  }}
                >
                  → END TURN
                </button>
              )}
            </>
          )}

          {/* Dice Results */}
          {(attackDice.length > 0 || defendDice.length > 0) && (
            <div
              style={{
                padding: '12px',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: '6px',
                border: '1px solid var(--ares-gray-dark)',
              }}
            >
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--ares-muted)', marginBottom: '6px' }}>
                COMBAT
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#ef4444', fontSize: '10px', marginBottom: '2px' }}>⚔️</div>
                  <div style={{ fontFamily: 'monospace' }}>
                    {attackDice.map((d, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          width: '18px',
                          height: '18px',
                          lineHeight: '18px',
                          textAlign: 'center',
                          background: 'rgba(239,68,68,0.2)',
                          borderRadius: '3px',
                          marginRight: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#3b82f6', fontSize: '10px', marginBottom: '2px' }}>🛡</div>
                  <div style={{ fontFamily: 'monospace' }}>
                    {defendDice.map((d, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          width: '18px',
                          height: '18px',
                          lineHeight: '18px',
                          textAlign: 'center',
                          background: 'rgba(59,130,246,0.2)',
                          borderRadius: '3px',
                          marginRight: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {battleResult && (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: 'var(--ares-muted)',
                  }}
                >
                  <span style={{ color: '#ef4444' }}>-{battleResult.attackerLosses}</span> |{' '}
                  <span style={{ color: '#3b82f6' }}>-{battleResult.defenderLosses}</span>
                </div>
              )}
            </div>
          )}

          {/* Continent Info */}
          <div
            style={{
              padding: '12px',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '6px',
              border: '1px solid var(--ares-gray-dark)',
            }}
          >
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--ares-muted)', marginBottom: '8px' }}>
              CONTINENT BONUSES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontFamily: 'monospace' }}>
              {CONTINENTS.map(c => {
                const ownedBy = territories.find(t => t.id === c.territories[0])?.owner;
                const ownsAll = c.territories.every(tId => {
                  const t = territories.find(x => x.id === tId);
                  return t?.owner === ownedBy && ownedBy !== null;
                });
                return (
                  <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: ownsAll ? (ownedBy ? PLAYER_COLORS[ownedBy] : 'var(--ares-muted)') : 'var(--ares-muted)' }}>
                      {c.name.slice(0, 12)}
                    </span>
                    <span style={{ color: ownsAll ? '#eab308' : 'var(--ares-muted)' }}>+{c.bonus}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            style={{
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--ares-gray-dark)',
              color: 'var(--ares-muted)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: '"Orbitron", sans-serif',
              fontSize: '11px',
            }}
          >
            🔄 NEW GAME
          </button>
        </div>
      </div>

      {/* Player Stats */}
      {activePlayers.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            padding: '12px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            border: '1px solid var(--ares-gray-dark)',
          }}
        >
          {activePlayers.map(p => {
            const pTerritories = territories.filter(t => t.owner === p.color);
            const pArmies = pTerritories.reduce((sum, t) => sum + t.armies, 0);
            const isEliminated = pTerritories.length === 0;
            const isCurrent = p.color === currentPlayer.color;

            return (
              <div
                key={p.color}
                style={{
                  padding: '8px 12px',
                  background: isCurrent ? `${PLAYER_COLORS[p.color]}20` : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${isCurrent ? PLAYER_COLORS[p.color] : 'var(--ares-gray-dark)'}`,
                  borderRadius: '6px',
                  opacity: isEliminated ? 0.4 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span>{p.emoji}</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: '"Orbitron", sans-serif' }}>
                    {p.name}
                  </span>
                  {p.isAI && <span style={{ fontSize: '9px', color: '#a855f7' }}>AI</span>}
                  {isCurrent && <span style={{ fontSize: '9px', color: PLAYER_COLORS[p.color] }}>◀</span>}
                  {isEliminated && <span style={{ fontSize: '9px', color: 'var(--ares-muted)' }}>💀</span>}
                </div>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--ares-muted)' }}>
                  {pTerritories.length} | {pArmies} armies
                  {continentBonuses[p.color] > 0 && <span style={{ color: '#eab308' }}> | +{continentBonuses[p.color]}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}
