/**
 * Sanitizes user input specifically for logo resolution.
 * Strips protocols, subdomains (like www), and pathnames to get a clean root domain.
 */
export function extractDomain(input: string): string {
  if (!input) return "";
  
  let cleaned = input.trim().toLowerCase();
  
  // Remove protocol
  cleaned = cleaned.replace(/^(https?:\/\/)/, "");
  
  // Remove www.
  cleaned = cleaned.replace(/^www\./, "");
  
  // Remove pathnames and query strings
  cleaned = cleaned.split('/')[0].split('?')[0];
  
  return cleaned;
}

/**
 * Generates a logo URL using the Unavatar service.
 * Falls back to multiple sources (Twitter, Clearbit, Google, etc.)
 */
export function getLogoUrl(domain: string): string {
  if (!domain) return "";
  const clean = extractDomain(domain);
  // We use unavatar.io with the microlink fallback for highest reliability
  return `https://unavatar.io/${clean}?fallback=false`;
}
