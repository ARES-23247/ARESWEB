const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content
      .replace(/text-marble\/70/g, 'text-marble')
      .replace(/text-marble\/80/g, 'text-marble')
      .replace(/text-marble\/60/g, 'text-marble/90')
      .replace(/text-white\/70/g, 'text-white')
      .replace(/text-white\/80/g, 'text-white')
      .replace(/text-white\/90/g, 'text-white')
      .replace(/text-\[10px\]/g, 'text-xs')
      .replace(/bg-black\/20 text-white/g, 'bg-black/40 text-white')
      .replace(/bg-ares-black-soft/g, 'bg-obsidian')
      ;
      
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log('Updated: ' + filePath);
    }
  }
});
