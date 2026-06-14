import { describe, expect, it } from "vitest";
import { HI, LO } from "@logicsim/engine";
import { PartLibrary } from "../src/library.js";
import { instantiate } from "../src/elaborate.js";
import { dependencyClosure, exportBundle, importBundle, type PartBundle } from "../src/bundle.js";
import { HttpRegistryClient, MemoryRegistry } from "../src/registry.js";
import { halfAdder, fullAdder, rippleAdderPart } from "./parts.js";

function adderLibrary() {
  const lib = new PartLibrary();
  const haId = lib.add(halfAdder());
  const faId = lib.add(fullAdder(haId));
  const addId = lib.add(rippleAdderPart(4, faId));
  return { lib, haId, faId, addId };
}

describe("part bundles", () => {
  it("closure is transitive, deduplicated, dependencies-first", () => {
    const { lib, haId, faId, addId } = adderLibrary();
    expect(dependencyClosure(lib, addId)).toEqual([haId, faId, addId]);
    expect(dependencyClosure(lib, haId)).toEqual([haId]);
  });

  it("export -> import into a fresh library -> still computes", () => {
    const { lib, addId } = adderLibrary();
    const json = exportBundle(lib, addId);

    const lib2 = new PartLibrary();
    const result = importBundle(json, lib2);
    expect(result.main).toBe(addId);
    expect(result.added).toHaveLength(3);
    expect(result.skipped).toBe(0);

    const live = instantiate(lib2, result.main);
    for (let i = 0; i < 4; i++) {
      live.sim.setInput(live.elab.inputs.get(`a${i}`)![0], (5 >> i) & 1 ? HI : LO, 5);
      live.sim.setInput(live.elab.inputs.get(`b${i}`)![0], (9 >> i) & 1 ? HI : LO, 5);
    }
    live.sim.setInput(live.elab.inputs.get("cin")![0], LO, 5);
    live.sim.run(5);
    let sum = 0;
    for (let i = 3; i >= 0; i--) {
      sum = (sum << 1) | live.sim.value(live.elab.outputs.get(`s${i}`)![0]);
    }
    expect(sum).toBe(14 & 0xf);
  });

  it("a display-name override survives export -> import (name is metadata)", () => {
    const { lib, haId } = adderLibrary();
    const json = exportBundle(lib, haId, "My Fancy Adder Bit");
    const result = importBundle(json, new PartLibrary());
    expect(result.mainName).toBe("My Fancy Adder Bit");
    // The hash is unchanged: names live outside the canonical form.
    expect(result.main).toBe(haId);
  });

  it("re-import is a no-op (content-addressed dedupe)", () => {
    const { lib, addId } = adderLibrary();
    const json = exportBundle(lib, addId);
    const lib2 = new PartLibrary();
    importBundle(json, lib2);
    const second = importBundle(json, lib2);
    expect(second.added).toHaveLength(0);
    expect(second.skipped).toBe(3);
  });

  it("rejects tampered, incomplete, and out-of-order bundles", () => {
    const { lib, addId } = adderLibrary();
    const bundle = JSON.parse(exportBundle(lib, addId)) as PartBundle;

    const tampered = structuredClone(bundle);
    tampered.parts[0].def.body.kind === "structural" &&
      (tampered.parts[0].def.body.instances[0].part = "builtin:nand");
    expect(() => importBundle(JSON.stringify(tampered), new PartLibrary()))
      .toThrow(/re-hashed to a different id/);

    const incomplete = structuredClone(bundle);
    incomplete.parts.splice(0, 1); // drop the half adder the rest needs
    expect(() => importBundle(JSON.stringify(incomplete), new PartLibrary()))
      .toThrow(/unknown part/);

    const reordered = structuredClone(bundle);
    reordered.parts.reverse(); // dependents before dependencies
    expect(() => importBundle(JSON.stringify(reordered), new PartLibrary()))
      .toThrow(/unknown part/);
  });
});

describe("registry contract", () => {
  it("publish -> search -> fetch -> import -> simulate (the full sharing loop)", async () => {
    const { lib, addId } = adderLibrary();
    const registry = new MemoryRegistry();

    const pub = await registry.publish(JSON.parse(exportBundle(lib, addId)));
    expect(pub).toEqual({ id: addId, created: true });
    // Idempotent re-publish: the id IS the content.
    expect(await registry.publish(JSON.parse(exportBundle(lib, addId))))
      .toEqual({ id: addId, created: false });

    const hits = await registry.search("adder");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: addId, name: "adder4", version: "1.0.0" });

    const fetched = await registry.fetchBundle(hits[0].id);
    expect(fetched).not.toBeNull();
    const lib2 = new PartLibrary();
    const { main } = importBundle(JSON.stringify(fetched), lib2);
    const live = instantiate(lib2, main);
    live.sim.run(0);
    expect(live.elab.inputs.size).toBe(9); // a0..3, b0..3, cin

    expect(await registry.fetchBundle("sha256:nope")).toBeNull();
  });

  it("registry rejects invalid bundles at publish time (server-side validation)", async () => {
    const { lib, addId } = adderLibrary();
    const bad = JSON.parse(exportBundle(lib, addId)) as PartBundle;
    bad.parts.splice(0, 1);
    await expect(new MemoryRegistry().publish(bad)).rejects.toThrow(/unknown part/);
  });

  it("HTTP client speaks the pinned wire format", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ id: "sha256:x", created: true }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const { lib, haId } = adderLibrary();
    const client = new HttpRegistryClient("https://registry.example", fakeFetch);
    await client.publish(JSON.parse(exportBundle(lib, haId)));
    await client.search("adder", 5);

    expect(calls[0].url).toBe("https://registry.example/v1/parts");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body)).bundleVersion).toBe(1);
    expect(calls[1].url).toBe("https://registry.example/v1/parts?q=adder&limit=5");
  });
});
