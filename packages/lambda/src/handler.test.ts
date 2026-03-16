import { describe, it, expect } from "vitest";
import { handler } from "./handler";

describe("handler", () => {
  it("is a function", () => {
    expect(typeof handler).toBe("function");
  });
});
