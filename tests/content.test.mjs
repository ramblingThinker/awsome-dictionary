import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { JSDOM } from "jsdom";

const contentPath = new URL("../content.js", import.meta.url);
const contentSource = await fs.readFile(contentPath, "utf8");

function createHarness() {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    url: "https://example.com",
    runScripts: "outside-only"
  });
  dom.window.browser = {
    runtime: {
      sendMessage() {},
      onMessage: { addListener() {} }
    },
    storage: {
      local: {
        async get() {
          return { settings: {} };
        }
      },
      onChanged: { addListener() {} }
    }
  };
  dom.window.eval(contentSource);
  return dom.window;
}

test("splitDefinitionLines decodes html and strips empty lines", () => {
  const window = createHarness();
  const lines = Array.from(
    window.splitDefinitionLines("WORD<br>&quot;example&quot;<br><br>Synonyms: a, b")
  );

  assert.deepEqual(lines, ["WORD", "\"example\"", "Synonyms: a, b"]);
});

test("buildDefinitionLayout separates part of speech and tags", () => {
  const window = createHarness();
  const fragment = window.buildDefinitionLayout(
    "TEST<br>/tɛst/<br>• NOUN<br>A procedure.<br>\"This is a test.\"<br>Synonyms: trial, check"
  );

  const mount = window.document.createElement("div");
  mount.appendChild(fragment);

  assert.equal(mount.querySelector(".dict-word")?.textContent, "TEST");
  assert.equal(mount.querySelector(".dict-phonetic")?.textContent, "/tɛst/");
  assert.equal(mount.querySelector(".dict-pos")?.textContent, "NOUN");
  assert.equal(mount.querySelector(".dict-example")?.textContent, "\"This is a test.\"");
  assert.equal(mount.querySelectorAll(".dict-tag").length, 2);
});

test("renderBubbleContent shows cache badge when source is cache", () => {
  const window = createHarness();
  const bubble = window.document.createElement("div");

  window.renderBubbleContent(bubble, "WORD<br>/wɜːd/", {
    source: "cache",
    cacheAgeMinutes: 3
  });

  const badge = bubble.querySelector(".dict-badge-cache");
  assert.ok(badge);
  assert.match(badge.textContent, /Offline cache/);
});

test("renderBubbleContent shows API badge when source is live", () => {
  const window = createHarness();
  const bubble = window.document.createElement("div");

  window.renderBubbleContent(bubble, "WORD<br>/wɜːd/", {
    source: "live"
  });

  const badge = bubble.querySelector(".dict-badge-live");
  assert.ok(badge);
  assert.equal(badge.textContent, "API");
});
