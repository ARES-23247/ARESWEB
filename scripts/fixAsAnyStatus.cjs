const fs = require('fs');
const files = [
  'functions/api/routes/analytics.ts',
  'functions/api/routes/docs.ts',
  'functions/api/routes/finance.ts',
  'functions/api/routes/github.ts',
  'functions/api/routes/judges.ts',
  'functions/api/routes/posts.ts',
  'functions/api/routes/scouting/analyses.ts',
  'functions/api/routes/scouting/analyze.ts',
  'functions/api/routes/scouting/ftcevents-proxy.ts',
  'functions/api/routes/scouting/toa-proxy.ts',
  'functions/api/routes/settings.ts'
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  
  code = code.replace(/as any\s*,\s*(\d+)\s*\)/g, 'as any, $1 as any)');
  code = code.replace(/as any\s*,\s*([a-zA-Z0-9_\.]+)\s*\)/g, 'as any, $1 as any)');

  fs.writeFileSync(file, code);
}
console.log('Fixed statuses to any');
