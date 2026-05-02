import React, { useState, useCallback, useRef, useEffect } from 'react';

type DoorContent = 'car' | 'goat';
type GamePhase = 'pick' | 'revealed' | 'result';

interface RoundResult {
  initialPick: number;
  finalPick: number;
  switched: boolean;
  won: boolean;
}

export default function SimComponent() {
  const [numDoors, setNumDoors] = useState(3);
  const [doors, setDoors] = useState<DoorContent[]>(['goat', 'goat', 'goat']);
  const [phase, setPhase] = useState<GamePhase>('pick');
  const [playerPick, setPlayerPick] = useState<number | null>(null);
  const [revealedDoors, setRevealedDoors] = useState<number[]>([]);
  const [finalPick, setFinalPick] = useState<number | null>(null);
  const [message, setMessage] = useState('Pick a door to begin!');
  const [won, setWon] = useState<boolean | null>(null);

  const [history, setHistory] = useState<RoundResult[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(50);
  const [autoStrategy, setAutoStrategy] = useState<'switch' | 'stay' | 'both'>('both');
  const autoRef = useRef(false);
  const speedRef = useRef(50);
  const strategyRef = useRef<'switch' | 'stay' | 'both'>('both');

  useEffect(() => { speedRef.current = autoSpeed; }, [autoSpeed]);
  useEffect(() => { strategyRef.current = autoStrategy; }, [autoStrategy]);
  useEffect(() => { autoRef.current = autoRunning; }, [autoRunning]);

  const switchWins = history.filter(h => h.switched && h.won).length;
  const switchTotal = history.filter(h => h.switched).length;
  const stayWins = history.filter(h => !h.switched && h.won).length;
  const stayTotal = history.filter(h => !h.switched).length;

  const switchRate = switchTotal > 0 ? ((switchWins / switchTotal) * 100).toFixed(1) : '—';
  const stayRate = stayTotal > 0 ? ((stayWins / stayTotal) * 100).toFixed(1) : '—';

  const initRound = useCallback(() => {
    const carDoor = Math.floor(Math.random() * numDoors);
    const newDoors: DoorContent[] = Array(numDoors).fill('goat');
    newDoors[carDoor] = 'car';
    setDoors(newDoors);
    setPhase('pick');
    setPlayerPick(null);
    setRevealedDoors([]);
    setFinalPick(null);
    setWon(null);
    setMessage('Pick a door to begin!');
  }, [numDoors]);

  // FIX: Initialize the first round on mount so the car is placed
  useEffect(() => {
    const timer = setTimeout(() => initRound(), 0);
    return () => clearTimeout(timer);
  }, [initRound]);

  const handlePick = useCallback((doorIndex: number) => {
    if (phase !== 'pick') return;
    setPlayerPick(doorIndex);

    const carIndex = doors.indexOf('car');
    const goatIndices: number[] = [];
    for (let i = 0; i < doors.length; i++) {
        if (i !== doorIndex && i !== carIndex) {
            goatIndices.push(i);
        }
    }
    
    const numToReveal = doors.length - 2;
    const shuffledGoats = [...goatIndices].sort(() => Math.random() - 0.5);
    const toReveal = shuffledGoats.slice(0, numToReveal);
    
    setRevealedDoors(toReveal);
    setPhase('revealed');
    setMessage(`Door${numToReveal > 1 ? 's' : ''} ${toReveal.map(i=>i+1).join(', ')} ${numToReveal > 1 ? 'have goats' : 'has a goat'}! Switch?`);
  }, [phase, doors]);

  const handleSwitch = useCallback((doSwitch: boolean) => {
    if (phase !== 'revealed' || playerPick === null || revealedDoors.length === 0) return;

    const finalDoor = doSwitch
      ? doors.map((_, i) => i).find(i => i !== playerPick && !revealedDoors.includes(i))!
      : playerPick;

    setFinalPick(finalDoor);
    const didWin = doors[finalDoor] === 'car';
    setWon(didWin);
    setPhase('result');

    if (didWin) {
      setMessage(doSwitch ? '🎉 You switched and won the car!' : '🎉 You stayed and won the car!');
    } else {
      setMessage(doSwitch ? '🐐 You switched... but it was a goat!' : '🐐 You stayed... but it was a goat!');
    }

    setHistory(prev => [...prev, {
      initialPick: playerPick,
      finalPick: finalDoor,
      switched: doSwitch,
      won: didWin,
    }]);
  }, [phase, playerPick, revealedDoors, doors]);

  const runAutoRound = useCallback((strategy: 'switch' | 'stay' | 'both') => {
    const carIndex = Math.floor(Math.random() * numDoors);
    const playerInitial = Math.floor(Math.random() * numDoors);

    const goatIndices: number[] = [];
    for (let i = 0; i < numDoors; i++) {
        if (i !== playerInitial && i !== carIndex) goatIndices.push(i);
    }
    const numToReveal = numDoors - 2;
    const shuffledGoats = [...goatIndices].sort(() => Math.random() - 0.5);
    const revealed = shuffledGoats.slice(0, numToReveal);

    const doSwitch = strategy === 'both' ? Math.random() > 0.5 : strategy === 'switch';
    const finalDoor = doSwitch
      ? Array.from({length: numDoors}, (_, i) => i).find(i => i !== playerInitial && !revealed.includes(i))!
      : playerInitial;
    const didWin = finalDoor === carIndex;

    setHistory(prev => [...prev, {
      initialPick: playerInitial,
      finalPick: finalDoor,
      switched: doSwitch,
      won: didWin,
    }]);
  }, [numDoors]);

  const runAutoBatch = useCallback((count: number) => {
    const strategy = strategyRef.current;
    for (let i = 0; i < count; i++) {
      runAutoRound(strategy as 'switch' | 'stay' | 'both');
    }
  }, [runAutoRound]);

  useEffect(() => {
    if (!autoRunning) return;
    let isCancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const runSlowAutoplay = async () => {
      // If speed > 100, just run batches instantly
      if (speedRef.current > 100) {
        while (!isCancelled && autoRef.current) {
          runAutoBatch(Math.floor(speedRef.current / 10));
          await new Promise(r => setTimeout(r, 50));
        }
        return;
      }
      
      // Slower visual autoplay
      while (!isCancelled && autoRef.current) {
        const delay = Math.max(50, 1000 - (speedRef.current * 9));
        
        // Pick Phase
        const carDoor = Math.floor(Math.random() * numDoors);
        const newDoors: DoorContent[] = Array(numDoors).fill('goat');
        newDoors[carDoor] = 'car';
        setDoors(newDoors);
        const playerInitial = Math.floor(Math.random() * numDoors);
        setPlayerPick(playerInitial);
        setPhase('pick');
        setRevealedDoors([]);
        setFinalPick(null);
        setWon(null);
        
        await new Promise(r => { timeoutId = setTimeout(r, delay); });
        if (isCancelled || !autoRef.current) break;
        
        // Reveal Phase
        const goatIndices: number[] = [];
        for (let i = 0; i < numDoors; i++) {
            if (i !== playerInitial && i !== carDoor) goatIndices.push(i);
        }
        const numToReveal = numDoors - 2;
        const shuffledGoats = [...goatIndices].sort(() => Math.random() - 0.5);
        const toReveal = shuffledGoats.slice(0, numToReveal);
        setRevealedDoors(toReveal);
        setPhase('revealed');
        
        await new Promise(r => { timeoutId = setTimeout(r, delay); });
        if (isCancelled || !autoRef.current) break;
        
        // Switch/Result Phase
        const strategy = strategyRef.current;
        const doSwitch = strategy === 'both' ? Math.random() > 0.5 : strategy === 'switch';
        const finalDoor = doSwitch
          ? newDoors.map((_, i) => i).find(i => i !== playerInitial && !toReveal.includes(i))!
          : playerInitial;
          
        setFinalPick(finalDoor);
        const didWin = newDoors[finalDoor] === 'car';
        setWon(didWin);
        setPhase('result');
        setHistory(prev => [...prev, {
          initialPick: playerInitial,
          finalPick: finalDoor,
          switched: doSwitch,
          won: didWin,
        }]);
        
        await new Promise(r => { timeoutId = setTimeout(r, delay); });
      }
    };

    runSlowAutoplay();
    
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [autoRunning, runAutoBatch, numDoors]);

  const getDoorStyle = (index: number): React.CSSProperties => {
    const isPlayerPick = playerPick === index;
    const isRevealed = revealedDoors.includes(index);
    const isFinalPick = finalPick === index;
    const isCar = doors[index] === 'car';

    let bg = 'linear-gradient(180deg, #2a2a3a 0%, #1a1a2a 100%)';
    let border = '2px solid #3a3a4a';
    let shadow = '0 4px 12px rgba(0,0,0,0.3)';
    const cursor = phase === 'pick' ? 'pointer' : 'default';

    if (isPlayerPick && (phase === 'revealed' || phase === 'result')) {
      border = '2px solid var(--ares-cyan)';
      shadow = '0 0 16px rgba(0,200,255,0.3)';
    }
    if (isRevealed) {
      border = '2px solid #555';
      bg = 'linear-gradient(180deg, #1a1a1a 0%, #111 100%)';
    }
    if (phase === 'result') {
      if (isCar) {
        border = '2px solid #4ade80';
        shadow = '0 0 20px rgba(74,222,128,0.4)';
        bg = 'linear-gradient(180deg, #1a2e1a 0%, #0f1f0f 100%)';
      }
      if (isFinalPick && !isCar) {
        border = '2px solid #ef4444';
        shadow = '0 0 16px rgba(239,68,68,0.3)';
        bg = 'linear-gradient(180deg, #2e1a1a 0%, #1f0f0f 100%)';
      }
    }

    return {
      width: '120px',
      height: '160px',
      background: bg,
      border,
      borderRadius: '12px',
      boxShadow: shadow,
      cursor,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden',
    };
  };

  const renderDoorContent = (index: number) => {
    const isRevealed = revealedDoors.includes(index);

    if (phase === 'pick') {
      return <span style={{ fontSize: '48px', lineHeight: 1 }}>🚪</span>;
    }

    if (isRevealed) {
      return (
        <>
          <span style={{ fontSize: '42px', lineHeight: 1 }}>🐐</span>
          <span style={{ fontSize: '10px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>GOAT</span>
        </>
      );
    }

    if (phase === 'result') {
      return doors[index] === 'car' ? (
        <>
          <span style={{ fontSize: '42px', lineHeight: 1 }}>🚗</span>
          <span style={{ fontSize: '10px', color: '#4ade80', fontFamily: 'monospace' }}>CAR!</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: '42px', lineHeight: 1 }}>🐐</span>
          <span style={{ fontSize: '10px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>GOAT</span>
        </>
      );
    }

    return <span style={{ fontSize: '48px', lineHeight: 1 }}>🚪</span>;
  };

  const doorLabel = (index: number) => {
    const isPlayerPick = playerPick === index;
    const isFinalPick = finalPick === index;
    const labels: string[] = [];
    labels.push(`Door ${index + 1}`);
    if (isPlayerPick && phase !== 'pick') labels.push('YOUR PICK');
    if (isFinalPick && phase === 'result') labels.push('FINAL');
    return labels;
  };

  const totalRounds = history.length;

  return (
    <div className="sim-container" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      gap: '16px',
      overflow: 'auto',
      color: 'var(--ares-offwhite)'
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span className="sim-title" style={{ margin: 0, fontSize: '22px' }}>MONTY HALL PROBLEM</span>
        <span style={{ fontSize: '12px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>Interactive Simulation</span>
      </div>

      {/* Explanation */}
      <div style={{
        background: 'rgba(0,200,255,0.05)',
        border: '1px solid rgba(0,200,255,0.15)',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '13px',
        lineHeight: '1.6',
        color: 'rgba(255,255,255,0.7)',
      }}>
        <strong style={{ color: 'var(--ares-cyan)' }}>The Setup:</strong> Behind one of three doors is a car 🚗. The other two hide goats 🐐.
        You pick a door, then the host <em>always</em> reveals a goat behind one of the remaining doors.
        Should you <strong style={{ color: '#4ade80' }}>switch</strong> or <strong style={{ color: '#f4a261' }}>stay</strong>?
        <br />
        <strong style={{ color: 'var(--ares-cyan)' }}>The Paradox:</strong> Switching gives you a <strong style={{ color: '#4ade80' }}>2/3 (66.7%)</strong> chance of winning,
        while staying gives only <strong style={{ color: '#f4a261' }}>1/3 (33.3%)</strong>!
      </div>

      {/* Interactive Game Area */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.1) 100%)',
        border: '1px solid var(--ares-gray-dark)',
        borderRadius: '12px',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          fontFamily: '"Orbitron", sans-serif',
          fontSize: '15px',
          fontWeight: 'bold',
          color: won === true ? '#4ade80' : won === false ? '#ef4444' : 'var(--ares-cyan)',
          marginBottom: '16px',
          minHeight: '24px',
        }}>
          {message}
        </div>

        {/* Door Count Control */}
        <div style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--ares-cyan)' }}>NUMBER OF DOORS:</span>
          <input
            type="range"
            min={3}
            max={50}
            value={numDoors}
            onChange={(e) => {
              setNumDoors(parseInt(e.target.value));
              setHistory([]);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>{numDoors}</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          {Array.from({length: numDoors}, (_, i) => i).map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePick(i);
                  }
                }}
                onClick={() => handlePick(i)}
                style={getDoorStyle(i)}
                onMouseEnter={(e) => {
                  if (phase === 'pick') {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = 'var(--ares-cyan)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  if (phase === 'pick') {
                    e.currentTarget.style.borderColor = '#3a3a4a';
                  }
                }}
              >
                {renderDoorContent(i)}
              </div>
              <div style={{ textAlign: 'center' }}>
                {doorLabel(i).map((label, li) => (
                  <div key={li} style={{
                    fontSize: li === 0 ? '12px' : '9px',
                    fontFamily: 'monospace',
                    color: li === 0 ? 'var(--ares-offwhite)' : 'var(--ares-cyan)',
                    fontWeight: li === 1 ? 'bold' : 'normal',
                    letterSpacing: li === 1 ? '1px' : '0',
                  }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {phase === 'revealed' && (
            <>
              <button
                onClick={() => handleSwitch(false)}
                style={{
                  background: 'linear-gradient(135deg, #b45309, #92400e)',
                  border: '1px solid #d97706',
                  color: '#fff',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: '"Orbitron", sans-serif',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
              >
                ✋ STAY
              </button>
              <button
                onClick={() => handleSwitch(true)}
                style={{
                  background: 'linear-gradient(135deg, #15803d, #166534)',
                  border: '1px solid #22c55e',
                  color: '#fff',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: '"Orbitron", sans-serif',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
              >
                🔄 SWITCH
              </button>
            </>
          )}
          {phase === 'result' && (
            <button
              onClick={initRound}
              style={{
                background: 'linear-gradient(135deg, #1a3a5c, #0d253f)',
                border: '1px solid var(--ares-cyan)',
                color: 'var(--ares-cyan)',
                padding: '10px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '13px',
                fontWeight: 'bold',
                transition: 'all 0.2s',
              }}
            >
              PLAY AGAIN
            </button>
          )}
        </div>
      </div>

      {/* Stats & Auto-Simulate */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Statistics */}
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--ares-gray-dark)',
          borderRadius: '12px',
          padding: '16px',
        }}>
          <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: '12px', color: 'var(--ares-cyan)', marginBottom: '12px', letterSpacing: '1px' }}>
            STATISTICS — {totalRounds} ROUND{totalRounds !== 1 ? 'S' : ''}
          </div>

          {/* Switch stats */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#4ade80' }}>🔄 SWITCH</span>
              <span>{switchWins}/{switchTotal} ({switchRate}%)</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: switchTotal > 0 ? `${(switchWins / switchTotal) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ position: 'relative', height: '0' }}>
              <div style={{ position: 'absolute', left: '66.67%', top: '-10px', width: '2px', height: '10px', background: '#4ade80', opacity: 0.4 }} />
              <div style={{ position: 'absolute', left: '66.67%', top: '-16px', transform: 'translateX(-50%)', fontSize: '8px', color: '#4ade80', fontFamily: 'monospace', opacity: 0.5 }}>66.7%</div>
            </div>
          </div>

          {/* Stay stats */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#f4a261' }}>✋ STAY</span>
              <span>{stayWins}/{stayTotal} ({stayRate}%)</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: stayTotal > 0 ? `${(stayWins / stayTotal) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #d97706, #f4a261)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ position: 'relative', height: '0' }}>
              <div style={{ position: 'absolute', left: '33.33%', top: '-10px', width: '2px', height: '10px', background: '#f4a261', opacity: 0.4 }} />
              <div style={{ position: 'absolute', left: '33.33%', top: '-16px', transform: 'translateX(-50%)', fontSize: '8px', color: '#f4a261', fontFamily: 'monospace', opacity: 0.5 }}>33.3%</div>
            </div>
          </div>
        </div>

        {/* Auto-Simulate Controls */}
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--ares-gray-dark)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: '12px', color: 'var(--ares-cyan)', letterSpacing: '1px' }}>
            AUTO-SIMULATE
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px', color: 'var(--ares-muted)', marginBottom: '4px' }}>
              <span>Strategy</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['switch', 'stay', 'both'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setAutoStrategy(s)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    border: `1px solid ${autoStrategy === s ? 'var(--ares-cyan)' : 'var(--ares-gray-dark)'}`,
                    background: autoStrategy === s ? 'rgba(0,200,255,0.1)' : 'transparent',
                    color: autoStrategy === s ? 'var(--ares-cyan)' : 'var(--ares-muted)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '11px', color: 'var(--ares-muted)', marginBottom: '4px' }}>
              <span>Speed</span><span>{autoSpeed} rounds/tick</span>
            </div>
            <input
              aria-label="Simulation Configuration Slider"
              type="range" min={1} max={200} step={1}
              value={autoSpeed}
              onChange={e => setAutoSpeed(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setAutoRunning(!autoRunning)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '12px',
                fontFamily: '"Orbitron", sans-serif',
                fontWeight: 'bold',
                background: autoRunning ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
                border: `1px solid ${autoRunning ? '#ef4444' : '#4ade80'}`,
                color: autoRunning ? '#ef4444' : '#4ade80',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {autoRunning ? '⏹ STOP' : '▶ RUN'}
            </button>
            <button
              onClick={() => runAutoBatch(100)}
              style={{
                padding: '8px 12px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                background: 'rgba(0,200,255,0.08)',
                border: '1px solid rgba(0,200,255,0.3)',
                color: 'var(--ares-cyan)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              +100
            </button>
            <button
              onClick={() => runAutoBatch(1000)}
              style={{
                padding: '8px 12px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                background: 'rgba(0,200,255,0.08)',
                border: '1px solid rgba(0,200,255,0.3)',
                color: 'var(--ares-cyan)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              +1K
            </button>
            <button
              onClick={() => setHistory([])}
              style={{
                padding: '8px 12px',
                fontSize: '11px',
                fontFamily: 'monospace',
                background: 'transparent',
                border: '1px solid var(--ares-gray-dark)',
                color: 'var(--ares-muted)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              CLEAR
            </button>
          </div>
        </div>
      </div>

      {/* Visual Explanation */}
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid var(--ares-gray-dark)',
        borderRadius: '12px',
        padding: '16px',
      }}>
        <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: '12px', color: 'var(--ares-cyan)', marginBottom: '12px', letterSpacing: '1px' }}>
          WHY SWITCHING WORKS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', lineHeight: '1.7' }}>
          <div>
            <div style={{ color: '#f4a261', fontFamily: 'monospace', fontSize: '11px', marginBottom: '6px', fontWeight: 'bold' }}>IF YOU ALWAYS STAY</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: '12px' }}>
              You only win if your <strong style={{ color: '#f4a261' }}>initial pick</strong> was the car.<br />
              Probability of initial pick being correct: <strong style={{ color: '#f4a261' }}>1/3 (33.3%)</strong>
            </div>
          </div>
          <div>
            <div style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: '11px', marginBottom: '6px', fontWeight: 'bold' }}>IF YOU ALWAYS SWITCH</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: '12px' }}>
              You win if your initial pick was <strong style={{ color: '#4ade80' }}>wrong</strong> (a goat).<br />
              Probability of initial pick being wrong: <strong style={{ color: '#4ade80' }}>2/3 (66.7%)</strong>
            </div>
          </div>
        </div>

        {/* Tree diagram */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.5)',
          overflowX: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--ares-cyan)', marginBottom: '4px' }}>YOUR INITIAL PICK</div>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
                <div>
                  <div style={{ color: '#ef4444', fontSize: '10px' }}>Car (1/3)</div>
                  <div style={{ margin: '4px 0' }}>↓</div>
                  <div style={{ fontSize: '10px' }}>Host shows goat</div>
                  <div style={{ margin: '4px 0' }}>↓</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div>
                      <div style={{ color: '#f4a261', fontSize: '10px' }}>Stay → ✅ WIN</div>
                    </div>
                    <div>
                      <div style={{ color: '#4ade80', fontSize: '10px' }}>Switch → ❌ LOSE</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ color: '#4ade80', fontSize: '10px' }}>Goat (2/3)</div>
                  <div style={{ margin: '4px 0' }}>↓</div>
                  <div style={{ fontSize: '10px' }}>Host shows other goat</div>
                  <div style={{ margin: '4px 0' }}>↓</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div>
                      <div style={{ color: '#f4a261', fontSize: '10px' }}>Stay → ❌ LOSE</div>
                    </div>
                    <div>
                      <div style={{ color: '#4ade80', fontSize: '10px' }}>Switch → ✅ WIN</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}