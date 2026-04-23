const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // TechStack.tsx: Fix text-transparent bg-clip-text
    content = content.replace(/text-transparent bg-clip-text bg-gradient-to-r from-white to-ares-cyan/g, 'text-ares-cyan');
    content = content.replace(/text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-ares-bronze/g, 'text-ares-red');
    content = content.replace(/text-transparent bg-clip-text bg-gradient-[^"']*/g, 'text-white');

    // Blog.tsx: Link indistinguishable without color
    content = content.replace(/hover:underline focus-visible:outline-none/g, 'underline focus-visible:outline-none');

    // Judges.tsx: text-ares-gray to text-marble
    if (filePath.includes('JudgesHub.tsx') || filePath.includes('Judges')) {
       content = content.replace(/text-ares-gray/g, 'text-marble');
    }

    // Leaderboard.tsx: text-ares-offwhite to text-white
    content = content.replace(/text-ares-offwhite/g, 'text-white');

    // Seasons.tsx and Outreach.tsx: change bg-ares-red container to bg-obsidian to pass contrast for text-white
    // Wait, let's find bg-ares-red containers with white text and add bg-obsidian instead.
    if (filePath.includes('Seasons.tsx')) {
        content = content.replace(/bg-ares-red text-center shadow-2xl/g, 'bg-obsidian border border-white/10 text-center shadow-2xl');
    }
    if (filePath.includes('Outreach.tsx')) {
        content = content.replace(/bg-ares-red p-12/g, 'bg-obsidian border border-white/10 p-12');
        content = content.replace(/bg-white text-ares-red/g, 'bg-ares-red text-white'); // The button
    }
    
    // Join.tsx, Events.tsx, Outreach.tsx Hero: "text-white" over "bg-ares-cyan/5 blur"
    // The blur causes pa11y to complain. Let's remove the absolute positioning for blurs or wrap text in solid background?
    // Actually, pa11y checks element's background color. If the parent doesn't have a solid bg, it fails.
    // If we add `bg-obsidian` to the specific sections or `bg-ares-gray-deep` explicitly on the section, pa11y can calculate it.
    
    content = content.replace(/<section className="py-32 px-6 relative z-10">/g, '<section className="py-32 px-6 relative z-10 bg-ares-gray-deep">');
    content = content.replace(/<section className="py-32 px-6 relative z-10 text-center">/g, '<section className="py-32 px-6 relative z-10 text-center bg-ares-gray-deep">');
    content = content.replace(/<div className="flex flex-col w-full bg-ares-gray-deep min-h-screen text-marble relative overflow-hidden">/g, '<div className="flex flex-col w-full bg-ares-gray-deep min-h-screen text-marble relative overflow-hidden bg-ares-gray-deep">');

    // Sponsors.tsx specific fixes
    if (filePath.includes('Sponsors.tsx')) {
       // Message label text-marble -> is it failing because of bg?
       // Wait, the footer is bg-obsidian now. Why did it fail?
       // "ARES 23247 operates under a 501..."
       // Let's explicitly set the form container to bg-obsidian.
       content = content.replace(/bg-obsidian\/80/g, 'bg-obsidian');
       content = content.replace(/backdrop-blur-md/g, ''); // blur messes up pa11y contrast checks
    }

      
    if (original !== content) {
      fs.writeFileSync(filePath, content);
      console.log('Updated: ' + filePath);
    }
  }
});
