Object.defineProperty(process.stdout, 'isTTY', { value: true });
Object.defineProperty(process.stdin, 'isTTY', { value: true });

process.argv = [process.argv[0], process.argv[1], 'generate'];

const { PassThrough } = require('stream');
const pass = new PassThrough();
pass.setRawMode = () => {};
pass.on = (event, callback) => {
  if (event === 'keypress') {
    // wait a bit, then simulate pressing Down then Enter
    setTimeout(() => {
      callback('', { name: 'down', ctrl: false, meta: false, shift: false });
      setTimeout(() => {
        callback('\r', { name: 'return', ctrl: false, meta: false, shift: false });
      }, 100);
    }, 500);
  }
  return pass;
};
pass.removeListener = () => {};

Object.defineProperty(process, 'stdin', { value: pass });
Object.defineProperty(process.stdin, 'isTTY', { value: true });

require('./node_modules/drizzle-kit/bin.cjs');
