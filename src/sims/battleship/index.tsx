import React, { useState, useCallback, useEffect, useRef } from 'react';


type Orientation = 'horizontal' | 'vertical';
type GamePhase = 'placing' | 'playing' | 'gameover';

interface ShipDef {
  name: string;
  size: number;
  id: string;
}

interface PlacedShip {
  def: ShipDef;
  cells: { row: number; col: number }[];
}

const SHIPS: ShipDef[] = [
  { name: 'Carrier', size: 5, id: 'C' },
  { name: 'Battleship', size: 4, id: 'B' },
  { name: 'Cruiser', size: 3, id: 'R' },
  { name: 'Submarine', size: 3, id: 'S' },
  { name: 'Destroyer', size: 2, id: 'D' },
];

const GRID_SIZE = 10;
const COL_LABELS = 'ABCDEFGHIJ'.split('');

function createEmptyGrid(): string[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));
}

function getShipCells(
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < size; i++) {
    cells.push({
      row: orientation === 'vertical' ? row + i : row,
      col: orientation === 'horizontal' ? col + i : col,
    });
  }
  return cells;
}

function canPlace(
  occupied: Set<string>,
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): boolean {
  const cells = getShipCells(row, col, size, orientation);
  return cells.every(
    c => c.row >= 0 && c.row < GRID_SIZE && c.col >= 0 && c.col < GRID_SIZE && !occupied.has(`${c.row},${c.col}`)
  );
}

function generateRandomShips(): PlacedShip[] {
  const occupied = new Set<string>();
  const placed: PlacedShip[] = [];

  for (const ship of SHIPS) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 500) {
      attempts++;
      const orient: Orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      if (canPlace(occupied, row, col, ship.size, orient)) {
        const cells = getShipCells(row, col, ship.size, orient);
        cells.forEach(c => occupied.add(`${c.row},${c.col}`));
        placed.push({ def: ship, cells });
        success = true;
      }
    }
  }
  return placed;
}

function buildGridFromShips(ships: PlacedShip[]): string[][] {
  const grid = createEmptyGrid();
  for (const ship of ships) {
    for (const c of ship.cells) {
      grid[c.row][c.col] = ship.def.id;
    }
  }
  return grid;
}

// Hunt/Target AI
interface AiState {
  mode: 'hunt' | 'target';
  targets: { row: number; col: number }[];
  hitStack: { row: number; col: number }[];
}

function createAi(): AiState {
  return { mode: 'hunt', targets: [], hitStack: [] };
}

// Check if a set of hits sinks a specific ship
function checkShipSunk(ship: PlacedShip, hits: Set<string>): boolean {
  return ship.cells.every(c => hits.has(`${c.row},${c.col}`));
}

// Get all currently sunk ships for a side
function getSunkShips(ships: PlacedShip[], hits: Set<string>): PlacedShip[] {
  return ships.filter(s => checkShipSunk(s, hits));
}

// Get all sunk cells
function getSunkCellSet(ships: PlacedShip[], hits: Set<string>): Set<string> {
  const sunk = getSunkShips(ships, hits);
  const cells = new Set<string>();
  for (const s of sunk) {
    for (const c of s.cells) {
      cells.add(`${c.row},${c.col}`);
    }
  }
  return cells;
}

export default function SimComponent() {
  // Player state
  const [placedShips, setPlacedShips] = useState<PlacedShip[]>([]);
  const [playerGrid, setPlayerGrid] = useState<string[][]>(createEmptyGrid);
  const [playerHits, setPlayerHits] = useState<Set<string>>(new Set());
  const [playerMisses, setPlayerMisses] = useState<Set<string>>(new Set());
  const [playerSunkCells, setPlayerSunkCells] = useState<Set<string>>(new Set());

  // Opponent state
  const [opponentShips, setOpponentShips] = useState<PlacedShip[]>([]);
  const [opponentGrid, setOpponentGrid] = useState<string[][]>(createEmptyGrid);
  const [opponentHits, setOpponentHits] = useState<Set<string>>(new Set());
  const [opponentMisses, setOpponentMisses] = useState<Set<string>>(new Set());
  const [opponentSunkCells, setOpponentSunkCells] = useState<Set<string>>(new Set());

  // Game state
  const [phase, setPhase] = useState<GamePhase>('placing');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [currentShipIdx, setCurrentShipIdx] = useState(0);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [message, setMessage] = useState('Place your Carrier — click your grid, press R to rotate');
  const [winner, setWinner] = useState<'player' | 'computer' | null>(null);
  const [playerSunkShips, setPlayerSunkShips] = useState<string[]>([]);
  const [opponentSunkShips, setOpponentSunkShips] = useState<string[]>([]);
  const [isComputerTurn, setIsComputerTurn] = useState(false);

  const aiRef = useRef<AiState>(createAi());
  const opponentShipsRef = useRef<PlacedShip[]>([]);
  const placedShipsRef = useRef<PlacedShip[]>([]);
  const playerHitsRef = useRef<Set<string>>(new Set());
  const playerMissesRef = useRef<Set<string>>(new Set());
  const opponentHitsRef = useRef<Set<string>>(new Set());
  const opponentMissesRef = useRef<Set<string>>(new Set());

  // Keep refs in sync
  useEffect(() => { placedShipsRef.current = placedShips; }, [placedShips]);
  useEffect(() => { opponentShipsRef.current = opponentShips; }, [opponentShips]);
  useEffect(() => { playerHitsRef.current = playerHits; }, [playerHits]);
  useEffect(() => { playerMissesRef.current = playerMisses; }, [playerMisses]);
  useEffect(() => { opponentHitsRef.current = opponentHits; }, [opponentHits]);
  useEffect(() => { opponentMissesRef.current = opponentMisses; }, [opponentMisses]);

  // Initialize opponent ships
  useEffect(() => {
    const ships = generateRandomShips();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpponentShips(ships);
    setOpponentGrid(buildGridFromShips(ships));
  }, []);

  // Keyboard rotation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setOrientation(o => (o === 'horizontal' ? 'vertical' : 'horizontal'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Build occupied set from placed ships
  const getOccupiedSet = useCallback(
    (extraShips?: PlacedShip[]) => {
      const occupied = new Set<string>();
      for (const ship of extraShips || placedShips) {
        for (const c of ship.cells) {
          occupied.add(`${c.row},${c.col}`);
        }
      }
      return occupied;
    },
    [placedShips]
  );


  // Handle placing a ship
  const handlePlaceShip = useCallback(
    (row: number, col: number) => {
      if (phase !== 'placing' || currentShipIdx >= SHIPS.length) return;
      const ship = SHIPS[currentShipIdx];
      const occupied = getOccupiedSet();
      if (!canPlace(occupied, row, col, ship.size, orientation)) return;

      const cells = getShipCells(row, col, ship.size, orientation);
      const newShip: PlacedShip = { def: ship, cells };
      const newShips = [...placedShips, newShip];
      setPlacedShips(newShips);
      setPlayerGrid(buildGridFromShips(newShips));

      const nextIdx = currentShipIdx + 1;
      if (nextIdx >= SHIPS.length) {
        setPhase('playing');
        setMessage('All ships placed! Fire on the enemy grid!');
      } else {
        const nextShip = SHIPS[nextIdx];
        setCurrentShipIdx(nextIdx);
        setMessage(`Place your ${nextShip.name} (${nextShip.size} cells) — Press R to rotate`);
      }
    },
    [phase, currentShipIdx, placedShips, orientation, getOccupiedSet]
  );

  // Undo last placed ship
  const handleUndo = useCallback(() => {
    if (phase !== 'placing' || placedShips.length === 0) return;
    const newShips = placedShips.slice(0, -1);
    setPlacedShips(newShips);
    setPlayerGrid(buildGridFromShips(newShips));
    const undoIdx = newShips.length;
    setCurrentShipIdx(undoIdx);
    const ship = SHIPS[undoIdx];
    setMessage(`Place your ${ship.name} (${ship.size} cells) — Press R to rotate`);
  }, [phase, placedShips]);

  // Randomly place player ships
  const handleRandomPlace = useCallback(() => {
    const ships = generateRandomShips();
    setPlacedShips(ships);
    setPlayerGrid(buildGridFromShips(ships));
    setCurrentShipIdx(SHIPS.length);
    setPhase('playing');
    setMessage('Ships randomly placed! Fire on the enemy grid!');
  }, []);

  // Computer AI turn
  const doComputerTurn = useCallback(() => {
    const ai = aiRef.current;
    const attacked = new Set([...playerHitsRef.current, ...playerMissesRef.current]);
    let row: number;
    let col: number;

    if (ai.mode === 'target' && ai.targets.length > 0) {
      // Filter valid targets
      const validTargets = ai.targets.filter(
        t => t.row >= 0 && t.row < GRID_SIZE && t.col >= 0 && t.col < GRID_SIZE && !attacked.has(`${t.row},${t.col}`)
      );
      if (validTargets.length > 0) {
        const pick = validTargets[Math.floor(Math.random() * validTargets.length)];
        row = pick.row;
        col = pick.col;
      } else {
        ai.mode = 'hunt';
        ai.targets = [];
        ai.hitStack = [];
        // Fallback to hunt
        do {
          row = Math.floor(Math.random() * GRID_SIZE);
          col = Math.floor(Math.random() * GRID_SIZE);
        } while (attacked.has(`${row},${col}`));
      }
    } else {
      // Hunt mode — random with checkerboard pattern for efficiency
      const candidates: { row: number; col: number }[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!attacked.has(`${r},${c}`) && (r + c) % 2 === 0) {
            candidates.push({ row: r, col: c });
          }
        }
      }
      if (candidates.length === 0) {
        // Fallback without checkerboard
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (!attacked.has(`${r},${c}`)) candidates.push({ row: r, col: c });
          }
        }
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      row = pick.row;
      col = pick.col;
    }

    const key = `${row!},${col!}`;
    const isHit = placedShipsRef.current.some(ship =>
      ship.cells.some(c => c.row === row! && c.col === col!)
    );

    const newHits = new Set(playerHitsRef.current);
    const newMisses = new Set(playerMissesRef.current);

    if (isHit) {
      newHits.add(key);
      ai.hitStack.push({ row: row!, col: col! });
      ai.mode = 'target';

      // Add adjacent cells as targets
      const adj = [
        { row: row! - 1, col: col! },
        { row: row! + 1, col: col! },
        { row: row!, col: col! - 1 },
        { row: row!, col: col! + 1 },
      ];
      for (const a of adj) {
        if (a.row >= 0 && a.row < GRID_SIZE && a.col >= 0 && a.col < GRID_SIZE && !attacked.has(`${a.row},${a.col}`)) {
          ai.targets.push(a);
        }
      }
    } else {
      newMisses.add(key);
    }

    setPlayerHits(newHits);
    setPlayerMisses(newMisses);

    // Check if any player ship was sunk
    const sunk = getSunkShips(placedShipsRef.current, newHits);
    setPlayerSunkShips(sunk.map(s => s.def.name));
    setPlayerSunkCells(getSunkCellSet(placedShipsRef.current, newHits));

    // Check game over
    if (sunk.length === SHIPS.length) {
      setPhase('gameover');
      setWinner('computer');
      setMessage('💀 Defeat! The enemy sank all your ships!');
      return;
    }

    if (isHit) {
      setMessage('💣 The enemy hit your ship!');
    } else {
      setMessage('Your turn — fire on the enemy grid!');
    }
  }, []);

  // Player fires at opponent
  const handleFire = useCallback(
    (row: number, col: number) => {
      if (phase !== 'playing' || isComputerTurn) return;
      const key = `${row},${col}`;
      if (opponentHitsRef.current.has(key) || opponentMissesRef.current.has(key)) return;

      const newHits = new Set(opponentHitsRef.current);
      const newMisses = new Set(opponentMissesRef.current);
      const isHit = opponentGrid[row][col] !== '';

      if (isHit) {
        newHits.add(key);
      } else {
        newMisses.add(key);
      }
      setOpponentHits(newHits);
      setOpponentMisses(newMisses);

      // Check for sunk ships
      const sunk = getSunkShips(opponentShips, newHits);
      const sunkNames = sunk.map(s => s.def.name);
      setOpponentSunkShips(sunkNames);
      setOpponentSunkCells(getSunkCellSet(opponentShips, newHits));

      // Check for game over
      if (sunk.length === SHIPS.length) {
        setPhase('gameover');
        setWinner('player');
        setMessage('🎉 Victory! You sank the entire enemy fleet!');
        return;
      }

      const justSunk = sunk.find(
        s => s.cells.every(c => newHits.has(`${c.row},${c.col}`)) && !opponentSunkShips.includes(s.def.name)
      );
      if (isHit && justSunk) {
        setMessage(`💥 Hit! You sank their ${justSunk.def.name}!`);
      } else if (isHit) {
        setMessage('💥 Hit!');
      } else {
        setMessage('💨 Miss.');
      }

      // Computer's turn
      setIsComputerTurn(true);
      setTimeout(() => {
        doComputerTurn();
        setIsComputerTurn(false);
      }, 700);
    },
    [phase, isComputerTurn, opponentGrid, opponentShips, opponentSunkShips, doComputerTurn]
  );



  // Reset
  const handleReset = useCallback(() => {
    const oppShips = generateRandomShips();
    setPlacedShips([]);
    setPlayerGrid(createEmptyGrid());
    setPlayerHits(new Set());
    setPlayerMisses(new Set());
    setPlayerSunkCells(new Set());
    setOpponentShips(oppShips);
    setOpponentGrid(buildGridFromShips(oppShips));
    setOpponentHits(new Set());
    setOpponentMisses(new Set());
    setOpponentSunkCells(new Set());
    setPhase('placing');
    setOrientation('horizontal');
    setCurrentShipIdx(0);
    setHoverCell(null);
    setWinner(null);
    setPlayerSunkShips([]);
    setOpponentSunkShips([]);
    setIsComputerTurn(false);
    aiRef.current = createAi();
    setMessage('Place your Carrier — click your grid, press R to rotate');
  }, []);

  // Get hover preview cells
  const getPreviewCells = useCallback((): { row: number; col: number }[] => {
    if (phase !== 'placing' || !hoverCell || currentShipIdx >= SHIPS.length) return [];
    const ship = SHIPS[currentShipIdx];
    return getShipCells(hoverCell.row, hoverCell.col, ship.size, orientation);
  }, [phase, hoverCell, currentShipIdx, orientation]);

  const previewCells = getPreviewCells();
  const previewSet = new Set(previewCells.map(c => `${c.row},${c.col}`));
  const previewValid =
    previewCells.length > 0 &&
    previewCells.every(c => c.row >= 0 && c.row < GRID_SIZE && c.col >= 0 && c.col < GRID_SIZE) &&
    canPlace(getOccupiedSet(), hoverCell?.row ?? 0, hoverCell?.col ?? 0, SHIPS[currentShipIdx]?.size ?? 0, orientation);

  const renderBoard = (
    boardType: 'player' | 'opponent'
  ) => {
    const grid = boardType === 'player' ? playerGrid : opponentGrid;
    const hits = boardType === 'player' ? playerHits : opponentHits;
    const misses = boardType === 'player' ? playerMisses : opponentMisses;
    const sunkCells = boardType === 'player' ? playerSunkCells : opponentSunkCells;
    const label = boardType === 'player' ? '🛡 YOUR FLEET' : '⚔ ENEMY FLEET';
    const labelColor = boardType === 'player' ? 'var(--ares-cyan)' : '#ef4444';

    const clickable =
      (boardType === 'player' && phase === 'placing') ||
      (boardType === 'opponent' && phase === 'playing' && !isComputerTurn);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div
          style={{
            fontFamily: '"Orbitron", sans-serif',
            fontSize: '13px',
            fontWeight: 'bold',
            color: labelColor,
            letterSpacing: '1px',
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        {/* Column headers */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: '22px' }} />
          {COL_LABELS.map(c => (
            <div
              key={c}
              style={{
                width: '34px',
                textAlign: 'center',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: 'var(--ares-muted)',
                height: '18px',
                lineHeight: '18px',
              }}
            >
              {c}
            </div>
          ))}
        </div>
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: 'flex' }}>
            <div
              style={{
                width: '22px',
                textAlign: 'center',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: 'var(--ares-muted)',
                height: '34px',
                lineHeight: '34px',
              }}
            >
              {ri + 1}
            </div>
            <div style={{ display: 'flex' }}>
              {row.map((_, ci) => {
                const key = `${ri},${ci}`;
                const isShip = grid[ri][ci] !== '';
                const isHit = hits.has(key);
                const isMiss = misses.has(key);
                const isSunk = sunkCells.has(key);
                const isPreview = previewSet.has(key) && boardType === 'player';
                const showShip = boardType === 'player' && isShip && !isHit && !isSunk;

                let bg = 'rgba(15,25,45,0.7)';
                let border = '1px solid rgba(0,200,255,0.08)';
                let content = '';
                let contentColor = 'transparent';
                let cursor = 'default';

                if (showShip) {
                  bg = 'rgba(0,200,255,0.2)';
                  border = '1px solid rgba(0,200,255,0.35)';
                  content = '■';
                  contentColor = 'rgba(0,200,255,0.6)';
                }

                if (isSunk) {
                  bg = 'rgba(180,80,0,0.35)';
                  border = '1px solid rgba(220,120,0,0.6)';
                  content = '✕';
                  contentColor = '#f97316';
                } else if (isHit) {
                  bg = 'rgba(220,40,40,0.4)';
                  border = '1px solid rgba(255,80,80,0.6)';
                  content = '💥';
                  contentColor = '#ef4444';
                } else if (isMiss) {
                  bg = 'rgba(60,60,80,0.3)';
                  border = '1px solid rgba(80,80,100,0.3)';
                  content = '•';
                  contentColor = 'rgba(255,255,255,0.2)';
                }

                if (isPreview) {
                  bg = previewValid ? 'rgba(0,200,255,0.25)' : 'rgba(239,68,68,0.2)';
                  border = previewValid
                    ? '1px solid rgba(0,200,255,0.5)'
                    : '1px solid rgba(239,68,68,0.4)';
                  if (!showShip && !isHit && !isMiss) {
                    content = previewValid ? '■' : '✕';
                    contentColor = previewValid ? 'rgba(0,200,255,0.4)' : 'rgba(239,68,68,0.4)';
                  }
                }

                if (clickable) cursor = 'pointer';

                return (
                  <div
                    key={ci}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (boardType === 'player' && phase === 'placing') handlePlaceShip(ri, ci);
                        else if (boardType === 'opponent' && phase === 'playing') handleFire(ri, ci);
                      }
                    }}
                    onClick={() => {
                      if (boardType === 'player' && phase === 'placing') handlePlaceShip(ri, ci);
                      else if (boardType === 'opponent' && phase === 'playing') handleFire(ri, ci);
                    }}
                    onMouseEnter={() => {
                      if (clickable) setHoverCell({ row: ri, col: ci });
                    }}
                    onMouseLeave={() => setHoverCell(null)}
                    style={{
                      width: '34px',
                      height: '34px',
                      background: bg,
                      border,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: content === '💥' ? '13px' : '14px',
                      cursor,
                      transition: 'background 0.15s, border 0.15s',
                      color: contentColor,
                      userSelect: 'none',
                      fontWeight: 'bold',
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };


  const opponentShipsSunk = opponentSunkShips.length;
  const playerShipsSunk = playerSunkShips.length;

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
        <span className="sim-title" style={{ margin: 0, fontSize: '22px' }}>⚓ BATTLESHIP</span>
        <span style={{ fontSize: '12px', color: 'var(--ares-muted)', fontFamily: 'monospace' }}>
          {phase === 'placing' ? 'PLACEMENT PHASE' : phase === 'playing' ? 'BATTLE PHASE' : 'GAME OVER'}
        </span>
        {phase === 'placing' && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              background: 'rgba(0,200,255,0.1)',
              border: '1px solid rgba(0,200,255,0.3)',
              padding: '2px 8px',
              borderRadius: '4px',
              color: 'var(--ares-cyan)',
            }}
          >
            {orientation.toUpperCase()} [R to rotate]
          </span>
        )}
        {phase === 'playing' && isComputerTurn && (
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ef4444', animation: 'pulse 1s infinite' }}>
            ⏳ ENEMY FIRING...
          </span>
        )}
      </div>

      {/* Message */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: '"Orbitron", sans-serif',
          fontSize: '14px',
          fontWeight: 'bold',
          color:
            winner === 'player'
              ? '#4ade80'
              : winner === 'computer'
              ? '#ef4444'
              : 'var(--ares-cyan)',
          padding: '10px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '8px',
          border: `1px solid ${
            winner === 'player'
              ? 'rgba(74,222,128,0.3)'
              : winner === 'computer'
              ? 'rgba(239,68,68,0.3)'
              : 'rgba(0,200,255,0.15)'
          }`,
        }}
      >
        {message}
      </div>

      {/* Ship placement tracker */}
      {phase === 'placing' && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {SHIPS.map((ship, idx) => (
            <div
              key={ship.id}
              style={{
                padding: '5px 10px',
                fontSize: '11px',
                fontFamily: 'monospace',
                borderRadius: '4px',
                border: `1px solid ${
                  idx < currentShipIdx
                    ? 'rgba(74,222,128,0.4)'
                    : idx === currentShipIdx
                    ? 'var(--ares-cyan)'
                    : 'var(--ares-gray-dark)'
                }`,
                background:
                  idx < currentShipIdx
                    ? 'rgba(74,222,128,0.1)'
                    : idx === currentShipIdx
                    ? 'rgba(0,200,255,0.1)'
                    : 'transparent',
                color:
                  idx < currentShipIdx
                    ? '#4ade80'
                    : idx === currentShipIdx
                    ? 'var(--ares-cyan)'
                    : 'var(--ares-muted)',
              }}
            >
              {idx < currentShipIdx ? '✅' : idx === currentShipIdx ? '▸' : '○'} {ship.name} ({ship.size})
            </div>
          ))}
        </div>
      )}

      {/* Boards */}
      <div
        style={{
          display: 'flex',
          gap: '28px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {renderBoard('player')}
        {renderBoard('opponent')}
      </div>

      {/* Fleet status */}
      {phase !== 'placing' && (
        <div
          style={{
            display: 'flex',
            gap: '24px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            padding: '10px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            border: '1px solid var(--ares-gray-dark)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--ares-cyan)', marginBottom: '2px' }}>
              YOUR FLEET
            </div>
            <div style={{ fontSize: '16px', fontFamily: '"Orbitron", sans-serif', color: '#4ade80' }}>
              {SHIPS.length - playerShipsSunk}/{SHIPS.length}
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--ares-muted)' }}>SHIPS REMAINING</div>
          </div>
          <div style={{ width: '1px', background: 'var(--ares-gray-dark)', alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#ef4444', marginBottom: '2px' }}>
              ENEMY FLEET
            </div>
            <div style={{ fontSize: '16px', fontFamily: '"Orbitron", sans-serif', color: '#4ade80' }}>
              {SHIPS.length - opponentShipsSunk}/{SHIPS.length}
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--ares-muted)' }}>SHIPS REMAINING</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {phase === 'placing' && (
          <>
            {placedShips.length > 0 && (
              <button
                onClick={handleUndo}
                style={{
                  padding: '10px 20px',
                  fontFamily: '"Orbitron", sans-serif',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--ares-gray-dark)',
                  color: 'var(--ares-muted)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                ↩ UNDO
              </button>
            )}
            <button
              onClick={handleRandomPlace}
              style={{
                padding: '10px 20px',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '12px',
                fontWeight: 'bold',
                background: 'rgba(0,200,255,0.1)',
                border: '1px solid rgba(0,200,255,0.3)',
                color: 'var(--ares-cyan)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              🎲 RANDOM PLACE
            </button>
          </>
        )}
        <button
          onClick={handleReset}
          style={{
            padding: '10px 20px',
            fontFamily: '"Orbitron", sans-serif',
            fontSize: '12px',
            fontWeight: 'bold',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--ares-gray-dark)',
            color: 'var(--ares-muted)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          🔄 NEW GAME
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: 'var(--ares-muted)',
        }}
      >
        <span>
          <span style={{ color: 'rgba(0,200,255,0.6)' }}>■</span> Ship
        </span>
        <span>
          <span>💥</span> Hit
        </span>
        <span>
          <span style={{ color: '#f97316' }}>✕</span> Sunk
        </span>
        <span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span> Miss
        </span>
      </div>
    </div>
  );
}