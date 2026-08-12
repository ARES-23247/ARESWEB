import "@testing-library/jest-dom";
import { vi } from "vitest";

process.env.ENCRYPTION_SECRET = "dummy-encryption-secret-must-be-32-chars-long";

// Mock jsdom missing methods
const scrollTo = () => {};
window.scrollTo = scrollTo;

// Mock service-specific Firebase boundaries without pulling SDKs into unit tests.
vi.mock("../lib/firebaseCore", () => ({ app: {} }));
vi.mock("../lib/firebaseAuth", () => ({ auth: { currentUser: null } }));
vi.mock("../lib/firebaseFirestore", () => ({ db: {} }));
vi.mock("../lib/firebaseStorage", () => ({ storage: {} }));
vi.mock("../lib/firebaseAppCheck", () => ({ getAppCheckHeader: vi.fn().mockResolvedValue({}) }));
