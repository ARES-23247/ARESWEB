import { Suspense, lazy, useMemo } from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { SIM_METADATA } from '../components/generated/sim-registry';

// Dynamic import map - must be top-level for static analysis and to avoid re-creation
const SIM_MODULES = import.meta.glob('../sims/*/index.tsx');

// Pre-create lazy components at top level to satisfy react-hooks/static-components
// This ensures they are stable and don't reset state on every render
const LAZY_SIM_MAP = Object.fromEntries(
  Object.entries(SIM_MODULES).map(([path, importFn]) => [
    path,
    lazy(importFn as () => Promise<{ default: React.ComponentType }>)
  ])
);

// Helper component to resolve and render a simulation
const SimComponentWrapper = ({ simId }: { simId: string }) => {
  const simInfo = useMemo(() => SIM_METADATA.find(s => s.id === simId), [simId]);
  const path = useMemo(() => `../sims/${simInfo?.folder || simId}/index.tsx`, [simInfo, simId]);
  
  const LazySim = LAZY_SIM_MAP[path];

  if (!simInfo) {
    return <div className="text-ares-danger p-4 text-center">Simulation metadata not found: {simId}</div>;
  }

  if (!SIM_MODULES[path]) {
    return <div className="text-ares-danger p-4 text-center">Simulation source not found: {path}</div>;
  }

  if (!LazySim) return null;

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-marble">Loading Sim...</div>}>
      <LazySim />
    </Suspense>
  );
};

const SimRunner = () => {
  const { simId: urlSimId } = useParams({ strict: false }) as Record<string, string>;
  const searchParams = useSearch({ strict: false }) as Record<string, string>;
  const simId = urlSimId || searchParams.sim;

  if (!simId) {
    return <div className="text-marble p-8">No simulation ID provided.</div>;
  }

  return (
    <div className="w-full h-full min-h-screen bg-obsidian flex flex-col">
      <div className="hidden md:flex flex-1 w-full h-full">
        <SimComponentWrapper simId={simId} />
      </div>
      <div className="flex md:hidden flex-col items-center justify-center p-8 h-[calc(100vh-64px)] text-center">
        <div className="bg-ares-red/10 p-4 rounded-full mb-4">
          <AlertTriangle className="text-ares-red" size={48} />
        </div>
        <h2 className="text-2xl font-bold font-heading text-white mb-2">Desktop Recommended</h2>
        <p className="text-white/60 mb-6">
          The ARES Simulation tools require a larger screen and hardware acceleration to run optimally. Please open this page on a desktop or laptop device.
        </p>
      </div>
    </div>
  );
};

export default SimRunner;




