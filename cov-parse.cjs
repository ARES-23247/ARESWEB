const fs = require('fs');
const html = fs.readFileSync('coverage/index.html', 'utf8');
const regex = /<td class="file[^>]+><a href="([^"]+)">[^<]+<\/a><\/td>\s*<td[^>]*>.*?<\/td>\s*<td[^>]*>.*?<\/td>\s*<td[^>]*>.*?<\/td>\s*<td[^>]*>.*?<\/td>\s*<td[^>]*>.*?<\/td>\s*<td data-value="([0-9.]+)" class="pct/gs;
let match;
while ((match = regex.exec(html)) !== null) {
  if (parseFloat(match[2]) < 100) {
    console.log(match[1], "Funcs: " + match[2] + "%");
  }
}
