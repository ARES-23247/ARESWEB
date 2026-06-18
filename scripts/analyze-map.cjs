const fs = require('fs');
const mapFile = fs.readFileSync(process.argv[2], 'utf8');
const mapData = JSON.parse(mapFile);
const sources = mapData.sources;
const sourceSizes = {};
sources.forEach(s => {
  const parts = s.split('node_modules/');
  if (parts.length > 1) {
    const pkgName = parts[1].split('/')[0] + (parts[1].startsWith('@') ? '/' + parts[1].split('/')[1] : '');
    sourceSizes[pkgName] = (sourceSizes[pkgName] || 0) + 1;
  }
});
console.log(Object.entries(sourceSizes).sort((a,b)=>b[1]-a[1]).slice(0, 20));
