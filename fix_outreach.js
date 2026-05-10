const fs = require('fs');
let c = fs.readFileSync('src/components/OutreachTracker.tsx', 'utf8');
c = c.replace(/onChange: outreachFormSchema\.shape\.([a-zA-Z_]+),/g, 'onChange: outreachFormSchema.shape.$1 as any,');
fs.writeFileSync('src/components/OutreachTracker.tsx', c);
