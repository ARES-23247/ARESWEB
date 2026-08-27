import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BrandPage from "../app/brand/page";

describe("brand and press kit", () => {
  it("references only assets that ship with the site", () => {
    render(<BrandPage />);

    for (const label of [
      "Logo mark (SVG)",
      "Logo mark (WebP, 1024px)",
      "Logo mark (PNG)",
      "Default social card (JPG)",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const links = Array.from(document.querySelectorAll("a[download]")).map(
      (anchor) => anchor.getAttribute("href"),
    );
    expect(links).toEqual(["/favicon.svg", "/favicon.webp", "/favicon.png", "/social-post-default.jpg"]);
  });

  it("publishes the real palette values from the design tokens", () => {
    render(<BrandPage />);

    for (const hex of ["#C00000", "#FFB81C", "#00E5FF", "#CD7F32", "#1A1A1A", "#F9F9F9"]) {
      expect(screen.getByText(hex)).toBeInTheDocument();
    }
  });

  it("keeps boilerplate factual and offers the real contact channel", () => {
    render(<BrandPage />);

    expect(screen.getByText(/FIRST® Tech Challenge robotics team from Morgantown/)).toBeInTheDocument();
    expect(screen.getByText("ares23247wv@gmail.com")).toBeInTheDocument();
  });
});
