#include <Arduino.h>
#include <TFT_eSPI.h>

#if defined(QR2BUY_QR_DIAG)
#include <qrcode.h>
#endif

#if !defined(QR2BUY_TFT_DIAG) && !defined(QR2BUY_QR_DIAG)
#error "display_diag.cpp requires QR2BUY_TFT_DIAG or QR2BUY_QR_DIAG"
#endif

#define STR_HELPER(x) #x
#define STR(x) STR_HELPER(x)

static TFT_eSPI tft;

static void printSetupName() {
  Serial.print("env=");
#if defined(QR2BUY_ENV_SPI_CS5_RST4)
  Serial.println("esp32dev_spi_cs5_rst4");
#elif defined(QR2BUY_ENV_SPI_NOCS_RST4)
  Serial.println("esp32dev_spi_nocs_rst4");
#elif defined(QR2BUY_ENV_SPI_CS5_NORST)
  Serial.println("esp32dev_spi_cs5_norst");
#elif defined(QR2BUY_ENV_PARALLEL_LEGACY)
  Serial.println("esp32dev_parallel_legacy");
#elif defined(QR2BUY_ENV_PARALLEL_SETUP14)
  Serial.println("esp32dev_parallel_setup14");
#elif defined(QR2BUY_ENV_PARALLEL_LEGACY_DATA_SAFE)
  Serial.println("esp32dev_parallel_legacy_data_safe");
#else
  Serial.println("unknown");
#endif

  Serial.print("setup=");
#if defined(QR2BUY_TFT_SETUP_SPI_CS5_RST4)
  Serial.println("include/tft_setup_spi_cs5_rst4.h");
#elif defined(QR2BUY_TFT_SETUP_SPI_NOCS_RST4)
  Serial.println("include/tft_setup_spi_nocs_rst4.h");
#elif defined(QR2BUY_TFT_SETUP_SPI_CS5_NORST)
  Serial.println("include/tft_setup_spi_cs5_norst.h");
#elif defined(QR2BUY_TFT_SETUP_PARALLEL_LEGACY)
  Serial.println("include/tft_setup_parallel_legacy.h -> lib/TFT_eSPI/User_Setup.h");
#elif defined(QR2BUY_TFT_SETUP_PARALLEL_SETUP14)
  Serial.println("include/tft_setup_parallel_setup14.h");
#elif defined(QR2BUY_TFT_SETUP_PARALLEL_LEGACY_DATA_SAFE)
  Serial.println("include/tft_setup_parallel_legacy_data_safe.h");
#else
  Serial.println("unknown");
#endif
}

static void printTftBuildConfig() {
  Serial.println("QR2BUY TFT BUILD CONFIG");
  printSetupName();

#ifdef QR2BUY_PROJECT_USER_SETUP_SELECT
  Serial.println("User_Setup_Select=project/include/User_Setup_Select.h");
#else
  Serial.println("User_Setup_Select=not project shadow");
#endif

#ifdef USER_SETUP_LOADED
  Serial.println("USER_SETUP_LOADED=yes");
#else
  Serial.println("USER_SETUP_LOADED=no");
#endif
#ifdef ILI9341_DRIVER
  Serial.println("driver=ILI9341");
#else
  Serial.println("driver=unknown");
#endif
#ifdef TFT_PARALLEL_8_BIT
  Serial.println("bus=TFT_PARALLEL_8_BIT");
#else
  Serial.println("bus=SPI");
#endif
#ifdef ESP32_PARALLEL
  Serial.println("ESP32_PARALLEL=yes");
#endif
#ifdef TFT_WIDTH
  Serial.println("TFT_WIDTH=" STR(TFT_WIDTH));
#endif
#ifdef TFT_HEIGHT
  Serial.println("TFT_HEIGHT=" STR(TFT_HEIGHT));
#endif
#ifdef TFT_MISO
  Serial.println("TFT_MISO=" STR(TFT_MISO));
#endif
#ifdef TFT_MOSI
  Serial.println("TFT_MOSI=" STR(TFT_MOSI));
#endif
#ifdef TFT_SCLK
  Serial.println("TFT_SCLK=" STR(TFT_SCLK));
#endif
#ifdef TFT_CS
  Serial.println("TFT_CS=" STR(TFT_CS));
#endif
#ifdef TFT_DC
  Serial.println("TFT_DC=" STR(TFT_DC));
#endif
#ifdef TFT_RST
  Serial.println("TFT_RST=" STR(TFT_RST));
#endif
#ifdef TFT_WR
  Serial.println("TFT_WR=" STR(TFT_WR));
#endif
#ifdef TFT_RD
  Serial.println("TFT_RD=" STR(TFT_RD));
#endif
#ifdef TFT_D0
  Serial.println("TFT_D0=" STR(TFT_D0));
#endif
#ifdef TFT_D1
  Serial.println("TFT_D1=" STR(TFT_D1));
#endif
#ifdef TFT_D2
  Serial.println("TFT_D2=" STR(TFT_D2));
#endif
#ifdef TFT_D3
  Serial.println("TFT_D3=" STR(TFT_D3));
#endif
#ifdef TFT_D4
  Serial.println("TFT_D4=" STR(TFT_D4));
#endif
#ifdef TFT_D5
  Serial.println("TFT_D5=" STR(TFT_D5));
#endif
#ifdef TFT_D6
  Serial.println("TFT_D6=" STR(TFT_D6));
#endif
#ifdef TFT_D7
  Serial.println("TFT_D7=" STR(TFT_D7));
#endif
#ifdef TFT_BL
  Serial.println("TFT_BL=" STR(TFT_BL));
#endif
#ifdef SPI_FREQUENCY
  Serial.println("SPI_FREQUENCY=" STR(SPI_FREQUENCY));
#endif
#ifdef SPI_READ_FREQUENCY
  Serial.println("SPI_READ_FREQUENCY=" STR(SPI_READ_FREQUENCY));
#endif
}

static void enableBacklightIfConfigured() {
#if defined(QR2BUY_BACKLIGHT_PIN)
  pinMode(QR2BUY_BACKLIGHT_PIN, OUTPUT);
  digitalWrite(QR2BUY_BACKLIGHT_PIN, HIGH);
  Serial.println("backlight=QR2BUY_BACKLIGHT_PIN HIGH");
#elif defined(TFT_BL) && (TFT_BL >= 0)
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
  Serial.println("backlight=TFT_BL HIGH");
#else
  Serial.println("backlight=not controlled");
#endif
}

static void pulseResetIfConfigured() {
#if defined(TFT_RST) && (TFT_RST >= 0)
  Serial.println("reset=pulse TFT_RST");
  pinMode(TFT_RST, OUTPUT);
  digitalWrite(TFT_RST, HIGH);
  delay(20);
  digitalWrite(TFT_RST, LOW);
  delay(80);
  digitalWrite(TFT_RST, HIGH);
  delay(150);
#else
  Serial.println("reset=not controlled");
#endif
}

static void drawCenteredLabel(const char* text, int16_t y, uint16_t fg, uint16_t bg, uint8_t font) {
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(fg, bg);
  tft.drawString(text, tft.width() / 2, y, font);
}

static void drawTftDiagStep(uint8_t step) {
  switch (step) {
    case 0:
      Serial.println("draw=BLACK");
      tft.fillScreen(TFT_BLACK);
      break;
    case 1:
      Serial.println("draw=RED");
      tft.fillScreen(TFT_RED);
      break;
    case 2:
      Serial.println("draw=GREEN");
      tft.fillScreen(TFT_GREEN);
      break;
    case 3:
      Serial.println("draw=BLUE");
      tft.fillScreen(TFT_BLUE);
      break;
    case 4:
      Serial.println("draw=WHITE_TEXT");
      tft.fillScreen(TFT_WHITE);
      drawCenteredLabel("QR2BUY TFT OK", tft.height() / 2 - 12, TFT_BLACK, TFT_WHITE, 4);
      drawCenteredLabel("https://qr2buy.com", tft.height() / 2 + 24, TFT_DARKGREY, TFT_WHITE, 2);
      break;
    default:
      Serial.println("draw=COLOR_BARS");
      {
        const uint16_t colors[] = { TFT_RED, TFT_GREEN, TFT_BLUE, TFT_YELLOW, TFT_CYAN, TFT_MAGENTA };
        const int16_t barW = max<int16_t>(1, tft.width() / 6);
        for (uint8_t i = 0; i < 6; i++) {
          tft.fillRect(i * barW, 0, barW + 2, tft.height(), colors[i]);
        }
        tft.fillRect(8, tft.height() / 2 - 22, tft.width() - 16, 44, TFT_BLACK);
        drawCenteredLabel("QR2BUY DISPLAY OK", tft.height() / 2, TFT_WHITE, TFT_BLACK, 2);
      }
      break;
  }
}

#if defined(QR2BUY_QR_DIAG)
static const char* QR_DIAG_URL = "https://qr2buy.com/p/demo";

static void drawQrDiag() {
  Serial.println("draw=QR");
  Serial.print("url=");
  Serial.println(QR_DIAG_URL);

  tft.fillScreen(TFT_WHITE);
  drawCenteredLabel("QR2BUY QR TEST", 24, TFT_BLACK, TFT_WHITE, 2);

  QRCode qr;
  static uint8_t qrBuffer[400];
  qrcode_initText(&qr, qrBuffer, 4, 0, QR_DIAG_URL);

  Serial.print("qr_size=");
  Serial.println(qr.size);

  const int16_t maxW = tft.width() - 24;
  const int16_t maxH = tft.height() - 72;
  int16_t scale = min(maxW / qr.size, maxH / qr.size);
  if (scale < 2) scale = 2;

  const int16_t pixelSize = qr.size * scale;
  const int16_t x0 = (tft.width() - pixelSize) / 2;
  const int16_t y0 = 52 + ((tft.height() - 52 - pixelSize) / 2);

  tft.fillRect(x0 - 8, y0 - 8, pixelSize + 16, pixelSize + 16, TFT_WHITE);
  for (int16_t y = 0; y < qr.size; y++) {
    for (int16_t x = 0; x < qr.size; x++) {
      if (qrcode_getModule(&qr, x, y)) {
        tft.fillRect(x0 + x * scale, y0 + y * scale, scale, scale, TFT_BLACK);
      }
    }
  }
}
#endif

void setup() {
  Serial.begin(115200);
  delay(500);

#if defined(QR2BUY_QR_DIAG)
  Serial.println("QR DIAG START");
#else
  Serial.println("TFT DIAG START");
#endif

  printTftBuildConfig();
  enableBacklightIfConfigured();
  pulseResetIfConfigured();

  Serial.println("tft.init=begin");
  tft.init();
  Serial.println("tft.init=done");
  tft.setRotation(0);
  tft.invertDisplay(false);

  Serial.print("runtime_width=");
  Serial.println(tft.width());
  Serial.print("runtime_height=");
  Serial.println(tft.height());

#if defined(QR2BUY_QR_DIAG)
  drawQrDiag();
#else
  drawTftDiagStep(0);
#endif
}

void loop() {
#if defined(QR2BUY_QR_DIAG)
  delay(1000);
#else
  static uint8_t step = 0;
  static uint32_t lastDrawMs = millis();

  if (millis() - lastDrawMs >= 1500UL) {
    lastDrawMs = millis();
    step = (step + 1) % 6;
    drawTftDiagStep(step);
  }
#endif
}
