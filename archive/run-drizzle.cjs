const { spawn } = require("child_process");

const child = spawn("npx", ["drizzle-kit", "generate"], {
  stdio: ["pipe", "pipe", "pipe"],
  shell: true,
  env: { ...process.env, FORCE_COLOR: "1" }
});

child.stdout.on("data", (data) => {
  const str = data.toString();
  console.log(str);
  if (str.includes("?")) {
    console.log("PROMPT DETECTED");
    child.stdin.write("y\r");
  }
});

child.stderr.on("data", (data) => {
  console.error(data.toString());
});

child.on("close", (code) => {
  console.log(`child process exited with code ${code}`);
});
