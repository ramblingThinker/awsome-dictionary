import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const backgroundPath = new URL("../background.js", import.meta.url);
const backgroundSource = await fs.readFile(backgroundPath, "utf8");

function createHarness({ fetchImpl, storageSeed = {}, runtimeOverrides = {} } = {}) {
  const localStore = JSON.parse(JSON.stringify(storageSeed));
  const browser = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener() {} },
      getPlatformInfo: runtimeOverrides.getPlatformInfo,
      sendNativeMessage: runtimeOverrides.sendNativeMessage
    },
    storage: {
      local: {
        async get(key) {
          if (!key) {
            return { ...localStore };
          }
          if (typeof key === "string") {
            return { [key]: localStore[key] };
          }
          const out = {};
          for (const k of key) {
            out[k] = localStore[k];
          }
          return out;
        },
        async set(next) {
          Object.assign(localStore, next);
        }
      },
      onChanged: { addListener() {} }
    },
    contextMenus: {
      async removeAll() {},
      create() {},
      onClicked: { addListener() {} }
    },
    tabs: {
      sendMessage() {}
    }
  };

  const context = vm.createContext({
    browser,
    fetch: fetchImpl || (async () => { throw new Error("fetch not mocked"); }),
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
    console
  });

  vm.runInContext(backgroundSource, context, { filename: "background.js" });
  return { context, localStore };
}

test("getFullDefinition parses API response and returns live source", async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return [
        {
          word: "test",
          phonetic: "tɛst",
          meanings: [
            {
              partOfSpeech: "noun",
              definitions: [
                {
                  definition: "A procedure intended to establish quality.",
                  example: "This is a test run.",
                  synonyms: ["trial"],
                  antonyms: ["certainty"]
                }
              ]
            }
          ]
        }
      ];
    }
  });
  const { context } = createHarness({ fetchImpl });

  const result = await context.getFullDefinition("test");
  assert.equal(result.source, "live");
  assert.match(result.definition, /TEST/);
  assert.match(result.definition, /NOUN/);
  assert.match(result.definition, /Synonyms: trial/);
});

test("getFullDefinition falls back to cached definition when fetch fails", async () => {
  const { context } = createHarness({
    fetchImpl: async () => {
      throw new Error("network down");
    },
    storageSeed: {
      definitionCache: {
        test: {
          definition: "TEST<br>cached definition",
          updatedAt: Date.now() - 120000
        }
      }
    }
  });

  const result = await context.getFullDefinition("test");
  assert.equal(result.source, "cache");
  assert.equal(result.definition, "TEST<br>cached definition");
  assert.ok(result.cacheAgeMinutes >= 1);
});

test("getFullDefinition returns unavailable source when no cache exists and fetch fails", async () => {
  const { context } = createHarness({
    fetchImpl: async () => {
      throw new Error("network down");
    },
    storageSeed: { definitionCache: {} }
  });

  const result = await context.getFullDefinition("absent");
  assert.equal(result.source, "unavailable");
  assert.match(result.definition, /Unable to fetch definition right now\./);
});

test("getFullDefinition uses macOS native host when available", async () => {
  const { context } = createHarness({
    fetchImpl: async () => {
      throw new Error("API should not be used when native lookup succeeds");
    },
    runtimeOverrides: {
      async getPlatformInfo() {
        return { os: "mac" };
      },
      async sendNativeMessage() {
        return {
          ok: true,
          word: "test",
          definition: "A trial or examination."
        };
      }
    }
  });

  const result = await context.getFullDefinition("test");
  assert.equal(result.source, "native");
  assert.match(result.definition, /TEST/);
  assert.match(result.definition, /A trial or examination\./);
});

test("checkNativeHost returns not_macos when platform is not macOS", async () => {
  const { context } = createHarness({
    runtimeOverrides: {
      async getPlatformInfo() {
        return { os: "linux" };
      }
    }
  });

  const result = await context.checkNativeHost();
  assert.equal(result.ok, false);
  assert.equal(result.status, "not_macos");
});

test("checkNativeHost returns connected when native host responds", async () => {
  const { context } = createHarness({
    runtimeOverrides: {
      async getPlatformInfo() {
        return { os: "mac" };
      },
      async sendNativeMessage() {
        return { ok: true };
      }
    }
  });

  const result = await context.checkNativeHost();
  assert.equal(result.ok, true);
  assert.equal(result.status, "connected");
});

test("getFullDefinition formats dense native dictionary text into readable lines", async () => {
  const { context } = createHarness({
    fetchImpl: async () => {
      throw new Error("API should not be used when native lookup succeeds");
    },
    runtimeOverrides: {
      async getPlatformInfo() {
        return { os: "mac" };
      },
      async sendNativeMessage() {
        return {
          ok: true,
          definition: "his | hɪz, ɪz | possessive determiner 1 belonging to a male person. 2 (His) used in titles. PHRASES his and hers. ORIGIN Old English."
        };
      }
    }
  });

  const result = await context.getFullDefinition("his");
  assert.equal(result.source, "native");
  assert.match(result.definition, /^HIS<br>\/hɪz, ɪz\//);
  assert.match(result.definition, /<br>• POSSESSIVE DETERMINER<br>/);
  assert.match(result.definition, /<br>• PHRASES<br>/);
  assert.match(result.definition, /<br>• ORIGIN<br>/);
});
