const fs = require('fs');
let sql = fs.readFileSync('docs-seed.sql', 'utf8');

// Remove import statements
sql = sql.replace(/import\s+[A-Za-z0-9]+\s+from\s+''\.\.\/\.\.\/\.\.\/components\/[A-Za-z0-9]+\.(astro|tsx|jsx)'';\n*/g, '');

// Close the simulator tags
sql = sql.replace(/<SwerveSimulator\s*\/>/g, '<swervesimulator></swervesimulator>');
sql = sql.replace(/<SOTMSimulator\s*\/>/g, '<sotmsimulator></sotmsimulator>');
sql = sql.replace(/<CodePlayground.*?\/>/g, '<codeplayground></codeplayground>');
sql = sql.replace(/<ConfigVisualizer.*?\/>/g, '<configvisualizer></configvisualizer>');
sql = sql.replace(/<ScreenshotGallery.*?\/>/g, '<screenshotgallery></screenshotgallery>');

// Also properly close tags if they were written like <ConfigVisualizer>
sql = sql.replace(/<([A-Z][a-zA-Z0-9]*Simulator|CodePlayground|ConfigVisualizer|ScreenshotGallery)\s*>/g, (match, p1) => {
    return `<${p1.toLowerCase()}></${p1.toLowerCase()}>`;
});

fs.writeFileSync('docs-seed-fixed.sql', sql);
console.log("Fixed SQL generated.");
