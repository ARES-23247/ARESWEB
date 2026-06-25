/** @sim {"name": "Sim 4: Reinforcement Learning", "description": "Watch an AI agent learn to navigate a maze using Q-Learning and rewards."} */
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

// Grid settings
const GRID_SIZE = 5;
const START = { r: 0, c: 0 };
const GOAL = { r: 4, c: 4 };
const OBSTACLES = [
  { r: 1, c: 1 },
  { r: 1, c: 2 },
  { r: 1, c: 3 },
  { r: 3, c: 0 },
  { r: 3, c: 1 },
  { r: 3, c: 3 },
];

const ACTIONS = [
  { dr: -1, dc: 0, name: 'UP' },
  { dr: 1, dc: 0, name: 'DOWN' },
  { dr: 0, dc: -1, name: 'LEFT' },
  { dr: 0, dc: 1, name: 'RIGHT' }
];

export default function RLVisualizer() {
  const [agentPos, setAgentPos] = useState(START);
  const [qTable, setQTable] = useState<Record<string, number[]>>(() => {
    const initialQ: Record<string, number[]> = {};
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        initialQ[`${r},${c}`] = [0, 0, 0, 0]; // up, down, left, right
      }
    }
    return initialQ;
  });
  const [episode, setEpisode] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [epsilon, setEpsilon] = useState(1.0); // Exploration rate
  
  const trainingRef = useRef(false);



  const isObstacle = (r: number, c: number) => OBSTACLES.some(o => o.r === r && o.c === c);
  const isGoal = (r: number, c: number) => r === GOAL.r && c === GOAL.c;
  
  const stepTraining = () => {
    const alpha = 0.1; // Learning rate
    const gamma = 0.9; // Discount factor

    let r = START.r;
    let c = START.c;
    const currentEps = Math.max(0.01, 1.0 - (episode * 0.01)); // Decay exploration

    const newQ = { ...qTable };
    let steps = 0;
    
    // Simulate one full episode instantly
    while (!isGoal(r, c) && steps < 50) {
      const stateKey = `${r},${c}`;
      let actionIdx;
      
      // Epsilon-greedy
      if (Math.random() < currentEps) {
        actionIdx = Math.floor(Math.random() * 4); // Explore
      } else {
        const qVals = newQ[stateKey];
        actionIdx = qVals.indexOf(Math.max(...qVals)); // Exploit
      }

      const action = ACTIONS[actionIdx];
      let nr = r + action.dr;
      let nc = c + action.dc;
      
      let reward = -1; // Standard move penalty
      
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE || isObstacle(nr, nc)) {
        nr = r;
        nc = c;
        reward = -5; // Hit wall/obstacle penalty
      } else if (isGoal(nr, nc)) {
        reward = 100; // Reached goal!
      }

      const nextStateKey = `${nr},${nc}`;
      const maxNextQ = Math.max(...newQ[nextStateKey]);
      
      // Q-Learning Formula
      const currentQ = newQ[stateKey][actionIdx];
      newQ[stateKey][actionIdx] = currentQ + alpha * (reward + gamma * maxNextQ - currentQ);
      
      r = nr;
      c = nc;
      steps++;
    }

    setQTable(newQ);
    setEpisode(prev => prev + 1);
    setEpsilon(currentEps);
  };

  const trainBatch = async () => {
    setIsTraining(true);
    trainingRef.current = true;
    for (let i = 0; i < 50; i++) {
      if (!trainingRef.current) break;
      stepTraining();
      await new Promise(res => setTimeout(res, 20)); // Slow enough to see UI update
    }
    setIsTraining(false);
  };

  const testAgent = async () => {
    setIsTraining(true);
    trainingRef.current = true;
    let r = START.r;
    let c = START.c;
    setAgentPos({ r, c });

    let steps = 0;
    while (!isGoal(r, c) && steps < 20) {
      if (!trainingRef.current) break;
      await new Promise(res => setTimeout(res, 300));
      
      const qVals = qTable[`${r},${c}`];
      const actionIdx = qVals.indexOf(Math.max(...qVals));
      const action = ACTIONS[actionIdx];
      
      const nr = r + action.dr;
      const nc = c + action.dc;
      
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !isObstacle(nr, nc)) {
        r = nr;
        c = nc;
        setAgentPos({ r, c });
      } else {
        // Agent tried to hit a wall, break loop to avoid infinite stuck
        break;
      }
      steps++;
    }
    setIsTraining(false);
  };

  const stop = () => {
    trainingRef.current = false;
    setIsTraining(false);
  };

  // Compute max Q value for color mapping
  let maxQOverall = 0;
  Object.values(qTable).forEach(vals => {
    vals.forEach(v => {
      if (v > maxQOverall) maxQOverall = v;
    });
  });

  return (
    <div className="bg-obsidian border border-white/10 ares-cut-sm p-6 text-marble font-sans max-w-4xl mx-auto my-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading text-ares-gold uppercase tracking-wider">Sim 4: Reinforcement Learning</h2>
          <p className="text-sm text-marble/60">Agent learns to navigate a maze by updating a Q-Table using trial and error.</p>
        </div>
      </div>

      <div className="mb-6 bg-black/30 p-4 ares-cut-sm border border-white/5 flex gap-4 items-center">
        <button 
          onClick={trainBatch}
          disabled={isTraining}
          className="px-4 py-2 bg-ares-red text-white text-xs font-bold tracking-widest uppercase ares-cut-sm disabled:opacity-50"
        >
          Train 50 Episodes
        </button>
        <button 
          onClick={testAgent}
          disabled={isTraining}
          className="px-4 py-2 bg-ares-cyan text-black text-xs font-bold tracking-widest uppercase ares-cut-sm disabled:opacity-50"
        >
          Watch Agent
        </button>
        {isTraining && (
          <button onClick={stop} className="px-4 py-2 bg-white/10 text-white text-xs font-bold tracking-widest uppercase ares-cut-sm">
            Stop
          </button>
        )}
        
        <div className="ml-auto flex items-center gap-6 text-sm font-mono text-marble/60">
          <div>Episodes: <span className="text-white">{episode}</span></div>
          <div>Exploration (Epsilon): <span className="text-ares-cyan">{epsilon.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const r = Math.floor(i / GRID_SIZE);
            const c = i % GRID_SIZE;
            const stateKey = `${r},${c}`;
            const isObs = isObstacle(r, c);
            const isG = isGoal(r, c);
            const isAgent = agentPos.r === r && agentPos.c === c;
            
            // Calculate color intensity based on max Q value of this cell
            const qVals = qTable[stateKey] || [0,0,0,0];
            const maxQ = Math.max(...qVals);
            const intensity = maxQOverall > 0 ? Math.max(0, maxQ / maxQOverall) : 0;
            const bgClass = isObs ? 'bg-white/10' : isG ? 'bg-ares-gold/20' : 'bg-black/40';

            return (
              <div 
                key={i} 
                className={`w-16 h-16 sm:w-20 sm:h-20 border border-white/10 relative flex items-center justify-center transition-colors ${bgClass}`}
                style={!isObs && !isG ? { backgroundColor: `rgba(0, 229, 255, ${intensity * 0.3})` } : {}}
              >
                {/* Q-value arrows */}
                {!isObs && !isG && qVals.some(v => v > 0) && (
                  <>
                    <div className="absolute top-1 text-[8px] text-marble/60">{qVals[0].toFixed(0)}</div>
                    <div className="absolute bottom-1 text-[8px] text-marble/60">{qVals[1].toFixed(0)}</div>
                    <div className="absolute left-1 text-[8px] text-marble/60">{qVals[2].toFixed(0)}</div>
                    <div className="absolute right-1 text-[8px] text-marble/60">{qVals[3].toFixed(0)}</div>
                  </>
                )}

                {isG && <span className="text-2xl">🏆</span>}
                {isObs && <span className="text-xl">🧱</span>}

                {isAgent && (
                  <motion.div 
                    layoutId="agent"
                    className="w-8 h-8 rounded-full bg-ares-red shadow-[0_0_15px_rgba(192,0,0,0.8)] z-10"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
