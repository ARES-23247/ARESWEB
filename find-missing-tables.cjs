const fs = require('fs');
const sql2 = fs.readFileSync('drizzle/0002_pretty_forgotten_one.sql', 'utf8');
const sql0 = fs.readFileSync('drizzle/0000_tidy_prima.sql', 'utf8');
const sql1 = fs.readFileSync('drizzle/0001_motionless_norman_osborn.sql', 'utf8');

const tables = [...sql2.matchAll(/CREATE TABLE `__new_(.*?)`/g)].map(m => m[1]);
tables.forEach(t => {
  const t0 = sql0.includes('CREATE TABLE `' + t + '`');
  const t1 = sql1.includes('CREATE TABLE `' + t + '`');
  if (!t0 && !t1) {
    console.log('MISSING: ' + t);
  }
});
