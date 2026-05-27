#include <Arduino.h>
#include <TFT_eSPI.h>
#include <qrcode.h>

static TFT_eSPI tft;

static const char* APP_TITLE = "qr2buy";
static const char* APP_STATUS = "Produkt verfügbar";
static const char* APP_URL = "https://qr2buy.com/p/demo";
static const char* APP_FOOTER = "Scan zum Öffnen";

static void enableBacklightIfConfigured() {
#if defined(QR2BUY_BACKLIGHT_PIN)
  pinMode(QR2BUY_BACKLIGHT_PIN, OUTPUT);
  digitalWrite(QR2BUY_BACKLIGHT_PIN, HIGH);
#elif defined(TFT_BL) && (TFT_BL >= 0)
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
#endif
}

static void pulseResetIfConfigured() {
#if defined(TFT_RST) && (TFT_RST >= 0)
  pinMode(TFT_RST, OUTPUT);
  digitalWrite(TFT_RST, HIGH);
  delay(20);
  digitalWrite(TFT_RST, LOW);
  delay(80);
  digitalWrite(TFT_RST, HIGH);
  delay(150);
#endif
}

static void drawCentered(const char* text, int16_t y, uint8_t font, uint16_t fg, uint16_t bg) {
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(fg, bg);
  tft.drawString(text, tft.width() / 2, y, font);
}

static void drawQrCode(const char* url) {
  QRCode qr;
  static uint8_t qrBuffer[400];
  qrcode_initText(&qr, qrBuffer, 4, 0, url);

  const int16_t areaTop = 96;
  const int16_t areaBottom = tft.height() - 34;
  const int16_t maxW = tft.width() - 32;
  const int16_t maxH = areaBottom - areaTop - 16;

  int16_t scale = maxW / qr.size;
  const int16_t scaleByHeight = maxH / qr.size;
  if (scaleByHeight < scale) scale = scaleByHeight;
  if (scale < 2) scale = 2;

  const int16_t pixelSize = qr.size * scale;
  const int16_t x0 = (tft.width() - pixelSize) / 2;
  const int16_t y0 = areaTop + ((areaBottom - areaTop - pixelSize) / 2);

  tft.fillRect(x0 - 8, y0 - 8, pixelSize + 16, pixelSize + 16, TFT_WHITE);
  for (int16_t y = 0; y < qr.size; y++) {
    for (int16_t x = 0; x < qr.size; x++) {
      if (qrcode_getModule(&qr, x, y)) {
        tft.fillRect(x0 + x * scale, y0 + y * scale, scale, scale, TFT_BLACK);
      }
    }
  }
}

static void drawAppScreen() {
  tft.fillScreen(TFT_WHITE);
  tft.fillRect(0, 0, tft.width(), 52, TFT_NAVY);

  drawCentered(APP_TITLE, 27, 4, TFT_WHITE, TFT_NAVY);
  drawCentered(APP_STATUS, 74, 2, TFT_DARKGREEN, TFT_WHITE);
  drawQrCode(APP_URL);
  drawCentered(APP_FOOTER, tft.height() - 16, 2, TFT_DARKGREY, TFT_WHITE);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("QR2BUY STATIC APP START");
  Serial.print("url=");
  Serial.println(APP_URL);

  enableBacklightIfConfigured();
  pulseResetIfConfigured();

  tft.init();
  tft.setRotation(0);
  tft.invertDisplay(false);
  drawAppScreen();
}

void loop() {
  delay(1000);
}
