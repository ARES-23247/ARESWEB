import "@testing-library/jest-dom";
import { vi } from "vitest";

process.env.ENCRYPTION_SECRET = "dummy-encryption-secret-must-be-32-chars-long";

// Mock jsdom missing methods
const scrollTo = () => {};
window.scrollTo = scrollTo;

// Mock Firebase client configuration
vi.mock("../lib/firebase", () => {
  return {
    auth: {
      currentUser: null,
      onAuthStateChanged: vi.fn(),
    },
    db: {},
    storage: {},
  };
});
