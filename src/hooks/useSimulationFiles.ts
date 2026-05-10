import { useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';
import { GITHUB_REPO } from '../utils/constants';

export interface SavedSim {
  id: string;
  name: string;
  author_id: string;
  createdAt: string;
  updatedAt: string;
  type?: string;
}

export interface GithubSim {
  id: string;
  name: string;
  path: string;
  requiresContext: boolean;
}

export function useSimulationFiles(compileCode: (files: Record<string, string>) => Promise<string | null>) {
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [githubSims, setGithubSims] = useState<GithubSim[]>([]);
  const [isLoadingSims, setIsLoadingSims] = useState(false);
  const [isLoadingGithubSims, setIsLoadingGithubSims] = useState(false);
  const [simId, setSimId] = useState<string | null>(null);
  const [simName, setSimName] = useState('Untitled Simulation');

  const fetchSavedSims = useCallback(async () => {
    setIsLoadingSims(true);
    try {
      const res = await fetch('/api/simulations');
      if (res.ok) {
        const data = await res.json() as { simulations?: SavedSim[] };
        setSavedSims(data.simulations || []);
      }
    } catch (e) {
      logger.error('[SimPlayground] Failed to fetch sims:', e);
    } finally {
      setIsLoadingSims(false);
    }
  }, []);

  const fetchGithubSims = useCallback(async () => {
    setIsLoadingGithubSims(true);
    try {
      const res = await fetch(`${GITHUB_REPO.rawUrl}/src/sims/simRegistry.json`);
      if (res.ok) {
        const data = await res.json() as { simulators: GithubSim[] };
        setGithubSims(data.simulators || []);
      }
    } catch (e) {
      logger.error('[SimPlayground] Failed to fetch github sims:', e);
    } finally {
      setIsLoadingGithubSims(false);
    }
  }, []);

  const handleLoadSim = useCallback(async (id: string, setFiles: (files: Record<string, string>) => void, setActiveFile: (file: string) => void) => {
    try {
      const res = await fetch(`/api/simulations/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json() as { simulation: { id: string; name: string; files: Record<string, string> | string, type?: string } };
      const sim = data.simulation;
      let parsedFiles: Record<string, string> = {};

      if (typeof sim.files === 'object') {
        parsedFiles = sim.files as Record<string, string>;
      } else if (typeof sim.files === 'string') {
        try {
          parsedFiles = JSON.parse(sim.files);
        } catch {
          parsedFiles = { [sim.id]: sim.files };
        }
      }

      if (Object.keys(parsedFiles).length === 0) {
        parsedFiles = { 'SimComponent.jsx': '' };
      }

      setFiles(parsedFiles);
      setActiveFile(Object.keys(parsedFiles)[0]);
      setSimName(sim.name);
      setSimId(sim.id);
      await compileCode(parsedFiles);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('simId', sim.id.toString());
      window.history.replaceState({}, '', newUrl.toString());

      const { toast } = await import('sonner');
      toast.success(`Loaded: ${sim.name}`);
    } catch (e) {
      logger.error('[SimPlayground] Load failed:', e);
      const { toast } = await import('sonner');
      toast.error('Failed to load simulation');
    }
  }, [compileCode]);

  const handleLoadGithubSim = useCallback(async (sim: GithubSim, setFiles: (files: Record<string, string>) => void, setActiveFile: (file: string) => void) => {
    try {
      const folder = sim.path.replace('./', '');
      const filename = `${folder}/index.tsx`;
      const res = await fetch(`${GITHUB_REPO.rawUrl}/src/sims/${filename}`);
      if (!res.ok) throw new Error('Not found');
      const code = await res.text();

      const parsedFiles = { [filename]: code };

      setFiles(parsedFiles);
      setActiveFile(filename);
      setSimName(sim.name);
      setSimId(`github:${sim.id}`);
      await compileCode(parsedFiles);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('simId', `github:${sim.id}`);
      window.history.replaceState({}, '', newUrl.toString());

      const { toast } = await import('sonner');
      toast.success(`Loaded Official Sim: ${sim.name}`);
    } catch (e) {
      logger.error('[SimPlayground] GitHub Load failed:', e);
      const { toast } = await import('sonner');
      toast.error(`Failed to load ${sim.name} from GitHub`);
    }
  }, [compileCode]);

  const handleLoadGist = useCallback(async (id: string, setFiles: (files: Record<string, string>) => void, setActiveFile: (file: string) => void) => {
    try {
      const res = await fetch(`/api/simulations/gist/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json() as { simulation: { id: string; name: string; files: Record<string, string> } };
      const sim = data.simulation;
      const parsedFiles = sim.files;

      if (Object.keys(parsedFiles).length === 0) {
        parsedFiles['SimComponent.jsx'] = '';
      }

      setFiles(parsedFiles);
      setActiveFile(Object.keys(parsedFiles)[0]);
      setSimName(sim.name);
      setSimId(sim.id);
      await compileCode(parsedFiles);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('simId');
      newUrl.searchParams.set('gist', id);
      window.history.replaceState({}, '', newUrl.toString());

      const { toast } = await import('sonner');
      toast.success(`Loaded Gist: ${sim.name}`);
    } catch (e) {
      logger.error('[SimPlayground] Gist Load failed:', e);
      const { toast } = await import('sonner');
      toast.error('Failed to load Gist simulation');
    }
  }, [compileCode]);

  // Check URL for shared simulation on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('simId');
    const gistParam = params.get('gist');
    if (gistParam) {
      setTimeout(() => handleLoadGist(gistParam, () => {}, () => {}), 0);
    } else if (idParam) {
      // This will be handled by the parent component
    }
  }, [handleLoadGist]);

  return {
    savedSims,
    githubSims,
    isLoadingSims,
    isLoadingGithubSims,
    simId,
    setSimId,
    simName,
    setSimName,
    fetchSavedSims,
    fetchGithubSims,
    handleLoadSim,
    handleLoadGithubSim,
    handleLoadGist,
  };
}

