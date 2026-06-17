import { describe, expect, it } from "vitest";
import { PartLibrary } from "@logicsim/schema";
import { projectFromJson } from "@logicsim/document";
import { TEMPLATES, templateProjectJson } from "../src/lib/templates.js";

// Templates resolve standard-library parts by exact display name with a silent
// "" fallback (templates.ts / controller.ts). If a library part is renamed, the
// builder would stamp a "" part id and break every affected example + its Home
// thumbnail. These tests are the guard: building + round-tripping each template
// throws if any lib(name) reference fails to resolve to a real part.
describe("templates", () => {
  for (const t of TEMPLATES) {
    it(`"${t.label}" builds with every part resolving`, () => {
      // templateProjectJson throws (via projectToJson) if any part id is "" / unknown.
      const json = templateProjectJson(t.id);
      // round-trip into a fresh library re-validates the full part closure.
      expect(() => projectFromJson(json, new PartLibrary())).not.toThrow();
      const doc = JSON.parse(json).document as { components: unknown[] };
      expect(doc.components.length).toBeGreaterThan(0);
    });
  }
});
