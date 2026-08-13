import type { Application, Request, Response } from "express";

type AppLoader = () => Promise<Application>;

/** Load one API group's router graph on its first request, then reuse it. */
export function createLazyAppHandler(load: AppLoader) {
  let appPromise: Promise<Application> | null = null;
  return async (req: Request, res: Response): Promise<void> => {
    appPromise ??= load();
    try {
      const app = await appPromise;
      app(req, res);
    } catch (error) {
      // A transient module initialization failure must not poison the instance.
      appPromise = null;
      throw error;
    }
  };
}
