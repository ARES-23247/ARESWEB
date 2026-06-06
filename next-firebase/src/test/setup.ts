import "@testing-library/jest-dom";
import { vi } from "vitest";

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
