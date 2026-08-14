"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SkipLink from "@/components/SkipLink";
import SiteAnnouncementBanner from "@/components/SiteAnnouncementBanner";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const isDashboard = pathname?.startsWith("/dashboard");
  const previousPath = useRef(pathname);
  const [routeAnnouncement, setRouteAnnouncement] = useState("");

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;

    let fallbackTimer = 0;
    let frame = 0;
    let observer: MutationObserver | null = null;
    let settled = false;
    const main = document.getElementById("main-content");
    if (!main) return;

    const announceHeading = () => {
      const heading = main.querySelector<HTMLElement>("h1");
      if (!heading) return false;

      settled = true;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      heading.addEventListener(
        "blur",
        () => heading.removeAttribute("tabindex"),
        { once: true },
      );
      setRouteAnnouncement(`${heading.textContent?.trim() || "Page"} loaded`);
      return true;
    };

    frame = window.requestAnimationFrame(() => {
      if (announceHeading()) return;

      observer = new MutationObserver(() => {
        if (settled || !announceHeading()) return;
        observer?.disconnect();
        window.clearTimeout(fallbackTimer);
      });
      observer.observe(main, { childList: true, subtree: true });

      fallbackTimer = window.setTimeout(() => {
        observer?.disconnect();
        if (settled) return;
        main.focus({ preventScroll: true });
        setRouteAnnouncement("Page loaded");
      }, 2000);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallbackTimer);
      observer?.disconnect();
    };
  }, [pathname]);

  const announcer = (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {routeAnnouncement}
    </div>
  );

  if (isDashboard) {
    return (
      <div className="min-h-screen bg-obsidian text-marble flex flex-col">
        <SkipLink />
        <SiteAnnouncementBanner />
        {announcer}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-grow flex flex-col focus:outline-none"
          style={{ paddingTop: "var(--site-announcement-height, 0px)" }}
        >
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-marble flex flex-col justify-between">
      <SkipLink />
      <SiteAnnouncementBanner />
      {announcer}
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-grow focus:outline-none"
        style={{ paddingTop: "calc(6rem + var(--site-announcement-height, 0px))" }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
