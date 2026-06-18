
process.stdout.isTTY = true;
process.stdin.isTTY = true;

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const mockStdin = new (require('stream').PassThrough)();
mockStdin.isTTY = true;
process.stdin = mockStdin;
Object.defineProperty(process, 'stdin', { get: () => mockStdin });

require('./node_modules/drizzle-kit/bin.cjs');
