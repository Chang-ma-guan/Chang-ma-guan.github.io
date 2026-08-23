import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds the Chang Ma Guan static app", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /張麻館/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /chatgpt\.site/i);
});
