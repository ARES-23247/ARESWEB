const pty = require('child_process');

// We will just patch the process inside a wrapper script.
const fs = require('fs');

const script = `
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
`;
fs.writeFileSync('drizzle-wrapper.cjs', script);

const child = pty.spawn("node", ["drizzle-wrapper.cjs", "generate", "--name", "gcal_event_unique"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "1" }
});

child.stdout.on("data", (data) => {
  const str = data.toString();
  console.log(str);
  // Just aggressively write 'y\n' every time there's output
  child.stdin.write("y\r\n");
});

child.stderr.on("data", (data) => {
  console.error(data.toString());
});

child.on("close", (code) => {
  console.log('Exited with code ' + code);
});
