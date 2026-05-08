import { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

export default globalSetup;
