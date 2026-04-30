# Research: Features

## How do these features typically work? Expected behavior?

### Sponsor Logo Updates
- **Table Stakes:** Users with Admin or Finance roles can upload a new logo image (PNG/JPG/SVG) for an existing sponsor in the dashboard. The logo immediately updates on the public-facing sponsor wall.
- **Expected Behavior:** The form should submit a `multipart/form-data` request, validate image dimensions/size (e.g., max 2MB), upload to cloud storage, and return a URL to be saved in the `sponsors` D1 table. 
- **Differentiators:** Automatic image resizing/compression (WebP) or cropping UI.

### Documentation Improvements
- **Table Stakes:** ARESWEB docs should be properly structured, easy to navigate, and mobile-friendly. We should migrate best-practice UI patterns (like sidebars, code syntax highlighting, search) from the `areslib` documentation structure.
- **Expected Behavior:** High-fidelity markdown rendering (likely using standard TipTap or custom MDX parsers), copy-to-clipboard buttons on code blocks, and clear API references.
