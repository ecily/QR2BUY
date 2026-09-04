import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("uses one shared qr2buy image-and-word logo across public brand surfaces", async () => {
  const [logo, landing, product] = await Promise.all([
    readText("../src/components/BrandLogo.jsx"),
    readText("../src/pages/LandingPage.jsx"),
    readText("../src/pages/DemoProductPage.jsx"),
  ]);

  assert.match(logo, /landing-logo__mark/);
  assert.match(logo, /<span>qr2buy<\/span>/);
  assert.equal((landing.match(/<BrandLogo\s*\/>/g) || []).length, 4);
  assert.equal((product.match(/<BrandLogo\s*\/>/g) || []).length, 1);
  assert.doesNotMatch(landing, /function Logo/);
});

test("ships the qr2buy image mark in every required favicon size", async () => {
  const [html, svg] = await Promise.all([
    readText("../index.html"),
    readText("../public/favicon.svg"),
  ]);

  for (const asset of ["favicon.svg", "favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png", "apple-touch-icon.png"]) {
    assert.ok(html.includes(`/${asset}`), `missing icon link: ${asset}`);
  }
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /#17251f/);
  assert.doesNotMatch(html, /vite\.svg/);
  assert.doesNotMatch(html, /rel="manifest"/);

  for (const [asset, size] of [["favicon-16x16.png", 16], ["favicon-32x32.png", 32], ["favicon-48x48.png", 48], ["apple-touch-icon.png", 180]]) {
    const dimensions = pngDimensions(await readFile(new URL(`../public/${asset}`, import.meta.url)));
    assert.deepEqual(dimensions, { width: size, height: size });
  }
});

test("keeps localized titles, descriptions and routes consistent", async () => {
  const [html, landing, app] = await Promise.all([
    readText("../index.html"),
    readText("../src/pages/LandingPage.jsx"),
    readText("../src/App.jsx"),
  ]);
  const deTitle = "qr2buy – Scannen. Kaufen. Verkauft.";
  const enTitle = "qr2buy – Scan. Buy. Sold.";
  const deDescription = "qr2buy macht sichtbare Produkte im Schaufenster auch außerhalb der Öffnungszeiten direkt kauf- oder reservierbar – ohne App und ohne Mitarbeiter vor Ort.";
  const enDescription = "qr2buy lets customers buy or reserve visible shop-window products even outside opening hours – no app and no staff member required.";

  assert.ok(html.includes(deTitle));
  assert.ok(landing.includes(deTitle));
  assert.ok(landing.includes(enTitle));
  assert.ok(html.includes(deDescription));
  assert.ok(landing.includes(deDescription));
  assert.ok(landing.includes(enDescription));
  assert.match(html, /property="og:locale" content="de_DE"/);
  assert.match(landing, /meta\[property="og:locale"\]/);
  assert.equal((app.match(/path="\/de"/g) || []).length, 1);
  assert.equal((app.match(/path="\/en"/g) || []).length, 1);
  assert.match(landing, /navigate\(`\/\$\{nextLanguage\}`/);
  assert.doesNotMatch(html, /(?:og:image|twitter:image)/);
});

test("retains the responsive hero viewport contract", async () => {
  const css = await readText("../src/App.css");
  assert.match(css, /\.landing-hero__grid\s*\{[^}]*min-height:\s*calc\(100svh - 76px\)/);
  assert.match(css, /@media \(min-width: 981px\) and \(max-height: 800px\)[\s\S]*min-height:\s*calc\(100svh - 68px\)/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.landing-hero h1\s*\{[^}]*font-size:\s*clamp/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.hero-window\s*\{[^}]*min-height:\s*150px/);
});
