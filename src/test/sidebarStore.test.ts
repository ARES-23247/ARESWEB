import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarStore } from "../store/sidebarStore";

describe("useSidebarStore", () => {
  beforeEach(() => {
    useSidebarStore.getState().closeAllSidebars();
    useSidebarStore.getState().setDashboardActiveTab("overview");
    useSidebarStore.getState().setAdminSidebarOpen(true);
    useSidebarStore.getState().setDocsExpandedCategories(new Set());
    useSidebarStore.getState().setDocsAcademyExpandedCategories(new Set());
  });

  it("should initialize with default states", () => {
    const state = useSidebarStore.getState();
    expect(state.dashboardOpen).toBe(false);
    expect(state.dashboardActiveTab).toBe("overview");
    expect(state.docsOpen).toBe(false);
    expect(state.docsExpandedCategories).toBeInstanceOf(Set);
    expect(state.docsExpandedCategories.size).toBe(0);
    expect(state.docsSearchOpen).toBe(false);
    expect(state.docsAcademyOpen).toBe(false);
    expect(state.docsAcademyExpandedCategories).toBeInstanceOf(Set);
    expect(state.docsAcademyExpandedCategories.size).toBe(0);
    expect(state.editorVersionHistoryOpen).toBe(false);
    expect(state.editorChatOpen).toBe(false);
    expect(state.adminSidebarOpen).toBe(true);
  });

  it("should toggle dashboard open state", () => {
    useSidebarStore.getState().toggleDashboard();
    expect(useSidebarStore.getState().dashboardOpen).toBe(true);
    useSidebarStore.getState().toggleDashboard();
    expect(useSidebarStore.getState().dashboardOpen).toBe(false);
  });

  it("should set dashboard active tab", () => {
    useSidebarStore.getState().setDashboardActiveTab("profile");
    expect(useSidebarStore.getState().dashboardActiveTab).toBe("profile");
  });

  it("should toggle docs open state", () => {
    useSidebarStore.getState().toggleDocs();
    expect(useSidebarStore.getState().docsOpen).toBe(true);
    useSidebarStore.getState().toggleDocs();
    expect(useSidebarStore.getState().docsOpen).toBe(false);
  });

  it("should toggle docs category expanded state", () => {
    useSidebarStore.getState().toggleDocsCategory("programming");
    expect(useSidebarStore.getState().docsExpandedCategories.has("programming")).toBe(true);
    useSidebarStore.getState().toggleDocsCategory("programming");
    expect(useSidebarStore.getState().docsExpandedCategories.has("programming")).toBe(false);
  });

  it("should toggle docs academy category expanded state", () => {
    useSidebarStore.getState().toggleDocsAcademyCategory("subteams");
    expect(useSidebarStore.getState().docsAcademyExpandedCategories.has("subteams")).toBe(true);
    useSidebarStore.getState().toggleDocsAcademyCategory("subteams");
    expect(useSidebarStore.getState().docsAcademyExpandedCategories.has("subteams")).toBe(false);
  });

  it("should toggle editor chat and version history", () => {
    useSidebarStore.getState().toggleEditorChat();
    expect(useSidebarStore.getState().editorChatOpen).toBe(true);
    useSidebarStore.getState().toggleEditorVersionHistory();
    expect(useSidebarStore.getState().editorVersionHistoryOpen).toBe(true);
  });

  it("should toggle admin sidebar", () => {
    useSidebarStore.getState().toggleAdminSidebar();
    expect(useSidebarStore.getState().adminSidebarOpen).toBe(false);
  });

  it("should close all sidebars", () => {
    useSidebarStore.getState().setDashboardOpen(true);
    useSidebarStore.getState().setDocsOpen(true);
    useSidebarStore.getState().setDocsAcademyOpen(true);
    useSidebarStore.getState().setEditorChatOpen(true);
    useSidebarStore.getState().setEditorVersionHistoryOpen(true);

    useSidebarStore.getState().closeAllSidebars();

    const state = useSidebarStore.getState();
    expect(state.dashboardOpen).toBe(false);
    expect(state.docsOpen).toBe(false);
    expect(state.docsAcademyOpen).toBe(false);
    expect(state.editorChatOpen).toBe(false);
    expect(state.editorVersionHistoryOpen).toBe(false);
  });
});
