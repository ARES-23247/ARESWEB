import React from 'react';
import { useRiskGame } from './hooks/useRiskGame';
import { PLAYER_COLORS, CONTINENTS, DEFAULT_PLAYERS } from './constants';
import { canAttack, canReinforce } from './utils/gameLogic';
import type { PlayerColor as _PlayerColor } from './types';

const SimComponent = () => {
  const {
    playerConfigs,
    setPlayerConfigs,
    territories,
    phase,
    setPhase,
    activePlayers,
    selectedTerritory,
    setSelectedTerritory,
    targetTerritory,
    setTargetTerritory,
    deployRemaining,
    message,
    setMessage,
    attackDice,
    defendDice,
    battleResult,
    winner: _winner,
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
  } = useRiskGame();

  const ownedTerritories = territories.filter(t => t.owner === currentPlayer.color);
  const totalArmies = ownedTerritories.reduce((sum, t) => sum + t.armies, 0);

  const renderTerritory = (t: typeof territories[0]) => {
    const isSelected = t.id === selectedTerritory;
    const isTarget = t.id === targetTerritory;
    const canActAsTarget = phase === 'attack' && selectedTerritory && canAttack(territories, selectedTerritory, t.id, currentPlayer.color);
    const canActAsReinforceTarget = phase === 'reinforce' && selectedTerritory && canReinforce(territories, selectedTerritory, t.id, currentPlayer.color);

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

            if (phase === 'deploy' && t.owner === currentPlayer.color) {
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
              } else if (canAttack(territories, selectedTerritory, t.id, currentPlayer.color)) {
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
              } else if (canReinforce(territories, selectedTerritory, t.id, currentPlayer.color)) {
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

        {/* Troop Graphics */}
        <g style={{ pointerEvents: 'none' }}>
          {t.owner && (() => {
            const troopColor = PLAYER_COLORS[t.owner];
            const displayCount = Math.min(t.armies, 9);

            const positions = [
              { dx: 0, dy: -6 },
              { dx: -8, dy: 0 },
              { dx: 8, dy: 0 },
              { dx: -8, dy: -6 },
              { dx: 8, dy: -6 },
              { dx: -8, dy: 6 },
              { dx: 8, dy: 6 },
              { dx: 0, dy: 6 },
              { dx: 0, dy: 0 },
            ];

            if (t.armies >= 10) {
              return (
                <g transform={`translate(${t.x}, ${t.y - 2})`}>
                  <path
                    d="M-8,8 L-8,0 L-5,0 L-5,-4 L-2,-4 L-2,0 L2,0 L2,-4 L5,-4 L5,0 L8,0 L8,8 Z"
                    fill={troopColor}
                    opacity="0.8"
                    stroke="#fff"
                    strokeWidth="0.5"
                  />
                  <line x1="0" y1="-4" x2="0" y2="-10" stroke="#fff" strokeWidth="1" />
                  <path d="M0,-10 L4,-8 L0,-6 Z" fill="#fff" />
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
                <ellipse cx="0" cy="-2" rx="3" ry="2" fill={troopColor} opacity="0.9" />
                <circle cx="0" cy="-5" r="1.8" fill={troopColor} opacity="0.9" />
                <line x1="2" y1="-4" x2="4" y2="-8" stroke={troopColor} strokeWidth="1" opacity="0.7" />
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

      {/* Game Content */}
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

              {/* Connection lines */}
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
};

export default SimComponent;
