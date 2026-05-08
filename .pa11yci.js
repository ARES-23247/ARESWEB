/**
 * Pa11y CI Configuration
 * Uses PREVIEW_URL environment variable for CI testing against deployed previews
 *
 * Note: Only tests public pages. Authenticated routes like /dashboard are excluded.
 *
 * Must use function wrapper for pa11y-ci compatibility with ES modules.
 */

module.exports = () => {
  const baseUrl = process.env.PREVIEW_URL || 'http://localhost:4173';

  // Only public pages - dashboard and other authenticated routes require login
  const urls = [
    '/',
    '/about',
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

  return {
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
};
