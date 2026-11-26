import { describe, expect, it } from "vitest";
import { buildOrder } from "../src/lib/player";

describe("buildOrder", () => {
  it("returns the natural order when shuffle is off", () => {
    expect(buildOrder(5, false)).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps the current track first when shuffling", () => {
    const order = buildOrder(10, true, 3, 42);
    expect(order[0]).toBe(3);
    expect(order).toHaveLength(10);
    expect(new Set(order).size).toBe(10);
  });

  it("is reproducible for the same seed", () => {
    expect(buildOrder(20, true, 0, 1234)).toEqual(buildOrder(20, true, 0, 1234));
  });

  it("produces a different order for a different seed", () => {
    expect(buildOrder(20, true, 0, 1)).not.toEqual(buildOrder(20, true, 0, 2));
  });
});
