"""Execute the actual READY title and QR renderers with real TFT font metrics."""
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ReadyRendererTest(unittest.TestCase):
    def test_real_ready_title_bounds_and_qr_decode(self):
        import cv2
        source = (ROOT / 'src/static_app.cpp').read_text(encoding='utf-8')
        title = source[source.index('static void drawReadyProductName'):source.index('static void drawProductScreen')]
        qr = source[source.index('static bool drawQrCode'):source.index('static const char* displayStatus')]
        selector = re.search(r'static uint8_t selectQrVersion\([^;{}]*\)\s*\{[\s\S]*?\n\}', source).group()
        build = ROOT / '.pio/ready-host'
        build.mkdir(parents=True, exist_ok=True)
        lib = ROOT / '.pio/libdeps/esp32dev_spi_cs5_rst4_merchant_app'
        # Font bitmaps/widths and QR encoder are the exact libraries used in the builds.
        scaffold = r'''
#include <cassert>
#include <cstdint>
#include <fstream>
#include <string>
#include <vector>
#include "status_screen_layout.h"
#include "qrcode.h"
#define PROGMEM
#include "Font16.c"
#include "Font32rle.c"
using String = std::string;
static const uint8_t QR_MAX_VERSION = 10;
static const int QR_MAX_BUFFER_BYTES = 512;
static const uint16_t COLOR_PAPER = 0xFFFF, COLOR_PINE_DARK = 0x11A3, COLOR_INK = 0x08C2;
struct Canvas {
  std::vector<uint8_t> pixels = std::vector<uint8_t>(320*240,255);
  int textWidth(const char* text, uint8_t font) {
    int width=0; for (const char* c=text;*c;++c) width+=font==4?widtbl_f32[*c-32]:font==2?widtbl_f16[*c-32]:6;
    return width;
  }
  void fillRect(int x,int y,int w,int h,uint16_t color) {
    assert(x>=0 && y>=0 && x+w<=320 && y+h<=240);
    for(int row=y;row<y+h;++row)for(int col=x;col<x+w;++col)pixels[row*320+col]=color==COLOR_PAPER?255:0;
  }
} tft;
static std::string rendered;
static void drawStatusText(const char* text,int top,int height,uint8_t largest,uint16_t,int left,int width) {
  auto measure=[](char c,uint8_t font){char value[]={c,0};return tft.textWidth(value,font);};
  auto b=status_screen::fit(text,top,height,width,largest,measure);
  assert(status_screen::firstY(b)>=top);
  assert(status_screen::firstY(b)+int(b.lines.size())*status_screen::lineHeight(b.font)<=top+height);
  for(const auto& line:b.lines){assert(line.width<=width);assert(left+line.width<=320);}
  rendered=text;
}
'''
        main = r'''
int main(int argc,char** argv) {
  assert(argc==3);
  for(const auto& name:{std::string("Tee"),std::string("Testprodukt qr2buy"),std::string("Der Herr der Ringe"),
      std::string("Handgemachte Ledertasche aus feinem Leder"),std::string("\xC3\x84pfel und \xC3\x96l")}) {
    drawReadyProductName(name); assert(rendered==name);
  }
  drawReadyProductName(std::string(128,'M'));assert(rendered==std::string(128,'M'));
  const std::string extreme(256,'W');drawReadyProductName(extreme);
  assert(rendered.size()<extreme.size());assert(rendered.substr(rendered.size()-3)=="...");
  // Price is scaled only when it fits the reserved 132px amount area.
  for(const auto& price:{"20,00","29,90","9999999,99","0,00","129,000"}) {
    int font=tft.textWidth(price,4)>132?2:4;
    int scale=tft.textWidth(price,font)*2<=132?2:1;
    assert(tft.textWidth(price,font)*scale<=132);
  }
  for(int i=1;i<3;++i) {
    tft.pixels.assign(320*240,255);
    assert(drawQrCode(argv[i],9,14,140,140));
    std::ofstream file("qr"+std::to_string(i)+".pgm",std::ios::binary);
    file<<"P5\n320 240\n255\n";file.write(reinterpret_cast<char*>(tft.pixels.data()),tft.pixels.size());
  }
}
'''
        cpp = build / 'ready.cpp'
        cpp.write_text(scaffold + selector + qr.replace('url.length()', 'url.size()') + title + main, encoding='utf-8')
        # MSVC lacks C99 variable-length arrays. Preserve their exact lengths
        # with stack allocation in a disposable host copy; encoder logic unchanged.
        encoder = (lib / 'QRCode/src/qrcode.c').read_text(encoding='utf-8')
        arrays = {'alignPosition': 'alignCount', 'result': 'data->capacityBytes',
                  'coeff': 'blockEccLen', 'codewordBytes': 'bb_getBufferSizeBytes(moduleCount)',
                  'isFunctionGridBytes': 'bb_getGridSizeBytes(size)'}
        for name, length in arrays.items():
            declaration = f'uint8_t {name}[{length}];'
            self.assertIn(declaration, encoder)
            encoder = encoder.replace(declaration, f'uint8_t* {name} = (uint8_t*)_alloca({length});')
            encoder = encoder.replace(f'sizeof({name})', f'({length})')
        encoder = '#include <malloc.h>\n' + re.sub(r'\bmax\b', 'qr_host_max', encoder)
        host_encoder = build / 'qrcode_host.c'
        host_encoder.write_text(encoder, encoding='utf-8')
        vcvars = Path('C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat')
        urls = ['https://qr2buy.com/o/1b4f57d6dec9f6b5705de678fe75b847', 'https://qr2buy.com/o/aaf1582034a031684a9f19ad4c8bee0d']
        command = (f'call "{vcvars}" >nul && cl /nologo /EHsc /std:c++14 /I"{ROOT / "include"}" '
                   f'/I"{lib / "QRCode/src"}" /I"{lib / "TFT_eSPI/Fonts"}" "{cpp}" "{host_encoder}" '
                   '/Fe:ready.exe && ready.exe ' + ' '.join(urls))
        script = build / 'run.cmd'
        script.write_text('@echo off\n' + command + '\n', encoding='utf-8')
        try:
            subprocess.run(['cmd.exe', '/d', '/c', script.name], cwd=build, check=True)
        finally:
            script.unlink()
        for index, url in enumerate(urls, 1):
            picture = cv2.imread(str(build / f'qr{index}.pgm'))
            decoded, points, _ = cv2.QRCodeDetector().detectAndDecode(picture)
            self.assertEqual(decoded, url)
            self.assertIsNotNone(points)


if __name__ == '__main__':
    unittest.main()
