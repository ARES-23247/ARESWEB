import { useState } from 'react';

export default function PowerSheddingSim() {
  const [loads, setLoads] = useState({
    swerve: false,
    shooter: false,
    intake: false,
    compressor: false,
  });

  const internalResistance = 0.015; // Ohms
  const nominalVoltage = 12.5;

  // Load values in Amps
  const loadValues = {
    swerve: 160,
    shooter: 60,
    intake: 40,
    compressor: 30,
  };

  let totalCurrent = 0;
  
  // Tier 1: Swerve (Never sheds)
  if (loads.swerve) totalCurrent += loadValues.swerve;
  
  // Tier 2: Shooter (Scales slightly, but for sim we'll keep it simple)
  if (loads.shooter) totalCurrent += loadValues.shooter;

  // Initial check for potential voltage sag with T1/T2
  const potentialVoltage = nominalVoltage - (totalCurrent * internalResistance);
  const isShedding = potentialVoltage < 9.5;

  // Tier 3: Intake / Compressor (Sheds heavily)
  if (loads.intake) {
    totalCurrent += isShedding ? (loadValues.intake * 0.1) : loadValues.intake;
  }
  if (loads.compressor) {
    totalCurrent += isShedding ? (loadValues.compressor * 0.1) : loadValues.compressor;
  }

  const voltage = nominalVoltage - (totalCurrent * internalResistance);
  const isBrownout = voltage < 7.0;

  const toggleLoad = (load: keyof typeof loads) => {
    setLoads(prev => ({ ...prev, [load]: !prev[load] }));
  };

  const getVoltageColor = () => {
    const aresRed = getComputedStyle(document.documentElement).getPropertyValue('--ares-red').trim() || '#C00000';
    const aresBronze = getComputedStyle(document.documentElement).getPropertyValue('--ares-bronze').trim() || '#CD7F32';
    const aresCyan = getComputedStyle(document.documentElement).getPropertyValue('--ares-cyan').trim() || '#00E5FF';
    if (isBrownout) return aresRed;
    if (isShedding) return aresBronze;
    return aresCyan;
  };

  return (
    <div className="bg-ares-black border border-white/10 ares-cut-lg my-8 flex flex-col overflow-hidden text-white font-['Orbitron']">
      <div className="px-5 py-4 bg-white/5 border-b border-white/10 text-sm font-bold text-ares-red">
        REAL-TIME POWER SHEDDING DIAGNOSTICS
      </div>

      <div className="flex p-6 gap-8 flex-wrap justify-center">
        {/* LOAD TOGGLES */}
        <div className="flex-1 min-w-[300px] flex flex-col gap-3">
          <div className="text-xs text-white/60 mb-1">LOAD CONTROL (ACTIVATE MECHANISMS)</div>
          
          <button 
            onClick={() => toggleLoad('swerve')}
            className={`p-3 px-4 ares-cut-sm border-none text-white cursor-pointer text-left flex justify-between transition-all duration-200 ${
              loads.swerve ? 'bg-ares-red shadow-[0_0_15px_rgba(192,0,0,0.4)]' : 'bg-white/5 hover:bg-white/10'
            }`}>
            <span>[T1] SWERVE DRIVE</span>
            <span className="text-xs opacity-80">+160A</span>
          </button>

          <button 
            onClick={() => toggleLoad('shooter')}
            className={`p-3 px-4 ares-cut-sm border-none text-white cursor-pointer text-left flex justify-between transition-all duration-200 ${
              loads.shooter ? 'bg-ares-bronze shadow-[0_0_15px_rgba(205,127,50,0.4)]' : 'bg-white/5 hover:bg-white/10'
            }`}>
            <span>[T2] SHOOTER FLYWHEELS</span>
            <span className="text-xs opacity-80">+60A</span>
          </button>

          <button 
            onClick={() => toggleLoad('intake')}
            className={`p-3 px-4 ares-cut-sm border-none text-white cursor-pointer text-left flex justify-between transition-all duration-200 ${
              loads.intake ? (isShedding ? 'bg-white/10 opacity-60' : 'bg-ares-cyan shadow-[0_0_15px_rgba(0,229,255,0.4)]') : 'bg-white/5 hover:bg-white/10'
            }`}>
            <span>[T3] INTAKE MOTORS</span>
            <span className="text-xs opacity-80">
              {loads.intake && isShedding ? '+4A (SHED)' : '+40A'}
            </span>
          </button>

          <button 
            onClick={() => toggleLoad('compressor')}
            className={`p-3 px-4 ares-cut-sm border-none text-white cursor-pointer text-left flex justify-between transition-all duration-200 ${
              loads.compressor ? (isShedding ? 'bg-white/10 opacity-60' : 'bg-ares-cyan shadow-[0_0_15px_rgba(0,229,255,0.4)]') : 'bg-white/5 hover:bg-white/10'
            }`}>
            <span>[T3] COMPRESSOR</span>
            <span className="text-xs opacity-80">
              {loads.compressor && isShedding ? '+3A (SHED)' : '+30A'}
            </span>
          </button>
        </div>

        {/* DASHBOARD */}
        <div className="flex-1 min-w-[250px] bg-white/[0.03] p-6 ares-cut border border-white/10 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
          <div className="text-5xl font-extrabold" style={Object.assign({}, { color: getVoltageColor(), textShadow: `0 0 20px ${getVoltageColor()}44` })}>
            {voltage.toFixed(1)}V
          </div>
          
          <div className="text-[12px] tracking-widest" style={Object.assign({}, { color: isBrownout ? '#C00000' : (isShedding ? '#CD7F32' : '#00E5FF') })}>
            {isBrownout ? 'CRITICAL BROWNOUT' : (isShedding ? 'POWER SHEDDING ACTIVE' : 'SYSTEM NOMINAL')}
          </div>

          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300 ease-out"
              style={Object.assign({}, { 
                width: `${(voltage / 12.5) * 100}%`,
                backgroundColor: getVoltageColor()
              })}
            ></div>
          </div>

          {isShedding && (
            <div className="absolute inset-0 bg-ares-bronze/5 pointer-events-none animate-[pulse_2s_infinite]"></div>
          )}

          {isBrownout && (
            <div className="px-3 py-2 bg-ares-red text-black font-black text-xs ares-cut-sm mt-2">
              ROBORIO DISCONNECT RISK
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0% { opacity: 0.2; }
          50% { opacity: 0.6; }
          100% { opacity: 0.2; }
        }
      `}} />
    </div>
  );
}
