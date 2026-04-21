// Task 2.2: SelectionToolbar conditional rendering test.
// We use renderToStaticMarkup to exercise the real component (including its
// hook) without pulling in a full jsdom / testing-library stack.
/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(dashboard)/dashboard/results/actions", () => ({
  batchMarkResultsRead: vi.fn(),
  batchHideResults: vi.fn(),
  batchUnhideResults: vi.fn(),
  batchSaveResults: vi.fn(),
  batchUnsaveResults: vi.fn(),
}));

import { SelectionToolbar } from "@/components/dashboard/selection-toolbar";

describe("SelectionToolbar", () => {
  it("renders nothing when no ids are selected", () => {
    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbar, {
        selectedIds: [],
        visibleCount: 10,
        onActionComplete: () => {},
        onClear: () => {},
      })
    );
    expect(html).toBe("");
  });

  it("renders a toolbar with the count when ids are selected", () => {
    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbar, {
        selectedIds: ["r1", "r2"],
        visibleCount: 10,
        onActionComplete: () => {},
        onClear: () => {},
      })
    );
    expect(html).toContain("2 selected");
    expect(html).toContain("Mark read");
    expect(html).toContain("Hide");
    expect(html).not.toContain("Unhide");
  });

  it("shows Unhide button when inHiddenView=true", () => {
    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbar, {
        selectedIds: ["r1"],
        visibleCount: 5,
        inHiddenView: true,
        onActionComplete: () => {},
        onClear: () => {},
      })
    );
    expect(html).toContain("Unhide");
  });

  it("shows Save view button when onSaveView is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbar, {
        selectedIds: ["r1"],
        visibleCount: 5,
        onActionComplete: () => {},
        onClear: () => {},
        onSaveView: () => {},
      })
    );
    expect(html).toContain("Save view");
  });
});
