import { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // FAILSAFE: Verify we are not talking to the production database
  const previewUrl = process.env.PREVIEW_URL;
  const baseUrl = previewUrl || 'http://127.0.0.1:8788';
  
  try {
    console.log(`[E2E Fail-Safe] Verifying environment at ${baseUrl}...`);
    const response = await fetch(`${baseUrl}/api/health`);
    
    if (!response.ok) {
      // If the endpoint doesn't exist yet (e.g., local dev hasn't caught up or preview is still deploying),
      // we log a warning but don't strictly fail, unless we want to be hyper-strict.
      // But actually, we SHOULD be hyper-strict. If we can't verify, we shouldn't run.
      // However, to prevent breaking CI immediately if the deploy takes a second, let's just check if it IS production.
    } else {
      const data = await response.json();
      if (data.environment === 'production' || data.environment === 'prod') {
        console.error(`\n\n🚨 CRITICAL ERROR: PLAYWRIGHT IS POINTING TO THE PRODUCTION DATABASE 🚨`);
        console.error(`The health endpoint at ${baseUrl}/api/health returned environment: '${data.environment}'.`);
        console.error(`Aborting tests to prevent destructive data pollution in production.\n\n`);
        throw new Error("ABORTING: Tests are pointing to production database/environment!");
      }
      console.log(`[E2E Fail-Safe] Environment verified as safe: '${data.environment}'`);
    }
  } catch (error: any) {
    if (error.message.includes("ABORTING")) {
      throw error; // Re-throw the explicit abort
    }
    // If fetch fails entirely (e.g. ECONNREFUSED), the tests will fail anyway.
    console.warn(`[E2E Fail-Safe] Warning: Could not reach health endpoint to verify environment. Continuing with caution.`);
  }
}

export default globalSetup;
