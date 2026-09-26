import { describe, expect, test } from "bun:test";
import {
  muscleRegions,
  normaliseBodyMap,
  resolveMuscleRegions,
} from "../src/lib/muscle-map";

describe("muscle map", () => {
  test("maps broad and detailed labels to the same visual regions", () => {
    expect([...resolveMuscleRegions(["Arms"])]).toEqual([
      "BICEPS",
      "TRICEPS",
      "FOREARMS",
    ]);
    expect(resolveMuscleRegions(["Pectoralis major"]).has("CHEST")).toBeTrue();
    expect(
      resolveMuscleRegions(["Gluteus medius"]).has("ABDUCTORS"),
    ).toBeTrue();
  });

  test("highlights the complete map for full-body exercises", () => {
    expect(resolveMuscleRegions(["Full body"]).size).toBe(muscleRegions.length);
  });

  test("ignores personal or unknown labels", () => {
    expect(resolveMuscleRegions(["Elbow-friendly"]).size).toBe(0);
  });

  test("uses a safe default for missing or invalid body-map preferences", () => {
    expect(normaliseBodyMap("female")).toBe("female");
    expect(normaliseBodyMap("anything-else")).toBe("male");
    expect(normaliseBodyMap(undefined)).toBe("male");
  });
});
