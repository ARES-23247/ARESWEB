import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Autonomous Setup Script for ARESWEB
 * Enables a 'Freshman' student to bootstrap the entire project in one command.
 */
async function setup() {
  console.log("🚀 Starting ARESWEB Autonomous Setup...");

  // 1. Environment Check
  if (!existsSync('.dev.vars')) {
    console.log("📝 Creating .dev.vars template...");
    writeFileSync('.dev.vars', "ENCRYPTION_SECRET=ares_local_dev_secret_32_chars_min\nBETTER_AUTH_SECRET=local_auth_secret\n");
  }

  // 2. Local Database Bootstrap
  console.log("🌀 Bootstrapping local D1 database...");
  try {
    // Apply all migrations locally
    execSync('npx wrangler d1 migrations apply ares-db --local --batch', { stdio: 'inherit' });
    console.log("✅ Database schema synchronized.");
  } catch {
    console.error("❌ Database bootstrap failed. Ensure wrangler is installed.");
  }

  // 3. R2 Mock Seeding
  const mockStoragePath = path.join('.wrangler', 'state', 'v3', 'r2');
  if (!existsSync(mockStoragePath)) {
    console.log("📂 Initializing local R2 storage...");
    mkdirSync(mockStoragePath, { recursive: true });
  }
  console.log("✅ Local storage ready.");

  console.log("\n✨ Setup Complete! Run 'npm run dev' to start the portal.");
}

setup();
