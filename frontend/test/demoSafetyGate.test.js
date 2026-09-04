import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  confirmDemoSafety,
  DEMO_SAFETY_STORAGE_KEY,
  hasDemoSafetyConfirmation,
} from "../src/demoSafetyGate.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("safe demo starts gated and confirmation persists in the current session", () => {
  const sessionStorage = memoryStorage();
  assert.equal(hasDemoSafetyConfirmation(sessionStorage), false);
  assert.equal(confirmDemoSafety(sessionStorage), true);
  assert.equal(hasDemoSafetyConfirmation(sessionStorage), true);
  assert.equal(sessionStorage.getItem(DEMO_SAFETY_STORAGE_KEY), "true");
});

test("safe demo confirmation does not leak into another browser session", () => {
  const currentSession = memoryStorage();
  const nextSession = memoryStorage();
  confirmDemoSafety(currentSession);
  assert.equal(hasDemoSafetyConfirmation(currentSession), true);
  assert.equal(hasDemoSafetyConfirmation(nextSession), false);
});

test("landing page gates session creation behind the explicit confirmation button", async () => {
  const landing = await readFile(new URL("../src/pages/LandingPage.jsx", import.meta.url), "utf8");
  assert.match(landing, /if \(!safetyConfirmed\) return;[\s\S]*restoreOrCreateDemoSession/);
  assert.match(landing, /onClick=\{acknowledgeSafety\}/);
  assert.match(landing, /confirmDemoSafety\(window\.sessionStorage\)/);
  assert.doesNotMatch(landing, /localStorage/);
});

test("landing page contains the complete German and English safety confirmation", async () => {
  const landing = await readFile(new URL("../src/pages/LandingPage.jsx", import.meta.url), "utf8");
  for (const phrase of [
    "Stripe-Testmodus · garantiert keine Abbuchung",
    "keine echte Kreditkarte",
    "niemals echtes Geld abgebucht",
    "keine echte Bestellung ausgelöst",
    "Verstanden – ich starte den sicheren Test",
    "Stripe test mode · guaranteed no charge",
    "not a real credit card",
    "never charge real money",
    "no real order",
    "I understand – start the safe demo",
  ]) assert.ok(landing.includes(phrase), `missing safety confirmation copy: ${phrase}`);
});

test("safety gate and merchant sections keep explicit mobile layouts", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.demo-safety-strip button\s*\{\s*width:\s*100%/);
  assert.match(css, /\.reuse-timeline\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /\.merchant-case-grid, \.how-grid\s*\{\s*grid-template-columns:\s*1fr/);
});

test("hero uses viewport-aware sizing across phone, tablet and desktop breakpoints", async () => {
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(css, /\.landing-hero__grid\s*\{[^}]*min-height:\s*calc\(100svh - 76px\)/);
  assert.match(css, /@media \(min-width: 981px\) and \(max-height: 800px\)/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.landing-hero__grid\s*\{[^}]*min-height:\s*calc\(100svh - 76px\)/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.landing-hero__grid\s*\{[^}]*min-height:\s*calc\(100svh - 68px\)/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.hero-window\s*\{[^}]*min-height:\s*150px/);
  assert.match(css, /@media \(max-width: 350px\)/);
});
