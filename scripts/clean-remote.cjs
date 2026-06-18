const { execSync } = require('child_process');

console.log('Fetching tables from remote preview database...');
const output = execSync('npx wrangler d1 execute DB --env preview --remote --command "PRAGMA table_list;" --json', { encoding: 'utf8' });
console.log(output);

try {
  const json = JSON.parse(output);
  const results = json[0].results;
  const tables = results.map(r => r.name).filter(t => !t.startsWith('sqlite_') && !t.startsWith('d1_') && t !== '_cf_KV');
  const uniqueTables = [...new Set(tables)];

  console.log('Tables to drop:', uniqueTables);

  for (const table of uniqueTables) {
    console.log('Dropping ' + table + '...');
    try {
      execSync(`npx wrangler d1 execute DB --env preview --remote --command "DROP TABLE IF EXISTS \\"${table}\\";"`, { stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to drop ' + table, e.message);
    }
  }

  // Now clean up migrations table
  console.log('Wiping d1_migrations table...');
  try {
    execSync(`npx wrangler d1 execute DB --env preview --remote --command "DELETE FROM d1_migrations;"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to clear migrations', e.message);
  }

  console.log('Done!');
} catch (e) {
  console.error("Error parsing output: ", e);
}
