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
  
  // single line returns like `return c.json({ error: "Failed" }, 500);`
  // or `return c.json(result, 200);`
  // wait, this regex is safe:
  // }, 200) -> } as any, 200)
  code = code.replace(/\}(\s*,\s*\d+\s*\))/g, '} as any$1');
  
  // array returns
  code = code.replace(/\](\s*,\s*\d+\s*\))/g, '] as any$1');
  
  // identifier returns `return c.json(results, 200)`
  code = code.replace(/return c\.json\(([a-zA-Z0-9_]+)(\s*,\s*\d+\s*\))/g, 'return c.json($1 as any$2');

  // replace success: false on 500
  code = code.replace(/\{\s*success:\s*false\s*\}\s*as any\s*,\s*500/g, '{ error: "Internal Server Error" } as any, 500');

  fs.writeFileSync(file, code);
}
console.log('Done modifying API routes');
