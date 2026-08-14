export type ProductCategory = "all" | "apparel" | "headwear" | "accessories" | "collectibles";

export type ProductSize = "XS" | "S" | "M" | "L" | "XL" | "2XL" | "3XL" | "One Size";

export type MeasurementUnit = "inches" | "cm";

export interface Product {
  id: string;
  name: string;
  category: "apparel" | "headwear" | "accessories" | "collectibles";
  priceCents: number;
  description: string;
  sizes: ProductSize[];
  defaultSize: ProductSize;
  badge?: string;
  details: string[];
  inStock: boolean;
  featured?: boolean;
  image?: string;
}

export interface SizeMeasurement {
  size: ProductSize;
  chestIn: number;
  lengthIn: number;
  sleeveIn: number;
  chestCm: number;
  lengthCm: number;
  sleeveCm: number;
}

export interface CartItem {
  key: string;
  productId: string;
  size: ProductSize;
  quantity: number;
}

export interface PreOrderItemSummary {
  productId: string;
  productName: string;
  size: ProductSize;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface PreOrderSubmissionPayload {
  name: string;
  email: string;
  pickupLocation: string;
  notes?: string;
  items: PreOrderItemSummary[];
  totalCents: number;
  inquiryType: "merch_booster_preorder";
}

export const OFFICIAL_MERCH_CATALOG: readonly Product[] = [
  {
    id: "ares-comp-jersey",
    name: "Official Competition Jersey",
    category: "apparel",
    priceCents: 5500,
    description:
      "Authentic FIRST® Tech Challenge competition jersey worn by Team 23247 during matches. High-performance breathable athletic mesh with sublimated Greek meander trim and sponsor placement.",
    sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    defaultSize: "L",
    badge: "Competition Grade",
    details: [
      "Moisture-wicking athletic poly blend",
      "Sublimated team graphics and meander borders",
      "Reinforced flatlock stitching for pit durability",
      "Official team numbered edition",
    ],
    inStock: true,
    featured: true,
  },
  {
    id: "ares-foil-hoodie",
    name: "Gold Foil Embroidered Hoodie",
    category: "apparel",
    priceCents: 6500,
    description:
      "Heavyweight premium cotton-poly fleece pullover featuring metallic gold foil ARES team crest embroidery, bronze eyelets, and thermal-lined hood.",
    sizes: ["S", "M", "L", "XL", "2XL", "3XL"],
    defaultSize: "L",
    badge: "Winter Classic",
    details: [
      "400 GSM heavyweight cotton-poly fleece",
      "Metallic gold thread team crest embroidery",
      "Double-lined hood with custom bronze eyelets",
      "Generous kangaroo pocket with reinforced seams",
    ],
    inStock: true,
    featured: true,
  },
  {
    id: "ares-pit-cap",
    name: "Team Pit Cap",
    category: "headwear",
    priceCents: 2800,
    description:
      "Structured six-panel pit crew cap featuring raised 3D high-density embroidery, laser-perforated mesh back panels, and adjustable snapback closure.",
    sizes: ["One Size"],
    defaultSize: "One Size",
    badge: "Pit Crew Gear",
    details: [
      "High-density 3D team embroidery",
      "Laser-perforated side & back breathability",
      "Structured crown with pre-curved visor",
      "Adjustable snapback fit for all team members",
    ],
    inStock: true,
    featured: false,
  },
  {
    id: "ares-vinyl-stickers",
    name: "Vinyl Sticker Pack",
    category: "accessories",
    priceCents: 1200,
    description:
      "Heavy-duty UV-laminated die-cut vinyl sticker collection including team crests, Greek meander decals, robot schematics, and sponsor tributes.",
    sizes: ["One Size"],
    defaultSize: "One Size",
    badge: "Fan Favorite",
    details: [
      "5 weather-proof die-cut vinyl stickers",
      "UV and scratch-resistant matte laminate finish",
      "Dishwasher safe for water bottles",
      "Perfect for laptops, toolboxes, and robot bumpers",
    ],
    inStock: true,
    featured: false,
  },
  {
    id: "ares-3d-keychain",
    name: "3D Printed Robot Keychain",
    category: "collectibles",
    priceCents: 1000,
    description:
      "Precision multi-color 3D printed miniature replica of the ARES custom intake and chassis mechanism, printed on team lab printers.",
    sizes: ["One Size"],
    defaultSize: "One Size",
    badge: "Lab Crafted",
    details: [
      "Custom multi-filament PLA+ precision print",
      "Articulating miniature intake arm linkage",
      "Heavy-duty stainless steel split key ring",
      "Proceeds directly support student filament stock",
    ],
    inStock: true,
    featured: false,
  },
] as const;

export const SIZE_GUIDE_CHART: readonly SizeMeasurement[] = [
  { size: "XS", chestIn: 34, lengthIn: 27, sleeveIn: 32.5, chestCm: 86.4, lengthCm: 68.6, sleeveCm: 82.6 },
  { size: "S", chestIn: 38, lengthIn: 28, sleeveIn: 33.5, chestCm: 96.5, lengthCm: 71.1, sleeveCm: 85.1 },
  { size: "M", chestIn: 42, lengthIn: 29, sleeveIn: 34.5, chestCm: 106.7, lengthCm: 73.7, sleeveCm: 87.6 },
  { size: "L", chestIn: 46, lengthIn: 30, sleeveIn: 35.5, chestCm: 116.8, lengthCm: 76.2, sleeveCm: 90.2 },
  { size: "XL", chestIn: 50, lengthIn: 31, sleeveIn: 36.5, chestCm: 127.0, lengthCm: 78.7, sleeveCm: 92.7 },
  { size: "2XL", chestIn: 54, lengthIn: 32, sleeveIn: 37.5, chestCm: 137.2, lengthCm: 81.3, sleeveCm: 95.3 },
  { size: "3XL", chestIn: 58, lengthIn: 33, sleeveIn: 38.5, chestCm: 147.3, lengthCm: 83.8, sleeveCm: 97.8 },
] as const;

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  all: "All Merchandise",
  apparel: "Apparel & Jerseys",
  headwear: "Headwear",
  accessories: "Stickers & Gear",
  collectibles: "Lab 3D Collectibles",
};

export const PICKUP_OPTIONS = [
  { id: "tournament", label: "WV Championship / Tournament Pit Pickup (Free)" },
  { id: "lab", label: "Morgantown Team Robotics Lab Hand-off (Free)" },
  { id: "shipping", label: "USPS Booster Mail Delivery (Inquire for travel fund quote)" },
] as const;

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

export function convertInchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function convertCmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export function getProductById(
  id: string,
  catalog: readonly Product[] = OFFICIAL_MERCH_CATALOG,
): Product | undefined {
  return catalog.find((product) => product.id === id);
}

export function filterCatalog(
  catalog: readonly Product[] = OFFICIAL_MERCH_CATALOG,
  category: ProductCategory = "all",
  searchQuery = "",
): Product[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return catalog.filter((product) => {
    const matchesCategory = category === "all" || product.category === category;
    if (!matchesCategory) return false;

    if (!normalizedQuery) return true;

    const matchesName = product.name.toLowerCase().includes(normalizedQuery);
    const matchesDescription = product.description.toLowerCase().includes(normalizedQuery);
    const matchesBadge = Boolean(product.badge?.toLowerCase().includes(normalizedQuery));
    const matchesDetails = product.details.some((detail) =>
      detail.toLowerCase().includes(normalizedQuery),
    );

    return matchesName || matchesDescription || matchesBadge || matchesDetails;
  });
}

export function createCartItemKey(productId: string, size: ProductSize): string {
  return `${productId}::${size}`;
}

export function calculateCartSubtotal(
  items: readonly CartItem[],
  catalog: readonly Product[] = OFFICIAL_MERCH_CATALOG,
): number {
  return items.reduce((total, item) => {
    const product = getProductById(item.productId, catalog);
    if (!product) return total;
    return total + product.priceCents * item.quantity;
  }, 0);
}

export function calculateTotalItemCount(items: readonly CartItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

export function buildPreOrderPayload(
  formData: {
    name: string;
    email: string;
    pickupLocation: string;
    notes?: string;
  },
  items: readonly CartItem[],
  catalog: readonly Product[] = OFFICIAL_MERCH_CATALOG,
): PreOrderSubmissionPayload {
  const itemSummaries: PreOrderItemSummary[] = [];

  for (const item of items) {
    const product = getProductById(item.productId, catalog);
    if (product && item.quantity > 0) {
      itemSummaries.push({
        productId: product.id,
        productName: product.name,
        size: item.size,
        unitPriceCents: product.priceCents,
        quantity: item.quantity,
        lineTotalCents: product.priceCents * item.quantity,
      });
    }
  }

  const totalCents = itemSummaries.reduce((sum, item) => sum + item.lineTotalCents, 0);

  return {
    name: formData.name.trim(),
    email: formData.email.trim().toLowerCase(),
    pickupLocation: formData.pickupLocation,
    notes: formData.notes?.trim() || undefined,
    items: itemSummaries,
    totalCents,
    inquiryType: "merch_booster_preorder",
  };
}

export function validatePreOrderForm(formData: {
  name: string;
  email: string;
  pickupLocation: string;
  items: readonly CartItem[];
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!formData.name.trim()) {
    errors.name = "Full name is required.";
  } else if (formData.name.trim().length > 120) {
    errors.name = "Name must be 120 characters or fewer.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formData.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!emailPattern.test(formData.email.trim())) {
    errors.email = "Please provide a valid email address.";
  }

  if (!formData.pickupLocation) {
    errors.pickupLocation = "Please select a fulfillment or pickup preference.";
  }

  if (formData.items.length === 0) {
    errors.items = "Your booster pre-order cart is empty. Add at least one merchandise item.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
