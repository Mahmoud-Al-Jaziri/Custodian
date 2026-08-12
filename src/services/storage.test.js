// Guards the contract between services/storage.js and storage.rules.
//
// These two files have to agree on exactly what an attachment may be named,
// and they're in different languages, deployed by different means (one ships
// in the bundle, the other is published from the Firebase console). Nothing
// but this test connects them, and drift is expensive in both directions: too
// strict silently rejects real uploads, too loose reopens the unbounded-upload
// hole the filename pattern exists to close.
//
// Both files are read as TEXT rather than imported. storage.js pulls in the
// Firebase SDK and a browser environment, which a unit test has no business
// booting — and parsing the source is what actually catches someone editing
// one file and forgetting the other.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const rulesSource = readFileSync(
  new URL("../../storage.rules", import.meta.url),
  "utf8"
);
const clientSource = readFileSync(new URL("./storage.js", import.meta.url), "utf8");

// --- pull the filename pattern out of storage.rules ------------------------

function extractRulesPattern() {
  const match = rulesSource.match(/fileName\.matches\(\s*'([^']+)'/);
  if (!match) throw new Error("no fileName.matches() pattern in storage.rules");
  // Rules string literals process escapes, so the '\\d' in the file is a
  // single '\d' by the time the regex engine sees it.
  return new RegExp(match[1].replace(/\\\\/g, "\\"));
}

const pattern = extractRulesPattern();

// --- pull the extension whitelist out of both files ------------------------

function extractClientExtensions() {
  const block = clientSource.match(/const EXT_BY_TYPE = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error("no EXT_BY_TYPE object in storage.js");
  return new Set([...block[1].matchAll(/:\s*"([a-z0-9]+)"/g)].map((m) => m[1]));
}

function extractRulesExtensions() {
  const group = pattern.source.match(/\(([a-z0-9|]+)\)\$/);
  if (!group) throw new Error("no extension group in the rules pattern");
  return new Set(group[1].split("|"));
}

const clientExtensions = extractClientExtensions();
const rulesExtensions = extractRulesExtensions();

describe("attachment filename contract", () => {
  it("accepts every extension the client can actually produce", () => {
    for (const extension of clientExtensions) {
      expect(
        pattern.test(`2026-08-11.${extension}`),
        `rules reject "2026-08-11.${extension}", which storage.js can generate`
      ).toBe(true);
    }
  });

  it("accepts webp, which compression produces regardless of input type", () => {
    // compressImage re-encodes to WebP, so this is the common real filename
    // even when the user picked a JPEG or a HEIC.
    expect(pattern.test("2026-08-11.webp")).toBe(true);
  });

  it("keeps the rules and client extension lists identical", () => {
    // The drift guard. Adding a MIME type to EXT_BY_TYPE without updating
    // storage.rules makes uploads of that type fail in production only.
    expect([...rulesExtensions].sort()).toEqual([...clientExtensions].sort());
  });

  it("rejects arbitrary filenames, which is what bounds the cost", () => {
    // Without the date shape, one account can loop unlimited 10 MB uploads.
    for (const name of [
      "1.jpg",
      "2.jpg",
      "evil.jpg",
      "photo.png",
      "a.webp",
      "",
    ]) {
      expect(pattern.test(name), `should reject "${name}"`).toBe(false);
    }
  });

  it("rejects dates that aren't real dates", () => {
    // Every accepted shape widens the namespace an attacker can loop through.
    for (const name of [
      "2026-99-99.jpg",
      "2026-13-01.jpg",
      "2026-12-32.jpg",
      "2026-00-10.jpg",
      "2026-10-00.jpg",
      "2026-8-5.jpg",
      "1999-08-11.jpg",
    ]) {
      expect(pattern.test(name), `should reject "${name}"`).toBe(false);
    }
  });

  it("accepts real calendar boundaries", () => {
    for (const name of [
      "2026-01-01.jpg",
      "2026-12-31.jpg",
      "2026-02-29.jpg",
      "2099-11-30.pdf",
    ]) {
      expect(pattern.test(name), `should accept "${name}"`).toBe(true);
    }
  });

  it("rejects extensions the picker never offers", () => {
    // SVG is excluded deliberately: it's script-capable when served inline.
    for (const name of [
      "2026-08-11.svg",
      "2026-08-11.exe",
      "2026-08-11.html",
      "2026-08-11.jpg.exe",
    ]) {
      expect(pattern.test(name), `should reject "${name}"`).toBe(false);
    }
  });

  it("mirrors the rules size cap strictly enough", () => {
    // storage.rules requires `size < 10 * 1024 * 1024`, so the client check
    // must reject a file of exactly that size too, or the upload passes the
    // friendly client error and dies on a rules rejection instead.
    expect(clientSource).toMatch(/size >= MAX_BYTES/);
  });
});
