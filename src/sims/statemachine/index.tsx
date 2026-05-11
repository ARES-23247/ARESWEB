/** @sim {"name": "State Machine Hierarchy Visualizer", "requiresContext": false} */
import { useEffect, useRef, useState } from 'react';

export default function StateMachineSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [smTarget, setSmTarget] = useState<"STOW" | "INTAKE" | "SCORE">("STOW");
  const [logs, setLogs] = useState<string[]>([]);
  const [isFin, setIsFin] = useState<boolean>(false);
  
  const elevPosRef = useRef(0.0);
  const pivotAngRef = useRef(0.0);
  const smTargetRef = useRef<"STOW" | "INTAKE" | "SCORE">("STOW");

  useEffect(() => {
    smTargetRef.current = smTarget;
  }, [smTarget]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const smCtx = canvas.getContext("2d");
    if (!smCtx) return;

    let animationFrameId: number;

    const drawSMM = () => {
        let goalElev = 0;
        let goalPivot = 0;
        const currentLogs: string[] = [];
        let isDone = false;
        
        const target = smTargetRef.current;
        const ePos = elevPosRef.current;
        const pAng = pivotAngRef.current;

        if (target === "STOW") {
            goalElev = 0; goalPivot = 0;
            if (ePos < 0.05 && pAng < 0.05) {
                isDone = true;
            } else {
                currentLogs.push("-> Reverting all mechanisms to zero-state");
            }
        } 
        else if (target === "INTAKE") {
            goalElev = 0;
            if (ePos > 0.1) {
                goalPivot = 0;
                currentLogs.push("⚠️ BLOCKED: Lower Elevator first");
                currentLogs.push("-> Lowering Elevator...");
            } else {
                goalPivot = 1;
                if (pAng > 0.95) isDone = true;
                else currentLogs.push("-> Elevator clear. Deploying Intake Pivot...");
            }
        }
        else if (target === "SCORE") {
            goalPivot = 0;
            if (pAng > 0.1) {
                goalElev = 0;
                currentLogs.push("⚠️ BLOCKED: Intake MUST stow first");
                currentLogs.push("-> Stowing Intake Pivot...");
            } else {
                goalElev = 1;
                if (ePos > 0.95) isDone = true;
                else currentLogs.push("-> Pivot clear. Raising Elevator to Score Height...");
            }
        }
        
        setLogs(currentLogs);
        setIsFin(isDone);
        
        elevPosRef.current += (goalElev - ePos) * 0.08;
        pivotAngRef.current += (goalPivot - pAng) * 0.15;
        
        smCtx.clearRect(0,0,250,200);
        smCtx.fillStyle = 'var(--ares-gray-dark)';
        smCtx.fillRect(60, 160, 100, 30); // Base
        smCtx.fillStyle = 'var(--obsidian)';
        smCtx.fillRect(85, 40, 15, 120);  // Elevator track
        
        const carY = 140 - (elevPosRef.current * 80);
        smCtx.fillStyle = 'var(--ares-red)'; // var(--mars-red-light) roughly
        smCtx.fillRect(75, carY, 35, 20); // Elevator car

        smCtx.save();
        smCtx.translate(140, 165); // Pivot joint
        smCtx.rotate(-pivotAngRef.current * (Math.PI/2));
        smCtx.fillStyle = 'var(--ares-cyan)'; // var(--ai-cyan)
        smCtx.fillRect(-5, -50, 10, 55); // Pivot arm
        smCtx.restore();
        
        animationFrameId = requestAnimationFrame(drawSMM);
    };
    
    drawSMM();

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{ background: 'var(--obsidian)', border: '1px solid var(--ifm-color-emphasis-200)', borderRadius: '12px', margin: '30px 0', overflow: 'hidden', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)' }}>
      <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: '0.8rem', color: 'var(--ares-cyan)', letterSpacing: '1px', padding: '16px 20px', borderBottom: '1px solid var(--ifm-color-emphasis-200)', background: 'rgba(255,255,255,0.03)', textTransform: 'uppercase' }}>
        Superstructure Collision Sequencer
      </div>
      
      <div style={{ display: 'flex', gap: '10px', padding: '16px 20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
         <button 
            onClick={() => setSmTarget("STOW")} 
            style={{ flex: 1, background: smTarget === "STOW" ? 'var(--ares-cyan)' : 'var(--obsidian)', color: smTarget === "STOW" ? '#000' : 'var(--marble)', border: smTarget === "STOW" ? 'none' : '1px solid var(--ares-gray)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 700, transition: '0.2s' }}>
            STOW
         </button>
         <button 
            onClick={() => setSmTarget("INTAKE")} 
            style={{ flex: 1, background: smTarget === "INTAKE" ? 'var(--ares-cyan)' : 'var(--obsidian)', color: smTarget === "INTAKE" ? '#000' : 'var(--marble)', border: smTarget === "INTAKE" ? 'none' : '1px solid var(--ares-gray)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 700, transition: '0.2s' }}>
            INTAKING
         </button>
         <button 
            onClick={() => setSmTarget("SCORE")} 
            style={{ flex: 1, background: smTarget === "SCORE" ? 'var(--ares-cyan)' : 'var(--obsidian)', color: smTarget === "SCORE" ? '#000' : 'var(--marble)', border: smTarget === "SCORE" ? 'none' : '1px solid var(--ares-gray)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontFamily: '"Orbitron", sans-serif', fontWeight: 700, transition: '0.2s' }}>
            HUB SCORE
         </button>
      </div>
      
      <div style={{ padding: '0 20px 20px 20px', display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Active Logic Log */}
        <div style={{ flex: 1, minWidth: '200px', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', background: 'var(--obsidian)', border: '1px solid var(--ares-gray-dark)', padding: '15px', borderRadius: '6px', height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
              <div style={{ color: 'var(--ifm-color-emphasis-600)', marginBottom: '5px' }}>
                SUPERSTRUCTURE TARGET: <span style={{ color: 'var(--marble)' }}>{smTarget === "SCORE" ? "HUB SCORE" : (smTarget === "INTAKE" ? "INTAKING" : "STOW")}</span>
              </div>
              <div style={{ color: 'var(--ifm-color-emphasis-600)' }}>ACTIVE CONSTRAINTS:</div>
              <ul style={{ listStyleType: 'none', padding: 0, color: 'var(--ares-gold)', marginTop: '5px', height: '90px' }}>
                 {logs.map((log, i) => <li key={i}>{log}</li>)}
              </ul>
          </div>
          <div style={{ color: isFin ? 'var(--ares-success)' : 'var(--ares-gold)', fontWeight: 700 }}>
             {isFin ? "✔ MECHANISMS ALIGNED" : "⌛ RESOLVING KINEMATICS..."}
          </div>
        </div>
        
        {/* Mechanism Canvas */}
        <div style={{ flex: '0 0 250px', position: 'relative', background: 'var(--obsidian)', height: '200px', borderRadius: '6px', border: '1px solid var(--ares-gray-dark)' }}>
            <canvas role="img" aria-label="Interactive Physics Simulation Environment" ref={canvasRef} width={250} height={200} style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
        </div>
      </div>
    </div>
  );
}
