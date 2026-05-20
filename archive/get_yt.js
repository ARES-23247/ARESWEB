// eslint-disable-next-line @typescript-eslint/no-require-imports
const https = require("https");
https.get("https://www.youtube.com/@ARESFTC", (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
    const match = data.match(/"externalId":"(UC[^"]+)"/);
    if (match) {
      console.log(match[1]);
      process.exit(0);
    }
  });
});
