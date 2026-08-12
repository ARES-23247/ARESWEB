import { useState, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';
import { GITHUB_REPO } from '../utils/constants';
import { ApiError, toastApiError } from '../api/apiClient';
import { authenticatedFetch } from '../lib/api';
import { getSimulationDraft, listSimulationDrafts, type SimulationDraft } from '../lib/simulationDrafts';

export type SavedSim = SimulationDraft;

export interface GithubSim {
  id: string;
  name: string;
  path: string;
  requiresContext: boolean;
}

type SetSimulationFiles = React.Dispatch<React.SetStateAction<Record<string, string>>>;
type SetActiveFile = React.Dispatch<React.SetStateAction<string>>;

interface SimulationResponse {
  simulation: {
    id: string;
    name: string;
    files: Record<string, string> | string;
    type?: string;
  };
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
}

async function createResponseError(response: Response, fallbackMessage: string): Promise<ApiError> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  return new ApiError(
    response.status,
    `HTTP ${response.status}: ${response.statusText || 'Request failed'} — ${body.message || body.error || fallbackMessage}`,
    body.code,
  );
}

function parseSimulationFiles(files: Record<string, string> | string, fallbackName: string): Record<string, string> {
  if (typeof files === 'string') {
    try {
      const parsed = JSON.parse(files) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        );
      }
    } catch {
      return { [fallbackName]: files };
    }
  }

  return Object.fromEntries(
    Object.entries(files).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export function useSimulationFiles(
  compileCode: (files: Record<string, string>) => Promise<string | null>,
  setEditorFiles: SetSimulationFiles,
  setEditorActiveFile: SetActiveFile,
) {
  const [savedSims, setSavedSims] = useState<SavedSim[]>([]);
  const [githubSims, setGithubSims] = useState<GithubSim[]>([]);
  const [isLoadingSims, setIsLoadingSims] = useState(false);
  const [isLoadingGithubSims, setIsLoadingGithubSims] = useState(false);
  const [simId, setSimId] = useState<string | null>(null);
  const [simName, setSimName] = useState('Untitled Simulation');

  const fetchSavedSims = useCallback(async () => {
    setIsLoadingSims(true);
    try {
      setSavedSims(listSimulationDrafts());
    } catch (e) {
      logger.error('[SimPlayground] Failed to fetch sims:', e);
      toastApiError(e, 'Simulation library failed to load');
    } finally {
      setIsLoadingSims(false);
    }
  }, []);

  const fetchGithubSims = useCallback(async () => {
    setIsLoadingGithubSims(true);
    try {
      const res = await fetch(`${GITHUB_REPO.rawUrl}/src/sims/simRegistry.json`);
      if (!res.ok) throw await createResponseError(res, 'The official simulation registry could not be loaded.');
      const data = await res.json() as { simulators: GithubSim[] };
      setGithubSims(data.simulators || []);
    } catch (e) {
      logger.error('[SimPlayground] Failed to fetch github sims:', e);
      toastApiError(e, 'Official simulation registry failed to load');
    } finally {
      setIsLoadingGithubSims(false);
    }
  }, []);

  const handleLoadSim = useCallback(async (
    id: string,
    setFiles: SetSimulationFiles = setEditorFiles,
    setActiveFile: SetActiveFile = setEditorActiveFile,
  ) => {
    try {
      const sim = getSimulationDraft(id);
      if (!sim) throw new ApiError(404, 'The local simulation draft was not found.');
      const parsedFiles = sim.files;

      setFiles(parsedFiles);
      setActiveFile(Object.keys(parsedFiles)[0]);
      setSimName(sim.name);
      setSimId(`local:${sim.id}`);
      await compileCode(parsedFiles);

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('simId', `local:${sim.id}`);
      window.history.replaceState({}, '', newUrl.toString());

      const { toast } = await import('sonner');
      toast.success(`Loaded: ${sim.name}`);
    } catch (e) {
      logger.error('[SimPlayground] Load failed:', e);
      toastApiError(e, 'Simulation failed to load');
    }
  }, [compileCode, setEditorActiveFile, setEditorFiles]);

  const handleLoadGithubSim = useCallback(async (
    sim: GithubSim,
    setFiles: SetSimulationFiles = setEditorFiles,
    setActiveFile: SetActiveFile = setEditorActiveFile,
  ) => {
    try {
      const folder = sim.path.replace(/^\.\//, '');
      const filename = `${folder}/index.tsx`;
      const res = await fetch(`${GITHUB_REPO.rawUrl}/src/sims/${filename}`);
      if (!res.ok) throw await createResponseError(res, `${sim.name} could not be downloaded from GitHub.`);
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
      toastApiError(e, `Failed to load ${sim.name} from GitHub`);
    }
  }, [compileCode, setEditorActiveFile, setEditorFiles]);

  const handleLoadGist = useCallback(async (
    id: string,
    setFiles: SetSimulationFiles = setEditorFiles,
    setActiveFile: SetActiveFile = setEditorActiveFile,
  ) => {
    try {
      const res = await authenticatedFetch(`/api/simulations/gist/${encodeURIComponent(id)}`);
      if (!res.ok) throw await createResponseError(res, 'The shared Gist could not be loaded.');
      const data = await res.json() as SimulationResponse;
      const sim = data.simulation;
      let parsedFiles = parseSimulationFiles(sim.files, 'SimComponent.tsx');

      if (Object.keys(parsedFiles).length === 0) {
        parsedFiles = { 'SimComponent.tsx': '' };
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
      toastApiError(e, 'Shared Gist failed to load');
    }
  }, [compileCode, setEditorActiveFile, setEditorFiles]);

  // Check URL for shared simulation on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('simId');
    const gistParam = params.get('gist');
    if (gistParam) {
      void handleLoadGist(gistParam);
    } else if (idParam) {
      void handleLoadSim(idParam);
    }
  }, [handleLoadGist, handleLoadSim]);

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

