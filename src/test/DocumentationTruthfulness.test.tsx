import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CodePlayground from "@/components/docs/CodePlayground";
import ConfigVisualizer from "@/components/docs/ConfigVisualizer";
import ScreenshotGallery from "@/components/docs/ScreenshotGallery";

describe("documentation interactive truthfulness", () => {
  it("labels the code sample as read-only and makes no build or deploy claim", () => {
    render(<CodePlayground />);
    expect(screen.getByText("Read-only example")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "does not compile or deploy code",
    );
    expect(screen.queryByText(/BUILD SUCCESSFUL/i)).not.toBeInTheDocument();
  });

  it("labels the tuning configuration as a disconnected example", () => {
    render(<ConfigVisualizer />);
    expect(screen.getByText("Example ARESLib tuning file")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "not a live robot connection",
    );
    expect(
      screen.queryByRole("button", { name: /deploy/i }),
    ).not.toBeInTheDocument();
  });

  it("uses a truthful empty state instead of fabricated screenshots", () => {
    render(<ScreenshotGallery />);
    expect(screen.getByRole("note")).toHaveTextContent(
      "No verified documentation screenshots",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
