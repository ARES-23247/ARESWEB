/**
 * OpenAPI Spec Generator Script
 * Fetches the OpenAPI spec from the running dev server
 *
 * Usage:
 *   npm run generate:openapi
 *
 * Note: This requires the dev server to be running on port 8788
 * Start it first with: npm run preview
 */

const OPENAPI_URL = 'http://localhost:8788/api/openapi.json';
const OUTPUT_FILE = 'openapi.json';

async function generateOpenAPI() {
  try {
    console.log('🔧 Fetching OpenAPI spec from', OPENAPI_URL);

    const response = await fetch(OPENAPI_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const spec = await response.json();

    // Write to file
    // eslint-disable-next-line no-undef
    await Bun.write(OUTPUT_FILE, JSON.stringify(spec, null, 2));

    const pathCount = Object.keys(spec.paths || {}).length;
    const schemaCount = Object.keys(spec.components?.schemas || {}).length;

    console.log(`✅ OpenAPI spec written to: ${OUTPUT_FILE}`);
    console.log(`📊 Stats: ${pathCount} paths, ${schemaCount} schemas`);
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI spec:', error.message);
    console.error('\n💡 Make sure the dev server is running:');
    console.error('   npm run preview');
    process.exit(1);
  }
}

generateOpenAPI();
