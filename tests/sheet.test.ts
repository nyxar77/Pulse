import { describe, expect, test } from "bun:test";
import { sheetDragProgress, shouldDismissSheet } from "../src/lib/sheet";

describe("mobile sheet gestures", () => {
  test("dismisses after a deliberate downward drag", () => {
    expect(shouldDismissSheet({ distance: 145, velocity: 0.2, sheetHeight: 760 })).toBeTrue();
  });

  test("dismisses a short, fast downward flick", () => {
    expect(shouldDismissSheet({ distance: 58, velocity: 0.7, sheetHeight: 760 })).toBeTrue();
  });

  test("snaps back after a short or upward gesture", () => {
    expect(shouldDismissSheet({ distance: 58, velocity: 0.12, sheetHeight: 760 })).toBeFalse();
    expect(shouldDismissSheet({ distance: -120, velocity: -0.8, sheetHeight: 760 })).toBeFalse();
  });

  test("clamps visual progress to the sheet bounds", () => {
    expect(sheetDragProgress(-20, 800)).toBe(0);
    expect(sheetDragProgress(200, 800)).toBe(0.25);
    expect(sheetDragProgress(900, 800)).toBe(1);
    expect(sheetDragProgress(20, 0)).toBe(0);
  });
});
