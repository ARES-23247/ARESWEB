# Web Rendering and HTTP Status Architecture

ARESWEB remains a client-rendered React application for authenticated and highly
interactive experiences. Public crawl behavior uses two bounded server/static
layers instead of treating every URL as the same `index.html` response.

## Static public routes

`scripts/prerender-static-routes.mjs` runs after Vite. It clones the hashed
application shell for every known public route and writes route-specific title,
description, canonical, Open Graph, and Twitter metadata under
`dist/prerender/`. Firebase Hosting rewrites only those exact paths to those
files. The browser still hydrates the normal client application.

## Dynamic public records

Blog posts, Academy/ARESLib documents, events, and robots are rewritten to the
`web` function. The function validates the bounded record ID, reads the one
expected Firestore document, applies the same published/non-deleted visibility
contract as the public UI, and injects explicit escaped metadata into the
deployed static shell. A missing, draft, deleted, or non-indexable record returns
an HTTP 404 with a standalone `noindex` document. Firestore or shell-origin
failures return 503 and are never misreported as missing content.

The renderer binds no secrets. It returns only metadata derived from public
fields and never serializes a raw Firestore document into HTML.

Dynamic HTML is deliberately not cached. The renderer fetches the active
`index.html` on each request so a just-deployed shell cannot retain references to
assets from the previous Hosting release.

## Unknown and private routes

There is intentionally no Hosting `** -> /index.html` rewrite. Unknown paths
therefore use `dist/404.html` and carry a genuine HTTP 404. Explicit SPA rewrites
remain for `/dashboard`, the noindex scouting area, the simulation playground,
and the legacy `/tasks` redirect. Installed service workers may still show the
offline application shell during a network outage; that does not change the
origin's HTTP status while online.

When adding a route, decide explicitly whether it is static public, dynamic
public, authenticated SPA, or genuinely unknown. Add the corresponding Hosting
and metadata tests in the same change.
