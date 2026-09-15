#pragma once
#include <string>
#include <vector>
#include <algorithm>

namespace status_screen {
enum class Kind { Reserved, Sold, Paused, OutOfStock };
struct Copy { const char* title; const char* body; const char* footer; bool price; };
inline Copy copy(Kind kind, bool english) {
  switch (kind) {
    case Kind::Reserved: return english
      ? Copy{"Reserved", "This item is currently reserved.", "Please check again later.", true}
      : Copy{"Reserviert", "Dieser Artikel ist aktuell reserviert.", "Bitte sp\xC3\xA4ter erneut pr\xC3\xBC" "fen.", true};
    case Kind::Sold: return english
      ? Copy{"Sold", "This item is no longer available.", "", true}
      : Copy{"Verkauft", "Dieser Artikel ist nicht mehr verf\xC3\xBCgbar.", "", true};
    case Kind::Paused: return english
      ? Copy{"Offer paused", "This offer is currently unavailable.", "", true}
      : Copy{"Angebot pausiert", "Dieses Angebot ist derzeit nicht verf\xC3\xBCgbar.", "", true};
    default: return english
      ? Copy{"Currently sold out", "This product is currently unavailable.", "Discover our other offers.", false}
      : Copy{"Momentan ausverkauft", "Dieses Produkt ist gerade nicht verf\xC3\xBCgbar.", "Entdecke unsere anderen Angebote.", false};
  }
}
// TFT bitmap fonts are ASCII. Preserve German umlauts with explicit diacritics;
// never pass individual UTF-8 bytes to the font or split a multibyte character.
struct Glyph { char base; bool umlaut; };
inline std::vector<Glyph> glyphs(const std::string& text) {
  std::vector<Glyph> result;
  for (size_t i = 0; i < text.size();) {
    const unsigned char c = text[i++];
    if (c < 128) { result.push_back({c < 32 ? ' ' : char(c), false}); continue; }
    if (c == 0xc3 && i < text.size()) {
      const unsigned char next = text[i++];
      const std::string codes = "\x84\x96\x9c\xa4\xb6\xbc";
      const size_t pos = codes.find(char(next));
      if (pos != std::string::npos) { result.push_back({"AOUaou"[pos], true}); continue; }
      if (next == 0x9f) { result.push_back({'s', false}); result.push_back({'s', false}); continue; }
    } else { while (i < text.size() && (static_cast<unsigned char>(text[i]) & 0xc0) == 0x80) ++i; }
    result.push_back({'?', false});
  }
  return result;
}
struct Line { std::vector<Glyph> glyphs; int width; };
struct Block { int top, height; unsigned char font; std::vector<Line> lines; };
inline int lineHeight(unsigned char font) { return font == 4 ? 26 : font == 2 ? 16 : 8; }
template<class Measure>
std::vector<Line> wrap(const std::vector<Glyph>& input, unsigned char font, int width, Measure measure) {
  std::vector<Line> lines;
  size_t start = 0;
  while (start < input.size()) {
    while (start < input.size() && input[start].base == ' ') ++start;
    if (start == input.size()) break;
    size_t end = start, space = start;
    int used = 0;
    while (end < input.size() && used + measure(input[end].base, font) <= width) {
      used += measure(input[end].base, font);
      if (input[end].base == ' ') space = end;
      ++end;
    }
    if (end < input.size() && space > start) end = space;
    if (end == start) ++end;
    Line line{{}, 0};
    for (size_t i = start; i < end; ++i) { line.glyphs.push_back(input[i]); line.width += measure(input[i].base, font); }
    lines.push_back(line); start = end;
  }
  return lines;
}
template<class Measure>
Block fit(const std::string& text, int top, int height, int width, unsigned char largest, Measure measure) {
  Block block{top, height, 1, {}};
  for (unsigned char font : {4, 2, 1}) {
    if (font > largest) continue;
    block.font = font; block.lines = wrap(glyphs(text), font, width, measure);
    if (int(block.lines.size()) * lineHeight(font) <= height) break;
  }
  return block;
}
inline int left(int screenWidth, const Line& line) { return (screenWidth - line.width) / 2; }
inline int firstY(const Block& block) { return block.top + (block.height - int(block.lines.size()) * lineHeight(block.font)) / 2; }
} // namespace status_screen
