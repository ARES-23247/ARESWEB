const https = require('https');

const req = https.request('https://api.z.ai/v1/chat/completions', { method: 'POST', headers: {'Content-Type':'application/json'} }, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});
req.write(JSON.stringify({model: "glm-4", messages: [{role:"user", content:"hello"}]}));
req.end();
