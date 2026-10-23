// Reading a detail page needs an explicit per-run budget. A source that configures a date, title
// or summary rule without maxFetches would silently read nothing and leave every entry undated or
// truncated, so the config is refused instead.
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSupportedConfig, unsupportedConfig } from "@aihot/backend/sources/config-keys";

test("detail reading rules require maxFetches", () => {
  for (const detail of [
    { publishedAtSelector: ".time" },
    { publishedAtRegex: "Published Time:\\s*(\\S+)" },
    { publishedAtAuthoritative: true },
    { upgradeDatePrecision: true },
    { titleSelector: "h1" },
    { titleRegex: "<title>([^<]+)" },
    { summarySelector: ".summary" },
  ]) {
    assert.deepEqual(unsupportedConfig("web_list", { detail }), ["detail.maxFetches"], JSON.stringify(detail));
    assert.throws(() => assertSupportedConfig("web_list", { detail }), /detail\.maxFetches/, JSON.stringify(detail));
  }
});

test("a detail budget must be a positive integer", () => {
  for (const maxFetches of [0, -1, 1.5, "12", null]) {
    const detail = { maxFetches, publishedAtSelector: ".time" };
    assert.deepEqual(unsupportedConfig("web_list", { detail }), ["detail.maxFetches"], JSON.stringify(detail));
  }
});

test("a positive integer budget admits detail rules, and preserve alone needs none", () => {
  assert.deepEqual(unsupportedConfig("web_list", { detail: { maxFetches: 12, publishedAtSelector: ".time" } }), []);
  assert.deepEqual(unsupportedConfig("rss", { detail: { maxFetches: 1, titleRegex: "<title>([^<]+)" } }), []);
  assert.deepEqual(unsupportedConfig("web_list", { detail: { maxFetches: 12 } }), []);
  assert.deepEqual(unsupportedConfig("web_list", { detail: { preserve: [{ selector: "figure", as: "pre" }] } }), []);
});
