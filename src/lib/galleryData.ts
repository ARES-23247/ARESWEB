/**
 * ARES 23247 Team Media & Album Collections Data Architecture
 * 
 * Strict Zero-PII Policy:
 * In accordance with FIRST youth safety, COPPA, and student privacy boundaries,
 * public photo metadata must never include student minor personal names,
 * private tags, contact info, or unapproved personal identifiers.
 * Only robot subsystems, competition roles, events, and technical EXIF details are permitted.
 */

export const ALBUM_CATEGORIES = [
  "Competitions",
  "Outreach",
  "Robot Build",
  "Team Culture",
] as const;

export type AlbumCategory = (typeof ALBUM_CATEGORIES)[number];

export const GALLERY_SEASONS = [
  "2025-2026",
  "2024-2025",
  "2023-2024",
  "Legacy Archive",
] as const;

export type GallerySeason = (typeof GALLERY_SEASONS)[number];

export interface PhotoExif {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  dimensions?: string;
}

export interface GalleryPhoto {
  key: string;
  id?: string;
  title?: string;
  altText?: string;
  category: AlbumCategory | string;
  season?: string;
  albumId?: string;
  albumTitle?: string;
  date?: string;
  dateKind?: "Captured" | "Published";
  location?: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  tags?: string[];
  exif?: PhotoExif;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  description: string;
  season: string;
  category: AlbumCategory;
  coverImageUrl: string;
  date: string;
  location: string;
  photoCount: number;
  photos: GalleryPhoto[];
}

/**
 * Forbidden PII patterns that must never appear in public photo tagging.
 * Checks for student personal names, social tags, emails, phone numbers, or private handles.
 */
const FORBIDDEN_PII_PATTERNS = [
  /@\w+/, // social handles
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // email addresses
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // phone numbers
  /\b(student|minor|kid|child|personal|private|name|fullname):/i,
];

/**
 * Validates whether a tag adheres to strict Zero-PII youth protection standards.
 */
export function isSafePublicTag(tag: string): boolean {
  if (!tag || typeof tag !== "string") return false;
  const clean = tag.trim();
  if (clean.length === 0 || clean.length > 50) return false;

  for (const pattern of FORBIDDEN_PII_PATTERNS) {
    if (pattern.test(clean)) return false;
  }

  // Reject personal name tagging prefixes or identifiers
  if (/^(name|student|minor|person|id):/i.test(clean)) return false;

  return true;
}

/**
 * Sanitizes an array of tags, removing any potential PII or invalid tokens.
 */
export function sanitizePhotoTags(tags?: unknown[]): string[] {
  if (!Array.isArray(tags)) return [];
  const safeTags = new Set<string>();

  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const clean = raw.trim();
    if (isSafePublicTag(clean)) {
      safeTags.add(clean);
    }
  }

  return Array.from(safeTags).slice(0, 15);
}

/**
 * Safe public EXIF sanitizer removing any sensitive camera serial numbers or device IDs.
 */
export function sanitizeExif(exif?: Partial<PhotoExif>): PhotoExif | undefined {
  if (!exif || typeof exif !== "object") return undefined;
  const clean: PhotoExif = {};
  if (typeof exif.camera === "string" && exif.camera.trim()) clean.camera = exif.camera.trim().slice(0, 60);
  if (typeof exif.lens === "string" && exif.lens.trim()) clean.lens = exif.lens.trim().slice(0, 60);
  if (typeof exif.focalLength === "string" && exif.focalLength.trim()) clean.focalLength = exif.focalLength.trim().slice(0, 20);
  if (typeof exif.aperture === "string" && exif.aperture.trim()) clean.aperture = exif.aperture.trim().slice(0, 20);
  if (typeof exif.shutterSpeed === "string" && exif.shutterSpeed.trim()) clean.shutterSpeed = exif.shutterSpeed.trim().slice(0, 20);
  if (typeof exif.iso === "string" && exif.iso.trim()) clean.iso = exif.iso.trim().slice(0, 20);
  if (typeof exif.dimensions === "string" && exif.dimensions.trim()) clean.dimensions = exif.dimensions.trim().slice(0, 30);
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export const ZERO_PII_DISCLAIMER =
  "Strict Zero-PII Protection: In compliance with FIRST youth safety and student privacy policies, public photos only feature subsystem tags, competition roles, and technical metadata. No personal minor names or private youth identities are indexed or displayed.";

export const CURATED_ALBUMS: GalleryAlbum[] = [
  {
    id: "wv-state-championship-2026",
    title: "WV State Championship 2026",
    description:
      "Highlights from the West Virginia State Championship tournament, alliance selection, playoff elimination matches, and the Control Award presentation.",
    season: "2025-2026",
    category: "Competitions",
    coverImageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80",
    date: "2026-03-07",
    location: "Fairmont Fieldhouse, Fairmont, WV",
    photoCount: 4,
    photos: [
      {
        key: "wv-2026-01",
        id: "wv-2026-01",
        title: "Match Playoff Autonomous Sequence",
        altText: "ARES 23247 robot executing 5-specimen autonomous routine on the tournament field",
        category: "Competitions",
        season: "2025-2026",
        albumId: "wv-state-championship-2026",
        albumTitle: "WV State Championship 2026",
        date: "2026-03-07",
        dateKind: "Captured",
        location: "Fairmont Fieldhouse, Fairmont, WV",
        description: "Autonomous high-basket sample scoring during Semi-Final Match 2 with sub-centimeter odometry tracking.",
        imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80",
        tags: ["Autonomous", "Odometry", "Playoffs", "Field Arena"],
        exif: {
          camera: "Sony Alpha 7 IV",
          lens: "FE 70-200mm f/2.8 GM OSS II",
          focalLength: "135mm",
          aperture: "f/2.8",
          shutterSpeed: "1/1000s",
          iso: "ISO 1600",
          dimensions: "7008 x 4672",
        },
      },
      {
        key: "wv-2026-02",
        id: "wv-2026-02",
        title: "Drive Team Queueing at Division Field",
        altText: "Drive team with game pads and driver station queuing for finals match",
        category: "Competitions",
        season: "2025-2026",
        albumId: "wv-state-championship-2026",
        albumTitle: "WV State Championship 2026",
        date: "2026-03-07",
        dateKind: "Captured",
        location: "Fairmont Fieldhouse, Fairmont, WV",
        description: "Drive team preparing controllers and verifying wireless connection before championship finals.",
        imageUrl: "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80",
        tags: ["Drive Team", "Driver Station", "Championship Finals"],
        exif: {
          camera: "Canon EOS R6 Mark II",
          lens: "RF 24-70mm f/2.8 L IS USM",
          focalLength: "50mm",
          aperture: "f/2.8",
          shutterSpeed: "1/640s",
          iso: "ISO 1250",
          dimensions: "6000 x 4000",
        },
      },
      {
        key: "wv-2026-03",
        id: "wv-2026-03",
        title: "Control Award Presentation Ceremony",
        altText: "Team receiving Control Award banner on main stadium stage",
        category: "Competitions",
        season: "2025-2026",
        albumId: "wv-state-championship-2026",
        albumTitle: "WV State Championship 2026",
        date: "2026-03-07",
        dateKind: "Captured",
        location: "Fairmont Fieldhouse, Fairmont, WV",
        description: "ARES 23247 recognized with the Control Award for custom field localization algorithms and vision pipelines.",
        imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
        tags: ["Control Award", "Awards Ceremony", "Software Innovation"],
        exif: {
          camera: "Sony Alpha 7 IV",
          lens: "FE 24-70mm f/2.8 GM II",
          focalLength: "35mm",
          aperture: "f/3.2",
          shutterSpeed: "1/500s",
          iso: "ISO 800",
          dimensions: "7008 x 4672",
        },
      },
      {
        key: "wv-2026-04",
        id: "wv-2026-04",
        title: "High-Speed Linear Lift Mechanism in Action",
        altText: "Close-up of continuous rigging linear slide mechanism extending to high chamber",
        category: "Competitions",
        season: "2025-2026",
        albumId: "wv-state-championship-2026",
        albumTitle: "WV State Championship 2026",
        date: "2026-03-07",
        dateKind: "Captured",
        location: "Fairmont Fieldhouse, Fairmont, WV",
        description: "Custom carbon-fiber linear slide extending to max height in under 450 milliseconds.",
        imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
        tags: ["Linear Slide", "Subsystem Specs", "Precision Rigging"],
        exif: {
          camera: "Sony Alpha 7 IV",
          lens: "FE 90mm f/2.8 Macro G OSS",
          focalLength: "90mm",
          aperture: "f/4.0",
          shutterSpeed: "1/1250s",
          iso: "ISO 2000",
          dimensions: "7008 x 4672",
        },
      },
    ],
  },
  {
    id: "spark-stem-expo",
    title: "Spark! STEM Expo",
    description:
      "Interactive hands-on robotics workshops, youth CAD demonstrations, and live robot driving arena for elementary and middle school students in Morgantown.",
    season: "2025-2026",
    category: "Outreach",
    coverImageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80",
    date: "2026-02-14",
    location: "Morgantown Public Library & Event Center, WV",
    photoCount: 3,
    photos: [
      {
        key: "spark-2026-01",
        id: "spark-2026-01",
        title: "Youth Hands-On Driving Station",
        altText: "Demonstration arena where young students practice driving FTC test chassis",
        category: "Outreach",
        season: "2025-2026",
        albumId: "spark-stem-expo",
        albumTitle: "Spark! STEM Expo",
        date: "2026-02-14",
        dateKind: "Captured",
        location: "Morgantown Public Library, WV",
        description: "Community students driving custom speed-limited demonstration robot with dual-stick wireless controllers.",
        imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=600&q=80",
        tags: ["STEM Outreach", "Demo Arena", "Community Workshop"],
        exif: {
          camera: "Fujifilm X-T5",
          lens: "XF 16-55mm f/2.8 R LM WR",
          focalLength: "24mm",
          aperture: "f/3.5",
          shutterSpeed: "1/250s",
          iso: "ISO 640",
          dimensions: "7728 x 5152",
        },
      },
      {
        key: "spark-2026-02",
        id: "spark-2026-02",
        title: "3D CAD & Prototyping Workshop",
        altText: "Onshape 3D modeling walkthrough on large presentation display for workshop attendees",
        category: "Outreach",
        season: "2025-2026",
        albumId: "spark-stem-expo",
        albumTitle: "Spark! STEM Expo",
        date: "2026-02-14",
        dateKind: "Captured",
        location: "Morgantown Public Library, WV",
        description: "Explaining planetary gearboxes, parametric constraints, and 3D printing slicing parameters.",
        imageUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80",
        tags: ["CAD Design", "3D Modeling", "STEM Education"],
        exif: {
          camera: "Fujifilm X-T5",
          lens: "XF 23mm f/1.4 R LM WR",
          focalLength: "23mm",
          aperture: "f/2.0",
          shutterSpeed: "1/400s",
          iso: "ISO 400",
          dimensions: "7728 x 5152",
        },
      },
      {
        key: "spark-2026-03",
        id: "spark-2026-03",
        title: "Sensory & Vision Demo Station",
        altText: "AprilTag and color sensor interactive target tracking demo table",
        category: "Outreach",
        season: "2025-2026",
        albumId: "spark-stem-expo",
        albumTitle: "Spark! STEM Expo",
        date: "2026-02-14",
        dateKind: "Captured",
        location: "Morgantown Public Library, WV",
        description: "Live OpenCV AprilTag detection display demonstrating how robotics vision algorithms determine 3D pose.",
        imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
        tags: ["Computer Vision", "Sensors", "OpenCV Demo"],
        exif: {
          camera: "Fujifilm X-T5",
          lens: "XF 16-55mm f/2.8 R LM WR",
          focalLength: "35mm",
          aperture: "f/2.8",
          shutterSpeed: "1/320s",
          iso: "ISO 500",
          dimensions: "7728 x 5152",
        },
      },
    ],
  },
  {
    id: "world-championship-houston-pit",
    title: "World Championship Houston Pit",
    description:
      "Behind-the-scenes inside the FIRST Championship Pit at George R. Brown Convention Center: rapid field repairs, match strategy debriefs, and global team collaboration.",
    season: "2024-2025",
    category: "Competitions",
    coverImageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    date: "2025-04-18",
    location: "George R. Brown Convention Center, Houston, TX",
    photoCount: 3,
    photos: [
      {
        key: "houston-2025-01",
        id: "houston-2025-01",
        title: "Pit Inspection & Wiring Loom Diagnostics",
        altText: "ARES pit technician checking CAN bus wiring and power distribution module",
        category: "Competitions",
        season: "2024-2025",
        albumId: "world-championship-houston-pit",
        albumTitle: "World Championship Houston Pit",
        date: "2025-04-18",
        dateKind: "Captured",
        location: "Houston Convention Center Pit #23247",
        description: "Pre-match diagnostic checklist verifying battery voltage drop under full stall current load.",
        imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80",
        tags: ["Pit Crew", "Electronics", "Diagnostics", "World Championship"],
        exif: {
          camera: "Nikon Z6 II",
          lens: "NIKKOR Z 24-70mm f/2.8 S",
          focalLength: "35mm",
          aperture: "f/2.8",
          shutterSpeed: "1/500s",
          iso: "ISO 1250",
          dimensions: "6048 x 4024",
        },
      },
      {
        key: "houston-2025-02",
        id: "houston-2025-02",
        title: "Alliance Scouting Strategy Table",
        altText: "Scouting team analyzing real-time match telemetry and cycle times on tablets",
        category: "Competitions",
        season: "2024-2025",
        albumId: "world-championship-houston-pit",
        albumTitle: "World Championship Houston Pit",
        date: "2025-04-18",
        dateKind: "Captured",
        location: "Houston Convention Center Division Pit",
        description: "Scouting analysts reviewing heatmaps and autonomous alliance compatibility matrices.",
        imageUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80",
        tags: ["Scouting", "Match Strategy", "Alliance Data"],
        exif: {
          camera: "Nikon Z6 II",
          lens: "NIKKOR Z 50mm f/1.8 S",
          focalLength: "50mm",
          aperture: "f/2.2",
          shutterSpeed: "1/640s",
          iso: "ISO 800",
          dimensions: "6048 x 4024",
        },
      },
      {
        key: "houston-2025-03",
        id: "houston-2025-03",
        title: "International Team Pin & Banner Exchange",
        altText: "Team pit banner with custom pins exchanged from teams worldwide",
        category: "Team Culture",
        season: "2024-2025",
        albumId: "world-championship-houston-pit",
        albumTitle: "World Championship Houston Pit",
        date: "2025-04-19",
        dateKind: "Captured",
        location: "Houston Convention Center Pit Area",
        description: "Gracious Professionalism in action: exchanging team swag and technical whitepapers with teams from 18 nations.",
        imageUrl: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=600&q=80",
        tags: ["Team Culture", "Gracious Professionalism", "Pin Exchange"],
        exif: {
          camera: "Nikon Z6 II",
          lens: "NIKKOR Z 24-70mm f/2.8 S",
          focalLength: "28mm",
          aperture: "f/4.0",
          shutterSpeed: "1/200s",
          iso: "ISO 1600",
          dimensions: "6048 x 4024",
        },
      },
    ],
  },
  {
    id: "centerstage-legacy",
    title: "Centerstage Legacy",
    description:
      "Historical build milestones, pixel intake iterations, drone launch calibration, and archive engineering logs from the 2023-2024 season.",
    season: "2023-2024",
    category: "Robot Build",
    coverImageUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80",
    date: "2024-03-22",
    location: "Morgantown Robotics Lab, WV",
    photoCount: 2,
    photos: [
      {
        key: "centerstage-2024-01",
        id: "centerstage-2024-01",
        title: "Centerstage Active Roller Intake CAD",
        altText: "Dual compliant roller intake CAD render with surgical tubing feed",
        category: "Robot Build",
        season: "2023-2024",
        albumId: "centerstage-legacy",
        albumTitle: "Centerstage Legacy",
        date: "2024-01-18",
        dateKind: "Captured",
        location: "Morgantown Lab, WV",
        description: "Generation 3 active pixel pickup intake with torque-limiting clutch and optical sensor detection.",
        imageUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80",
        tags: ["Intake Subsystem", "CAD Model", "Prototyping"],
        exif: {
          camera: "Sony Alpha 7 III",
          lens: "FE 35mm f/1.8",
          focalLength: "35mm",
          aperture: "f/2.8",
          shutterSpeed: "1/160s",
          iso: "ISO 400",
          dimensions: "6000 x 4000",
        },
      },
      {
        key: "centerstage-2024-02",
        id: "centerstage-2024-02",
        title: "Airplane Launcher High-Speed Velocity Calibration",
        altText: "High-speed flash capture of paper drone release mechanism",
        category: "Robot Build",
        season: "2023-2024",
        albumId: "centerstage-legacy",
        albumTitle: "Centerstage Legacy",
        date: "2024-02-10",
        dateKind: "Captured",
        location: "Morgantown Lab, WV",
        description: "High tension elastic drone launcher achieving consistent Landing Zone 1 scoring.",
        imageUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1600&q=85",
        thumbnailUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
        tags: ["Launcher Mechanism", "Calibration", "Endgame Specs"],
        exif: {
          camera: "Sony Alpha 7 III",
          lens: "FE 50mm f/1.8",
          focalLength: "50mm",
          aperture: "f/2.0",
          shutterSpeed: "1/2000s",
          iso: "ISO 3200",
          dimensions: "6000 x 4000",
        },
      },
    ],
  },
];

/**
 * Returns all curated albums.
 */
export function getCuratedAlbums(): GalleryAlbum[] {
  return CURATED_ALBUMS.map((album) => ({
    ...album,
    photos: album.photos.map((photo) => ({
      ...photo,
      tags: sanitizePhotoTags(photo.tags),
      exif: sanitizeExif(photo.exif),
    })),
  }));
}

/**
 * Returns all curated photos flattened into a single list.
 */
export function getCuratedPhotos(): GalleryPhoto[] {
  return getCuratedAlbums().flatMap((album) => album.photos);
}

/**
 * Filter album collections based on season, category, and search query.
 */
export function filterAlbums(
  albums: GalleryAlbum[],
  filters: { season?: string; category?: string; query?: string }
): GalleryAlbum[] {
  const { season, category, query } = filters;
  const q = query?.trim().toLowerCase() || "";

  return albums.filter((album) => {
    if (season && season !== "all" && season !== "All Seasons" && album.season !== season) {
      return false;
    }
    if (category && category !== "all" && category !== "All Categories" && album.category !== category) {
      return false;
    }
    if (q) {
      const matchTitle = album.title.toLowerCase().includes(q);
      const matchDesc = album.description.toLowerCase().includes(q);
      const matchLoc = album.location.toLowerCase().includes(q);
      const matchSeason = album.season.toLowerCase().includes(q);
      const matchCategory = album.category.toLowerCase().includes(q);
      const matchPhotos = album.photos.some(
        (p) =>
          Boolean(p.title && p.title.toLowerCase().includes(q)) ||
          Boolean(p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
      if (!matchTitle && !matchDesc && !matchLoc && !matchSeason && !matchCategory && !matchPhotos) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Filter individual photos based on season, category, albumId, and search query.
 */
export function filterPhotos(
  photos: GalleryPhoto[],
  filters: { season?: string; category?: string; albumId?: string; query?: string }
): GalleryPhoto[] {
  const { season, category, albumId, query } = filters;
  const q = query?.trim().toLowerCase() || "";

  return photos.filter((photo) => {
    if (albumId && photo.albumId !== albumId) {
      return false;
    }
    if (season && season !== "all" && season !== "All Seasons" && photo.season !== season) {
      return false;
    }
    if (category && category !== "all" && category !== "All Categories" && photo.category !== category) {
      return false;
    }
    if (q) {
      const matchTitle = (photo.title || "").toLowerCase().includes(q);
      const matchDesc = (photo.description || "").toLowerCase().includes(q);
      const matchLoc = (photo.location || "").toLowerCase().includes(q);
      const matchAlbum = (photo.albumTitle || "").toLowerCase().includes(q);
      const matchTags = (photo.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchLoc && !matchAlbum && !matchTags) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Groups photos by album ID.
 */
export function groupPhotosByAlbum(photos: GalleryPhoto[]): Map<string, GalleryPhoto[]> {
  const map = new Map<string, GalleryPhoto[]>();
  for (const photo of photos) {
    const albumKey = photo.albumId || "uncategorized-album";
    const list = map.get(albumKey) || [];
    list.push(photo);
    map.set(albumKey, list);
  }
  return map;
}

/**
 * Groups photos by season.
 */
export function groupPhotosBySeason(photos: GalleryPhoto[]): Record<string, GalleryPhoto[]> {
  const record: Record<string, GalleryPhoto[]> = {};
  for (const photo of photos) {
    const seasonKey = photo.season || "2025-2026";
    if (!record[seasonKey]) record[seasonKey] = [];
    record[seasonKey].push(photo);
  }
  return record;
}

/**
 * Extracts all unique seasons available in albums and photos.
 */
export function getAvailableSeasons(albums?: GalleryAlbum[], photos?: GalleryPhoto[]): string[] {
  const seasons = new Set<string>();
  if (albums) {
    albums.forEach((a) => a.season && seasons.add(a.season));
  }
  if (photos) {
    photos.forEach((p) => p.season && seasons.add(p.season));
  }
  for (const s of GALLERY_SEASONS) {
    seasons.add(s);
  }
  return Array.from(seasons);
}

/**
 * Extracts all unique categories available in albums and photos.
 */
export function getAvailableCategories(albums?: GalleryAlbum[], photos?: GalleryPhoto[]): AlbumCategory[] {
  const categories = new Set<AlbumCategory>();
  for (const cat of ALBUM_CATEGORIES) {
    categories.add(cat);
  }
  if (albums) {
    albums.forEach((a) => a.category && categories.add(a.category));
  }
  if (photos) {
    photos.forEach((p) => {
      if (typeof p.category === "string" && (ALBUM_CATEGORIES as readonly string[]).includes(p.category)) {
        categories.add(p.category as AlbumCategory);
      }
    });
  }
  return Array.from(categories);
}

/**
 * Resolves gallery albums and photos, supporting live API feeds and curated presets.
 */
export function resolveGalleryMedia(
  apiPhotos: GalleryPhoto[],
  curatedAlbums: GalleryAlbum[] = CURATED_ALBUMS
): { albums: GalleryAlbum[]; photos: GalleryPhoto[] } {
  if (apiPhotos.length > 0) {
    const albumMap = new Map<string, GalleryAlbum>();
    curatedAlbums.forEach((a) => {
      albumMap.set(a.id, { ...a, photos: [], photoCount: 0 });
    });

    const photosWithDetails: GalleryPhoto[] = apiPhotos.map((photo, index) => {
      const sanitizedTags = sanitizePhotoTags(photo.tags);
      const sanitizedExifData = sanitizeExif(photo.exif);
      return {
        ...photo,
        key: photo.key || photo.id || `published-photo-${index}`,
        tags: sanitizedTags,
        exif: sanitizedExifData,
      };
    });

    photosWithDetails.forEach((photo) => {
      const albumKey = photo.albumId || (typeof photo.category === "string" ? photo.category.toLowerCase().replace(/\s+/g, "-") : "general-archive");
      let album = albumMap.get(albumKey);
      if (!album) {
        album = {
          id: albumKey,
          title: photo.albumTitle || String(photo.category || "General Archive"),
          description: `Archived team media and competition captures for ${photo.category || "ARES 23247"}.`,
          season: photo.season || "2025-2026",
          category: (ALBUM_CATEGORIES.includes(photo.category as AlbumCategory) ? photo.category : "Competitions") as AlbumCategory,
          coverImageUrl: photo.imageUrl || photo.thumbnailUrl || "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80",
          date: photo.date || "2026-03-01",
          location: photo.location || "Morgantown, WV",
          photoCount: 0,
          photos: [],
        };
        albumMap.set(albumKey, album);
      }
      album.photos.push(photo);
      album.photoCount += 1;
      if (!album.coverImageUrl && (photo.imageUrl || photo.thumbnailUrl)) {
        album.coverImageUrl = photo.imageUrl || photo.thumbnailUrl || "";
      }
    });

    const activeAlbums = Array.from(albumMap.values()).filter((a) => a.photos.length > 0);
    return {
      albums: activeAlbums.length > 0 ? activeAlbums : curatedAlbums,
      photos: photosWithDetails,
    };
  }

  return {
    albums: getCuratedAlbums(),
    photos: getCuratedPhotos(),
  };
}

/**
 * Merges public API photos with curated albums seamlessly.
 */
export function mergeApiPhotosWithCurated(
  apiPhotos: GalleryPhoto[],
  curatedAlbums: GalleryAlbum[] = CURATED_ALBUMS
): { albums: GalleryAlbum[]; photos: GalleryPhoto[] } {
  return resolveGalleryMedia(apiPhotos, curatedAlbums);
}

export const GALLERY_ALBUMS = CURATED_ALBUMS;
export const GALLERY_PHOTOS: GalleryPhoto[] = CURATED_ALBUMS.flatMap((a) => a.photos);
export const GALLERY_CATEGORIES = ["All", ...ALBUM_CATEGORIES] as const;
export type GalleryPhotoItem = GalleryPhoto;
