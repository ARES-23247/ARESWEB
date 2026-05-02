const fs = require('fs');

const path = 'src/sims/MonteHall.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace state
content = content.replace(
  `const [doors, setDoors] = useState<DoorContent[]>(['goat', 'goat', 'goat']);`,
  `const [numDoors, setNumDoors] = useState(3);\n  const [doors, setDoors] = useState<DoorContent[]>(['goat', 'goat', 'goat']);`
);
content = content.replace(
  `const [revealedDoor, setRevealedDoor] = useState<number | null>(null);`,
  `const [revealedDoors, setRevealedDoors] = useState<number[]>([]);`
);

// Replace initRound
content = content.replace(
  /const initRound = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/,
  `const initRound = useCallback(() => {
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
  }, [numDoors]);`
);

// Replace handlePick
content = content.replace(
  /const handlePick = useCallback\(\(doorIndex: number\) => \{[\s\S]*?\}, \[phase, doors\]\);/,
  `const handlePick = useCallback((doorIndex: number) => {
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
    setMessage(\`Door\${numToReveal > 1 ? 's' : ''} \${toReveal.map(i=>i+1).join(', ')} \${numToReveal > 1 ? 'have goats' : 'has a goat'}! Switch?\`);
  }, [phase, doors]);`
);

// Replace handleSwitch
content = content.replace(
  /const handleSwitch = useCallback\(\(doSwitch: boolean\) => \{[\s\S]*?\}, \[phase, playerPick, revealedDoor, doors\]\);/,
  `const handleSwitch = useCallback((doSwitch: boolean) => {
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
  }, [phase, playerPick, revealedDoors, doors]);`
);

// Replace runAutoRound
content = content.replace(
  /const runAutoRound = useCallback\(\(strategy: 'switch' | 'stay' | 'both'\) => \{[\s\S]*?\}, \[\]\);/g,
  `const runAutoRound = useCallback((strategy: 'switch' | 'stay' | 'both') => {
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
  }, [numDoors]);`
);

// Autoplay effect
content = content.replace(
  /useEffect\(\(\) => \{\s*if \(!autoRunning\) return;\s*const interval = setInterval\(\(\) => \{\s*if \(!autoRef\.current\) return;\s*runAutoBatch\(Math\.max\(1, Math\.floor\(speedRef\.current \/ 10\)\)\);\s*\}, 50\);\s*return \(\) => clearInterval\(interval\);\s*\}, \[autoRunning, runAutoBatch\]\);/,
  `useEffect(() => {
    if (!autoRunning) return;
    let isCancelled = false;
    let timeoutId: any = null;

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
  }, [autoRunning, runAutoBatch, numDoors]);`
);

// getDoorStyle
content = content.replace(
  /const isRevealed = revealedDoor === index;/g,
  `const isRevealed = revealedDoors.includes(index);`
);

content = content.replace(
  /\[0, 1, 2\].map\(i => \(/g,
  `Array.from({length: numDoors}, (_, i) => i).map(i => (`
);

content = content.replace(
  /flexWrap: 'wrap' \}\}>/,
  `flexWrap: 'wrap' }}>
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
        </div>`
);

fs.writeFileSync(path, content);
console.log('Patched');
