#include "status_screen_layout.h"
#define PROGMEM
#include "../.pio/libdeps/esp32dev_spi_cs5_rst4_merchant_app/TFT_eSPI/Fonts/Font16.c"
#include "../.pio/libdeps/esp32dev_spi_cs5_rst4_merchant_app/TFT_eSPI/Fonts/Font32rle.c"
#undef PROGMEM

inline void testStatusLayout() {
  using namespace status_screen;
  auto measure = [](char c, unsigned char font) -> int {
    return font == 4 ? widtbl_f32[c - 32] : font == 2 ? widtbl_f16[c - 32] : 6;
  };
  auto check = [&](const std::string& text, int top, int height, unsigned char font) {
    const auto block = fit(text, top, height, 288, font, measure);
    assert(firstY(block) >= top);
    assert(firstY(block) + int(block.lines.size()) * lineHeight(block.font) <= top + height);
    std::string rendered, original;
    for (const auto& g : glyphs(text)) if (g.base != ' ') original += g.base;
    for (const auto& line : block.lines) {
      assert(line.width <= 288);
      assert(left(320, line) >= 16);
      assert(std::abs(2 * left(320, line) + line.width - 320) <= 1);
      for (const auto& g : line.glyphs) if (g.base != ' ') rendered += g.base;
    }
    assert(rendered == original); // No truncation, missing words or UTF-8 byte loss.
    return block;
  };
  for (bool en : {false, true}) for (Kind kind : {Kind::Reserved, Kind::Sold, Kind::Paused, Kind::OutOfStock}) {
    const auto c = copy(kind, en);
    assert(check(c.title, 28, 52, 4).font == 4);
    assert(check(c.body, 180, 32, 2).font == 2);
    assert(check(c.footer, 218, 18, 2).font == 2);
    assert(c.price == (kind != Kind::OutOfStock));
  }
  for (const auto& name : {std::string("Tee"), std::string("Testprodukt qr2buy"), std::string("Der Herr der Ringe"),
      std::string("Handgemachte Ledertasche aus feinem Leder"), std::string(256, 'W'),
      std::string("\xC3\x84pfel, \xC3\x96l und s\xC3\xBCsse Gr\xC3\xBCsse")}) check(name, 84, 56, 4);
  assert(check("Tee", 84, 56, 4).font == 4);
  assert(check("Handgemachte Ledertasche", 84, 56, 4).lines.size() == 2);
  for (const auto& price : {"31,90 EUR", "19,90 EUR", "9999999,99 EUR"}) check(price, 146, 28, 4);
  auto umlauts = glyphs("\xC3\x84\xC3\x96\xC3\x9C\xC3\xA4\xC3\xB6\xC3\xBC");
  assert(umlauts.size() == 6);
  for (const auto& glyph : umlauts) assert(glyph.umlaut);
  // Notify layout: full-width heading/name/price, left QR with four-module
  // quiet zone, right CTA/body. Verify real font metrics in both languages.
  for (const auto& name : {std::string("Tee"),std::string("Der Herr der Ringe"),std::string(256,'W')}) check(name,42,48,2);
  check("31,90 EUR",92,16,2);
  for (const auto& text : {"Scanne trotzdem.","Scan anyway.",
      "Wir informieren dich, wenn es wieder frei wird.",
      "Wir informieren dich, sobald es wieder verf\xC3\xBCgbar ist.",
      "We will let you know when it is free again.",
      "We will email you when it is available again."}) {
    const auto b=fit(text,150,80,150,2,measure);
    assert(b.font==2);assert(firstY(b)>=150);
    assert(firstY(b)+int(b.lines.size())*lineHeight(b.font)<=230);
    for(const auto& line:b.lines)assert(line.width<=150);
  }
  // qr2buy merchant URL needs version 4: 33 modules + 8 quiet-zone modules.
  assert((33+8)*3 <= 128); assert(110+(33+8)*3 <= 240);
}
