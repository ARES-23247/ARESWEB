const { execSync } = require('child_process');

console.log('Running eslint auto-fix...');
try {
  execSync('npx eslint . --ext .ts,.tsx --fix', { stdio: 'inherit' });
  console.log('✅ Auto-fix complete');
} catch (e) {
  console.log('⚠️  Some issues remain');
}
