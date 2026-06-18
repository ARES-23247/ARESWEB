const fs = require('fs');
const content = fs.readFileSync('dist/stats.html', 'utf8');
const match = content.match(/window\.customData\s*=\s*(\[.*?\]);\s*<\/script>/s);
if (match) {
  const data = JSON.parse(match[1]);
  const idx = data.find(n => n.name && n.name.includes('index-'));
  if (idx) {
    console.log(idx.children.map(c => ({name: c.name, size: c.statSize})).sort((a,b)=>b.size-a.size).slice(0, 20));
  } else {
    console.log('no index chunk found');
  }
} else {
  console.log('no match');
}
