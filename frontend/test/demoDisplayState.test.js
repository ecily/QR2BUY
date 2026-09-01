import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { blocksDemoActions, getHardwareDisplayMode } from "../src/demoDisplayState.js";

test("keeps the regular product display for ready and checkout states", () => {
  assert.equal(getHardwareDisplayMode("READY"), "product");
  assert.equal(getHardwareDisplayMode("CHECKOUT_STARTED"), "product");
  assert.equal(getHardwareDisplayMode("CANCELLED"), "product");
});

test("uses dedicated display confirmations only for terminal demo states", () => {
  assert.equal(getHardwareDisplayMode("PAID"), "paid");
  assert.equal(getHardwareDisplayMode("RESERVED"), "reserved");
  assert.equal(getHardwareDisplayMode("SOLD"), "sold");
});

test("removes commerce actions for sold and reserved products", () => {
  assert.equal(blocksDemoActions("SOLD"), true);
  assert.equal(blocksDemoActions("RESERVED"), true);
  assert.equal(blocksDemoActions("PAID"), false);
  assert.equal(blocksDemoActions("READY"), false);
});

test("contains the complete German and English demo safety contract", async () => {
  const source = await readFile(new URL("../src/pages/DemoProductPage.jsx", import.meta.url), "utf8");
  for (const phrase of [
    "Garantiert keine Abbuchung und keine echte Bestellung",
    "Guaranteed no charge and no real order",
    "Stripe-Sandbox",
    "Stripe sandbox",
    "4242 4242 4242 4242",
    "keine erreichbare E-Mail-Adresse ist nicht erforderlich".replace("keine erreichbare ", "Eine echte "),
    "A real email address is not required",
    "Sicheren Testcheckout öffnen",
    "Open secure test checkout"
  ]) assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("keeps accessible live states and reduced-motion protection", async () => {
  const page = await readFile(new URL("../src/pages/DemoProductPage.jsx", import.meta.url), "utf8");
  const landing = await readFile(new URL("../src/pages/LandingPage.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(page, /aria-live="polite"/);
  assert.match(landing, /aria-live="polite"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /hardware-display-confirmation\s*\{\s*animation:\s*none/);
});
