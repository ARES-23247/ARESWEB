const https = require('https');

function testEndpoint(url) {
  const req = https.request(url, { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': 'Bearer fake'} }, (res) => {
    console.log(url, 'Status:', res.statusCode);
    res.on('data', d => process.stdout.write(d.toString()));
  });
  req.write(JSON.stringify({model: "glm-4", messages: [{role:"user", content:"hello"}], stream: true}));
  req.end();
}

testEndpoint('https://api.z.ai/api/coding/paas/v4/chat/completions');
testEndpoint('https://api.z.ai/api/paas/v4/chat/completions');
