const fs = require('fs');
let text = fs.readFileSync('tsc-errors3.txt', 'utf16le');
const lines = text.split('\n');
let capture = false;
let out = [];
lines.forEach(l => {
  if (l.includes('error TS2345:')) {
    out.push(l);
    capture = true;
  } else if (capture && (l.startsWith(' ') || l.startsWith('\t'))) {
    out.push(l);
  } else {
    capture = false;
  }
});
fs.writeFileSync('errors.txt', out.join('\n'));
console.log('Parsed ' + out.length + ' lines into errors.txt');
