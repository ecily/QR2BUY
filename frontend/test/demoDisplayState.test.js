import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { copyStripeTestCard, prepareStripeRedirect, STRIPE_TEST_CARD } from "../src/demoCheckoutTransition.js";
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
    "In dieser Demo wird garantiert nichts abgebucht und keine echte Bestellung ausgelöst",
    "This demo never creates a real charge or a real order",
    "Stripe bleibt vollständig im Testmodus",
    "Stripe remains fully in test mode",
    "4242 4242 4242 4242",
    "Eine echte E-Mail-Adresse brauchst du nur, wenn du auch die Demo-Bestätigung erhalten möchtest",
    "You only need a real email address if you would also like to receive the demo confirmation",
    "Testkarte kopieren & Stripe öffnen",
    "Copy test card & open Stripe"
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

test("positions the public landing page for merchants in German and English", async () => {
  const landing = await readFile(new URL("../src/pages/LandingPage.jsx", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const phrase of [
    "Verkaufen, auch wenn gerade niemand da ist.",
    "Keep selling, even when no one is there.",
    "Demo des physischen Verkaufsschilds",
    "Demo of the physical sales display",
    "Stripe-Testmodus · garantiert keine Abbuchung",
    "Stripe test mode · guaranteed no charge",
    "Je nach Rahmen kann der Pilot kostenlos oder gefördert umgesetzt werden.",
    "Depending on the framework, the pilot may be delivered free of charge or with funding support.",
    "https://ecily.com/de/start-up",
  ]) assert.ok(landing.includes(phrase), `missing merchant landing copy: ${phrase}`);
  assert.match(landing, /t\.faq\.map/);
  assert.match(html, /<link rel="canonical" href="https:\/\/qr2buy\.com\/"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="description"/);
});

test("copies the Stripe test card and creates checkout only after that user transition", async () => {
  const calls = [];
  const result = await prepareStripeRedirect({
    writeText: async (value) => calls.push(["copy", value]),
    createCheckout: async () => { calls.push(["checkout"]); return { url: "https://checkout.stripe.test" }; }
  });
  assert.equal(result.copied, true);
  assert.equal(result.checkout.url, "https://checkout.stripe.test");
  assert.deepEqual(calls, [["copy", STRIPE_TEST_CARD], ["checkout"]]);
});

test("keeps checkout closed and exposes a manual fallback when clipboard access fails", async () => {
  let checkoutCalls = 0;
  const result = await prepareStripeRedirect({
    writeText: async () => { throw new Error("denied"); },
    createCheckout: async () => { checkoutCalls += 1; return {}; }
  });
  assert.deepEqual(result, { copied: false, checkout: null });
  assert.equal(checkoutCalls, 0);
  assert.equal(await copyStripeTestCard(null), false);

  const page = await readFile(new URL("../src/pages/DemoProductPage.jsx", import.meta.url), "utf8");
  assert.ok(page.includes("Kopieren war nicht möglich. Markiere die Testkarte manuell."));
  assert.ok(page.includes("Copying was not possible. Select the test card manually."));
  assert.match(page, /onClick=\{reserve\}/);
  assert.match(page, /status === 'PAID'/);
  assert.match(page, /status === 'SOLD'/);
  assert.match(page, /status === 'RESERVED'/);
  assert.ok(page.includes("Offizielle Stripe-Testkarte · garantiert keine Abbuchung"));
  assert.ok(page.includes("Official Stripe test card · guaranteed no charge"));
  assert.ok(page.includes("Demo erfolgreich · 0 € abgebucht"));
  assert.ok(page.includes("Demo successful · €0 charged"));
});
