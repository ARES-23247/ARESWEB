/**
 * Pa11y CI Configuration
 * Uses PREVIEW_URL environment variable for CI testing against deployed previews
 */

const baseUrl = process.env.PREVIEW_URL || 'http://localhost:4173';

const urls = [
  '/',
  '/about',
  '/dashboard',
  '/sponsors',
  '/seasons',
  '/outreach',
  '/tech-stack',
  '/accessibility',
  '/privacy',
  '/join',
  '/leaderboard',
  '/bug-report',
  '/blog',
  '/events',
  '/docs',
  '/judges',
].map(path => `${baseUrl}${path}`);

export default {
  defaults: {
    standard: 'WCAG2AA',
    timeout: 30000,
    runners: ['axe', 'htmlcs'],
    chromeLaunchConfig: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
    hideElements: '#hero-mountaineer-mindset, #nav-support-us',
  },
  urls,
};
