import { createHmac, randomBytes } from "node:crypto";
import { closeSync, constants, openSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const INSTALLATION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u;

function fail(message) {
  throw new Error(message);
}

function options(argv) {
  const parsed = { teams: [], workspaces: [], expiresDays: 365, rotate: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--rotate") {
      parsed.rotate = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for ${argument}.`);
    index += 1;
    if (argument === "--project") parsed.project = value;
    else if (argument === "--installation") parsed.installation = value;
    else if (argument === "--team") parsed.teams.push(value);
    else if (argument === "--workspace") parsed.workspaces.push(value);
    else if (argument === "--output") parsed.output = value;
    else if (argument === "--expires-days") parsed.expiresDays = Number(value);
    else fail(`Unknown option: ${argument}`);
  }
  if (!parsed.project) fail("--project is required.");
  if (!parsed.installation || !INSTALLATION_ID_PATTERN.test(parsed.installation)) {
    fail("--installation must be a lowercase identifier containing letters, digits, or hyphens.");
  }
  if (!parsed.output) fail("--output is required so the token is never printed to the terminal.");
  if (parsed.teams.length === 0 && parsed.workspaces.length === 0) {
    fail("At least one --team or --workspace authorization is required.");
  }
  if (!Number.isSafeInteger(parsed.expiresDays) || parsed.expiresDays < 1 || parsed.expiresDays > 730) {
    fail("--expires-days must be an integer from 1 through 730.");
  }
  return parsed;
}

function tokenHash(key, salt, tokenSecret) {
  return createHmac("sha256", key)
    .update(`aresweb-studio-token:v1:${salt}:${tokenSecret}`)
    .digest("hex");
}

function writeExclusiveSecret(path, value) {
  const descriptor = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    writeFileSync(descriptor, value, { encoding: "utf8" });
  } finally {
    closeSync(descriptor);
  }
}

const parsed = options(process.argv.slice(2));
const integrationSecret = process.env.ABUSE_HMAC_SECRET;
if (!integrationSecret || integrationSecret.length < 32) {
  fail("ABUSE_HMAC_SECRET must be supplied from Secret Manager and contain at least 32 characters.");
}

const app = getApps()[0] || initializeApp({
  credential: applicationDefault(),
  projectId: parsed.project,
});
const db = getFirestore(app);
const installationRef = db.collection("studio_integrations").doc(parsed.installation);
const existing = await installationRef.get();
if (existing.exists && !parsed.rotate) {
  fail("The installation already exists. Re-run with --rotate to replace its credential.");
}

const tokenSecret = randomBytes(32).toString("base64url");
const salt = randomBytes(24).toString("base64url");
const token = `ares_studio_${parsed.installation}.${tokenSecret}`;
const now = new Date();
const expiresAt = new Date(now.getTime() + parsed.expiresDays * 24 * 60 * 60 * 1_000);
const outputPath = resolve(parsed.output);

// Write the one-time handoff before activating the hash. If Firestore fails,
// the file can be discarded; no usable credential exists server-side.
writeExclusiveSecret(outputPath, JSON.stringify({
  installationId: parsed.installation,
  endpoint: "https://aresfirst.org/api/integrations/robotics-studio/v1/notebook-drafts",
  token,
  expiresAt: expiresAt.toISOString(),
}, null, 2));

await installationRef.set({
  schemaVersion: 1,
  installationId: parsed.installation,
  tokenSalt: salt,
  tokenHash: tokenHash(integrationSecret, salt, tokenSecret),
  status: "active",
  scopes: ["notebook:draft:create"],
  allowedTeamIds: [...new Set(parsed.teams)],
  allowedWorkspaceIds: [...new Set(parsed.workspaces)],
  createdAt: existing.exists && existing.data()?.createdAt
    ? existing.data().createdAt
    : now.toISOString(),
  rotatedAt: existing.exists ? now.toISOString() : null,
  expiresAt: expiresAt.toISOString(),
  credentialVersion: (Number(existing.data()?.credentialVersion) || 0) + 1,
}, { merge: false });

process.stdout.write(`Provisioned ${parsed.installation}; one-time credential written to ${outputPath}.\n`);
