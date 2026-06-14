import type { StorageProvider } from "@logicsim/document";

/**
 * Storage adapters, runtime-detected (plan: one StorageProvider interface
 * in @logicsim/document, thin adapters per shell). All three shells run
 * the SAME bundle; Tauri and Capacitor are detected via the globals they
 * inject (`withGlobalTauri` / Capacitor bridge), so the web build carries
 * no shell-specific npm dependencies.
 */

interface TauriGlobals {
  core: { invoke<T>(cmd: string, args?: unknown): Promise<T> };
}

interface CapacitorGlobals {
  isNativePlatform?: () => boolean;
  Plugins: {
    Filesystem: {
      writeFile(o: { path: string; data: string; directory: string; encoding: string }): Promise<{ uri: string }>;
      readFile(o: { path: string; directory: string; encoding: string }): Promise<{ data: string }>;
    };
    Share?: { share(o: { url: string }): Promise<unknown> };
  };
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobals;
    Capacitor?: CapacitorGlobals;
    showSaveFilePicker?: (o?: unknown) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (o?: unknown) => Promise<FileSystemFileHandle[]>;
  }
}

const userCancelled = (err: unknown): boolean =>
  err instanceof DOMException && err.name === "AbortError";

// Tauri v2 plugin commands via core.invoke — the stable surface exposed
// by `withGlobalTauri` without bundling @tauri-apps/api into the web app.
const tauriProvider = (t: TauriGlobals): StorageProvider => ({
  kind: "tauri",
  async save(suggestedName, data) {
    const path = await t.core.invoke<string | null>("plugin:dialog|save", {
      options: { defaultPath: suggestedName },
    });
    if (!path) return false;
    await t.core.invoke("plugin:fs|write_text_file", { path, contents: data });
    return true;
  },
  async load() {
    const path = await t.core.invoke<string | string[] | null>("plugin:dialog|open", {
      options: { multiple: false },
    });
    if (!path || Array.isArray(path)) return null;
    return t.core.invoke<string>("plugin:fs|read_text_file", { path });
  },
});

const capacitorProvider = (c: CapacitorGlobals): StorageProvider => ({
  kind: "capacitor",
  // V1 iPad flow: a fixed project file in the app's Documents directory,
  // surfaced to other apps via the share sheet. A document picker comes
  // with the registry work in M6.
  async save(suggestedName, data) {
    const { uri } = await c.Plugins.Filesystem.writeFile({
      path: suggestedName, data, directory: "DOCUMENTS", encoding: "utf8",
    });
    await c.Plugins.Share?.share({ url: uri }).catch(() => undefined);
    return true;
  },
  async load() {
    try {
      const { data } = await c.Plugins.Filesystem.readFile({
        path: "circuit.quadstate.json", directory: "DOCUMENTS", encoding: "utf8",
      });
      return data;
    } catch {
      return null; // no saved project yet
    }
  },
});

const webProvider: StorageProvider = {
  kind: "web",
  async save(suggestedName, data) {
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: "QuadState project", accept: { "application/json": [".json"] } }],
        });
        const writable = await (handle as unknown as {
          createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }>;
        }).createWritable();
        await writable.write(data);
        await writable.close();
        return true;
      } catch (err) {
        if (userCancelled(err)) return false;
        throw err;
      }
    }
    // Fallback: download.
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  },
  async load() {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: "QuadState project", accept: { "application/json": [".json"] } }],
        });
        const file = await (handle as unknown as { getFile(): Promise<File> }).getFile();
        return await file.text();
      } catch (err) {
        if (userCancelled(err)) return null;
        throw err;
      }
    }
    // Fallback: hidden file input.
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = async () => {
        const file = input.files?.[0];
        resolve(file ? await file.text() : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
};

export function detectStorage(): StorageProvider {
  if (window.__TAURI__?.core) return tauriProvider(window.__TAURI__);
  if (window.Capacitor?.isNativePlatform?.()) return capacitorProvider(window.Capacitor);
  return webProvider;
}
