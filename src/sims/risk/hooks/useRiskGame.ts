import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { GamePhase, Player, PlayerConfig, Territory, BattleResult, PlayerColor } from '../types';
import { DEFAULT_PLAYERS } from '../constants';
import { createWorldMap, getContinentBonus } from '../utils/territoryUtils';
import { aiDeploy, aiSelectAttack } from '../utils/territoryAI';
import { rollDice, simulateAttack, resolveAttack, canDeploy, canAttack as _canAttack, canReinforce as _canReinforce, reinforce, calculateDeployCount } from '../utils/gameLogic';

export function useRiskGame() {
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
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [reinforceAmount, setReinforceAmount] = useState(0);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const currentPlayer = activePlayers[currentPlayerIdx] || DEFAULT_PLAYERS[0];

  const continentBonuses = useMemo(() => {
    if (territories.length === 0) return {};
    const bonuses: Record<string, number> = {};
    playerConfigs.forEach(p => {
      bonuses[p.color] = getContinentBonus(territories, p.color);
    });
    return bonuses;
  }, [territories, playerConfigs]);

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
    const bonus = calculateDeployCount(initial, players[0].color);
    setDeployRemaining(bonus);
    setSelectedTerritory(null);
    setTargetTerritory(null);
    setAttackDice([]);
    setDefendDice([]);
    setBattleResult(null);
    setWinner(null);
    setReinforceAmount(0);
    setMessage(`🎮 ${players[0].name}'s turn - Deploy ${bonus} armies!`);
  }, [playerConfigs]);

  const handleDeploy = useCallback(
    (territoryId: string) => {
      if (phase !== 'deploy' || deployRemaining <= 0 || !canDeploy(territories, territoryId, currentPlayer.color) || currentPlayer.isAI) return;

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

    setTerritories(prev => resolveAttack(prev, selectedTerritory, targetTerritory, result, currentPlayer.color));

    setMessage(
      `Attacker rolled ${atkDice.join(', ')} | Defender rolled ${defDice.join(', ')} | ` +
        `Lost ${result.attackerLosses} vs ${result.defenderLosses}`
    );
  }, [selectedTerritory, targetTerritory, phase, territories, currentPlayer]);

  const handleReinforce = useCallback(() => {
    if (!selectedTerritory || !targetTerritory || reinforceAmount <= 0) return;

    setTerritories(prev => reinforce(prev, selectedTerritory, targetTerritory, reinforceAmount));

    setReinforceAmount(0);
    setMessage('Reinforced! Continue or end turn.');
  }, [selectedTerritory, targetTerritory, reinforceAmount]);

  const endTurn = useCallback(() => {
    const remainingPlayers = new Set(territories.map(t => t.owner).filter((o): o is PlayerColor => o !== null));
    const activePlayerCount = remainingPlayers.size;

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
    const bonus = calculateDeployCount(territories, activePlayers[nextIdx].color);
    setDeployRemaining(bonus);
    setSelectedTerritory(null);
    setTargetTerritory(null);
    setAttackDice([]);
    setDefendDice([]);
    setBattleResult(null);
    setReinforceAmount(0);

    setMessage(`${activePlayers[nextIdx].emoji} ${activePlayers[nextIdx].name}'s turn - Deploy ${bonus} armies!`);
  }, [currentPlayerIdx, territories, activePlayers]);

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

          setTerritories(prev => resolveAttack(prev, attack.from, attack.to, result, currentPlayer.color));

          attacks++;
          await new Promise(r => setTimeout(r, 400));
        }

        setPhase('reinforce');
        setMessage(`${currentPlayer.name} reinforces...`);
        await new Promise(r => setTimeout(r, 500));
      }

      setIsAIThinking(false);
      aiExecutingRef.current = false;
      endTurn();
    };

    executeAITurn();
  }, [currentPlayer.isAI, phase, territories, currentPlayer, deployRemaining, winner, endTurn]);

  return {
    playerConfigs,
    setPlayerConfigs,
    territories,
    setTerritories,
    currentPlayerIdx,
    setCurrentPlayerIdx,
    phase,
    setPhase,
    activePlayers,
    setActivePlayers,
    selectedTerritory,
    setSelectedTerritory,
    targetTerritory,
    setTargetTerritory,
    deployRemaining,
    setDeployRemaining,
    message,
    setMessage,
    attackDice,
    defendDice,
    battleResult,
    winner,
    reinforceAmount,
    setReinforceAmount,
    isAIThinking,
    currentPlayer,
    continentBonuses,
    startGame,
    handleDeploy,
    handleAttack,
    handleReinforce,
    endTurn,
    handleReset,
  };
}
