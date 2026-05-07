import React from 'react';
import { useExperimentState } from '../../hooks/useExperimentState';
import { z } from 'zod';
import { MatterEngine } from './engines/MatterEngine';
import { CustomCanvasEngine } from './engines/CustomCanvasEngine';
import { Dyn4jEngine } from './engines/Dyn4jEngine';

interface HybridSimulationWrapperProps {
  engineType: 'matter' | 'canvas' | 'dyn4j';
  experimentId: string;
  title?: string;
  description?: string;
}

export const HybridSimulationWrapper: React.FC<HybridSimulationWrapperProps> = ({ 
  engineType, 
  experimentId,
  title,
  description
}) => {
  // Use our local storage persistence hook
  const [state, setState] = useExperimentState(experimentId, z.any(), {});

  const renderEngine = () => {
    switch (engineType) {
      case 'matter':
        return <MatterEngine initialState={state} onStateChange={setState} />;
      case 'canvas':
        return <CustomCanvasEngine initialState={state} onStateChange={setState} />;
      case 'dyn4j':
        return <Dyn4jEngine initialState={state} onStateChange={setState} />;
      default:
        return <div className="text-red-500">Unknown engine type</div>;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
      {(title || description) && (
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-md">
          {title && <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>}
          {description && <p className="text-slate-300">{description}</p>}
        </div>
      )}
      
      <div className="bg-slate-900 rounded-xl p-4 shadow-2xl border border-slate-800 relative">
        <div className="absolute top-2 right-2 px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded uppercase font-mono tracking-wider border border-slate-700 z-10">
          Engine: {engineType}
        </div>
        {renderEngine()}
      </div>

      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 font-mono text-sm shadow-md">
        <h3 className="text-slate-400 mb-2 uppercase tracking-wider text-xs">Persistent State (Live)</h3>
        <pre className="text-emerald-400 overflow-x-auto">
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>
    </div>
  );
};
