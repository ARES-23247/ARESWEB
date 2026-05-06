/**
 * Clear stale rate limit entries for a specific IP
 *
 * Usage:
 *   npx tsx scripts/clear-rate-limits.ts <ip-address>
 *
 * Or run via Wrangler:
 *   wrangler d1 execute ares-db --remote --command="DELETE FROM rate_limits WHERE ip LIKE '%<ip-pattern>%'"
 */

async function clearRateLimits() {
  const ip = process.argv[2];

  if (!ip) {
    console.log("Usage: npx tsx scripts/clear-rate-limits.ts <ip-address>");
    console.log("");
    console.log("Or use Wrangler directly:");
    console.log("  wrangler d1 execute ares-db --remote --command=\"DELETE FROM rate_limits WHERE ip LIKE '%<partial-ip>%'\"");
    console.log("");
    console.log("To see all current rate limit entries:");
    console.log("  wrangler d1 execute ares-db --remote --command=\"SELECT * FROM rate_limits ORDER BY expires_at DESC LIMIT 20\"");
    return;
  }

  console.log(`To clear rate limits for IP ${ip}, run:`);
  console.log(``);
  console.log(`wrangler d1 execute ares-db --remote --command="DELETE FROM rate_limits WHERE ip LIKE '%${ip}%' OR ip = '${ip}:unknown'"`);
  console.log(``);
  console.log(`Or to see what entries exist:`);
  console.log(`wrangler d1 execute ares-db --remote --command="SELECT * FROM rate_limits WHERE ip LIKE '%${ip}%'"`);
}

clearRateLimits();
