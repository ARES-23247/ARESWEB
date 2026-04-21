const fs = require('fs');
const path = require('path');

const srcPath = 'src';
const exts = ['.tsx', '.ts', '.jsx', '.js'];

const map = {
  'rounded-md': 'ares-cut-sm',
  'rounded-lg': 'ares-cut-sm',
  'rounded-xl': 'ares-cut-sm',
  'rounded-2xl': 'ares-cut',
  'rounded-3xl': 'ares-cut-lg',
  'rounded-\\[2rem\\]': 'ares-cut-lg',
  'rounded-\\[3rem\\]': 'ares-cut-lg'
};

const regex = new RegExp(Object.keys(map).join('|'), 'g');

let changedFiles = 0;

function walk(dir) {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) return;
  const list = fs.readdirSync(dirPath);
  list.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      walk(path.join(dir, file));
    } else {
      if (exts.includes(path.extname(file))) {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        let matchCount = 0;
        content = content.replace(regex, (match) => {
           matchCount++;
           const key = match.replace('[', '\\[').replace(']', '\\]');
           return map[key] || match;
        });

        if (content !== originalContent) {
          fs.writeFileSync(filePath, content);
          console.log('Updated ' + file + ': replaced ' + matchCount + ' classes.');
          changedFiles++;
        }
      }
    }
  });
}

walk(srcPath);
console.log('Audit complete. Updated ' + changedFiles + ' files.');
