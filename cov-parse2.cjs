const fs = require('fs');
['events/handlers.ts.html', 'zulipWebhook.ts.html'].forEach(f => {
  const path = 'coverage/functions/api/routes/' + f;
  if (!fs.existsSync(path)) return;
  const file = fs.readFileSync(path, 'utf8');
  const regex = /<span class="fstat-no" title="function not covered" >([^<]+)<\/span>/g;
  let match;
  while ((match = regex.exec(file)) !== null) {
    console.log(f, 'missing function:', match[1]);
  }
});
