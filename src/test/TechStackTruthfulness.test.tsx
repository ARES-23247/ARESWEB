import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TechStackPage from "@/app/tech-stack/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => null }));

const appManifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
const functionsManifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "functions/package.json"), "utf8"),
) as { dependencies: Record<string, string>; engines: Record<string, string> };
const functionConfig = readFileSync(
  resolve(process.cwd(), "functions/src/functionConfig.ts"),
  "utf8",
);
const ciWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);

describe("tech stack public claims", () => {
  it("matches the framework and runtime generations in the manifests", () => {
    render(<TechStackPage />);

    expect(appManifest.dependencies.react).toMatch(/^19\./);
    expect(appManifest.dependencies["react-router-dom"]).toMatch(/^\^7\./);
    expect(appManifest.devDependencies.vite).toMatch(/^\^8\./);
    expect(functionsManifest.dependencies.express).toMatch(/^\^5\./);
    expect(functionsManifest.engines.node).toBe("24");
    expect(
      screen.getByText(/React 19, React Router 7, and Vite 8/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Express 5 routers/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Node\.js 24/i)).not.toHaveLength(0);
  });

  it("describes the deployed API isolation and required CI layers", () => {
    render(<TechStackPage />);

    for (const functionName of [
      "publicApi",
      "coreApi",
      "mediaApi",
      "driveApi",
      "communicationsApi",
    ]) {
      expect(functionConfig).toContain(`${functionName}:`);
    }
    expect(ciWorkflow).toContain("pnpm run test:coverage");
    expect(ciWorkflow).toContain("pnpm run test:rules");
    expect(ciWorkflow).toContain("pnpm run test:e2e");
    expect(screen.getByRole("heading", { name: "Isolated Cloud Functions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Layered Automated Testing" })).toBeInTheDocument();
    expect(screen.getByText(/Only a green master workflow can deploy/i)).toBeInTheDocument();
  });

  it("avoids unsupported performance, cost, coverage, and conformance claims", () => {
    const { container } = render(<TechStackPage />);

    expect(container).not.toHaveTextContent(/sub-50ms|zero monthly operating costs/i);
    expect(container).not.toHaveTextContent(/100% Core Function Coverage/i);
    expect(container).not.toHaveTextContent(/collaborative cursors|ARES-Scope desktop/i);
    expect(container).not.toHaveTextContent(/guaranteeing stable deployments/i);
    expect(container).not.toHaveTextContent(/Cost:\s*Free Tier/i);
    expect(screen.getByText(/targets WCAG 2\.2 AA practices/i)).toBeInTheDocument();
    expect(screen.getByText(/Public student profiles expose only a nickname/i)).toBeInTheDocument();
  });
});
