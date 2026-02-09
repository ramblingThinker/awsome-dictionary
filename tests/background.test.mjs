import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const backgroundPath = new URL("../background.js", import.meta.url);
const backgroundSource = await fs.readFile(backgroundPath, "utf8");

function createHarness({ fetchImpl, storageSeed = {} } = {}) {
  const localStore = JSON.parse(JSON.stringify(storageSeed));
  const browser = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener() {} }
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
