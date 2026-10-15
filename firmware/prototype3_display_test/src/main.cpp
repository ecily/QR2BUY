#include <Arduino.h>
#include <TFT_eSPI.h>

#ifndef ILI9341_DRIVER
#error "Prototype 3 requires the existing ILI9341 SPI setup"
#endif
static_assert(TFT_WIDTH == 240 && TFT_HEIGHT == 320, "Unexpected panel size");
static_assert(TFT_SCLK == 18 && TFT_MOSI == 23 && TFT_CS == 5 &&
              TFT_DC == 15 && TFT_RST == 4 && TFT_BL == -1,
              "Prototype 3 wiring must match the CS5 reference");

static TFT_eSPI tft;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("QR2BUY - PROTOTYP 3: isolated display test");
  Serial.println("ILI9341 SPI: SCK=18 MOSI=23 DC=15 RST=4 CS=5, 4 MHz");
  Serial.println("MISO unwired (reference setup reserves GPIO19); no reads or touch");
  Serial.println("LED unwired; backlight not controlled; no WiFi/backend/credentials");

  tft.init();
  tft.setRotation(1);
  Serial.printf("TFT init returned; logical size=%d x %d (not panel acknowledgement)\n",
                tft.width(), tft.height());
  const uint16_t colors[] = {TFT_RED, TFT_GREEN, TFT_BLUE};
  const char* names[] = {"RED", "GREEN", "BLUE"};
  for (unsigned i = 0; i < 3; ++i) {
    Serial.printf("draw=%s\n", names[i]);
    tft.fillScreen(colors[i]);
    delay(2000);
  }

  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextDatum(TL_DATUM);
  // Built-in font 2 has no Unicode en dash. Draw its horizontal stroke explicitly.
  const int leftWidth = tft.textWidth("QR2BUY", 2);
  const int rightWidth = tft.textWidth("PROTOTYP 3", 2);
  const int gap = 24;
  const int x = (tft.width() - leftWidth - gap - rightWidth) / 2;
  const int y = (tft.height() - tft.fontHeight(2)) / 2;
  tft.drawString("QR2BUY", x, y, 2);
  tft.drawFastHLine(x + leftWidth + 7, y + tft.fontHeight(2) / 2, 10, TFT_WHITE);
  tft.drawString("PROTOTYP 3", x + leftWidth + gap, y, 2);
  Serial.println("draw=QR2BUY \xE2\x80\x93 PROTOTYP 3; final screen held");
  Serial.println("SPI writes issued; visual confirmation is still required");
}

void loop() {
  delay(1000);
}
