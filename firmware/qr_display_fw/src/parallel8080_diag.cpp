#include <Arduino.h>
#include "soc/gpio_struct.h"

#if defined(QR2BUY_DIRECT8080_QR_DIAG)
#include <qrcode.h>
#endif

#if !defined(QR2BUY_DIRECT8080_TFT_DIAG) && !defined(QR2BUY_DIRECT8080_QR_DIAG)
#error "parallel8080_diag.cpp requires QR2BUY_DIRECT8080_TFT_DIAG or QR2BUY_DIRECT8080_QR_DIAG"
#endif

static const int16_t LCD_WIDTH = 240;
static const int16_t LCD_HEIGHT = 320;

static const int PIN_RST = 4;
static const int PIN_CS = 15;
static const int PIN_DC = 2;
static const int PIN_WR = 21;
static const int PIN_RD = 22;

static const int DATA_PINS[8] = {
  12, 13, 26, 25, 33, 32, 27, 14
};

static uint32_t dataMaskLo = 0;
static uint32_t dataMaskHi = 0;
static uint32_t setMaskLo[256];
static uint32_t setMaskHi[256];

static const uint16_t COLOR_BLACK = 0x0000;
static const uint16_t COLOR_BLUE = 0x001F;
static const uint16_t COLOR_RED = 0xF800;
static const uint16_t COLOR_GREEN = 0x07E0;
static const uint16_t COLOR_CYAN = 0x07FF;
static const uint16_t COLOR_MAGENTA = 0xF81F;
static const uint16_t COLOR_YELLOW = 0xFFE0;
static const uint16_t COLOR_WHITE = 0xFFFF;

static inline void gpioWriteFast(int pin, bool level) {
  if (pin < 0) return;
  if (pin < 32) {
    const uint32_t mask = (1UL << pin);
    if (level) GPIO.out_w1ts = mask;
    else GPIO.out_w1tc = mask;
  } else {
    const uint32_t mask = (1UL << (pin - 32));
    if (level) GPIO.out1_w1ts.val = mask;
    else GPIO.out1_w1tc.val = mask;
  }
}

static void addPinToMask(int pin, uint32_t* lo, uint32_t* hi) {
  if (pin < 32) *lo |= (1UL << pin);
  else *hi |= (1UL << (pin - 32));
}

static void buildMasks() {
  dataMaskLo = 0;
  dataMaskHi = 0;
  for (uint8_t bit = 0; bit < 8; bit++) {
    addPinToMask(DATA_PINS[bit], &dataMaskLo, &dataMaskHi);
  }

  for (uint16_t value = 0; value < 256; value++) {
    setMaskLo[value] = 0;
    setMaskHi[value] = 0;
    for (uint8_t bit = 0; bit < 8; bit++) {
      if (value & (1U << bit)) {
        addPinToMask(DATA_PINS[bit], &setMaskLo[value], &setMaskHi[value]);
      }
    }
  }
}

static inline void write8(uint8_t value) {
  GPIO.out_w1tc = dataMaskLo;
  GPIO.out1_w1tc.val = dataMaskHi;
  GPIO.out_w1ts = setMaskLo[value];
  GPIO.out1_w1ts.val = setMaskHi[value];

  gpioWriteFast(PIN_WR, LOW);
  delayMicroseconds(1);
  gpioWriteFast(PIN_WR, HIGH);
}

static void writeCommand(uint8_t command) {
  gpioWriteFast(PIN_CS, LOW);
  gpioWriteFast(PIN_DC, LOW);
  write8(command);
  gpioWriteFast(PIN_CS, HIGH);
}

static void writeData8(uint8_t data) {
  gpioWriteFast(PIN_CS, LOW);
  gpioWriteFast(PIN_DC, HIGH);
  write8(data);
  gpioWriteFast(PIN_CS, HIGH);
}

static void sendCommand(uint8_t command, const uint8_t* data, uint8_t len) {
  writeCommand(command);
  for (uint8_t i = 0; i < len; i++) {
    writeData8(data[i]);
  }
}

static void initPins() {
  pinMode(PIN_RST, OUTPUT);
  pinMode(PIN_CS, OUTPUT);
  pinMode(PIN_DC, OUTPUT);
  pinMode(PIN_WR, OUTPUT);
  pinMode(PIN_RD, OUTPUT);

  for (uint8_t i = 0; i < 8; i++) {
    pinMode(DATA_PINS[i], OUTPUT);
  }

  gpioWriteFast(PIN_CS, HIGH);
  gpioWriteFast(PIN_DC, HIGH);
  gpioWriteFast(PIN_WR, HIGH);
  gpioWriteFast(PIN_RD, HIGH);
  gpioWriteFast(PIN_RST, HIGH);
}

static void resetDisplay() {
  Serial.println("reset=pulse GPIO4");
  gpioWriteFast(PIN_RST, HIGH);
  delay(20);
  gpioWriteFast(PIN_RST, LOW);
  delay(80);
  gpioWriteFast(PIN_RST, HIGH);
  delay(150);
}

static void initIli9341() {
  Serial.println("ili9341_init=begin");

  writeCommand(0x01);
  delay(150);

  const uint8_t ef[] = { 0x03, 0x80, 0x02 };
  sendCommand(0xEF, ef, sizeof(ef));
  const uint8_t cf[] = { 0x00, 0xC1, 0x30 };
  sendCommand(0xCF, cf, sizeof(cf));
  const uint8_t ed[] = { 0x64, 0x03, 0x12, 0x81 };
  sendCommand(0xED, ed, sizeof(ed));
  const uint8_t e8[] = { 0x85, 0x00, 0x78 };
  sendCommand(0xE8, e8, sizeof(e8));
  const uint8_t cb[] = { 0x39, 0x2C, 0x00, 0x34, 0x02 };
  sendCommand(0xCB, cb, sizeof(cb));
  const uint8_t f7[] = { 0x20 };
  sendCommand(0xF7, f7, sizeof(f7));
  const uint8_t ea[] = { 0x00, 0x00 };
  sendCommand(0xEA, ea, sizeof(ea));
  const uint8_t c0[] = { 0x23 };
  sendCommand(0xC0, c0, sizeof(c0));
  const uint8_t c1[] = { 0x10 };
  sendCommand(0xC1, c1, sizeof(c1));
  const uint8_t c5[] = { 0x3E, 0x28 };
  sendCommand(0xC5, c5, sizeof(c5));
  const uint8_t c7[] = { 0x86 };
  sendCommand(0xC7, c7, sizeof(c7));
  const uint8_t madctl[] = { 0x48 };
  sendCommand(0x36, madctl, sizeof(madctl));
  const uint8_t pixfmt[] = { 0x55 };
  sendCommand(0x3A, pixfmt, sizeof(pixfmt));
  const uint8_t frameRate[] = { 0x00, 0x18 };
  sendCommand(0xB1, frameRate, sizeof(frameRate));
  const uint8_t displayFunction[] = { 0x08, 0x82, 0x27 };
  sendCommand(0xB6, displayFunction, sizeof(displayFunction));
  const uint8_t gammaFunc[] = { 0x00 };
  sendCommand(0xF2, gammaFunc, sizeof(gammaFunc));
  const uint8_t gammaCurve[] = { 0x01 };
  sendCommand(0x26, gammaCurve, sizeof(gammaCurve));
  const uint8_t posGamma[] = {
    0x0F, 0x31, 0x2B, 0x0C, 0x0E, 0x08, 0x4E, 0xF1,
    0x37, 0x07, 0x10, 0x03, 0x0E, 0x09, 0x00
  };
  sendCommand(0xE0, posGamma, sizeof(posGamma));
  const uint8_t negGamma[] = {
    0x00, 0x0E, 0x14, 0x03, 0x11, 0x07, 0x31, 0xC1,
    0x48, 0x08, 0x0F, 0x0C, 0x31, 0x36, 0x0F
  };
  sendCommand(0xE1, negGamma, sizeof(negGamma));

  writeCommand(0x11);
  delay(150);
  writeCommand(0x29);
  delay(150);

  Serial.println("ili9341_init=done");
}

static void setAddrWindow(int16_t x0, int16_t y0, int16_t x1, int16_t y1) {
  writeCommand(0x2A);
  writeData8(x0 >> 8);
  writeData8(x0 & 0xFF);
  writeData8(x1 >> 8);
  writeData8(x1 & 0xFF);

  writeCommand(0x2B);
  writeData8(y0 >> 8);
  writeData8(y0 & 0xFF);
  writeData8(y1 >> 8);
  writeData8(y1 & 0xFF);

  writeCommand(0x2C);
}

static void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  if (w <= 0 || h <= 0) return;
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x >= LCD_WIDTH || y >= LCD_HEIGHT) return;
  if (x + w > LCD_WIDTH) w = LCD_WIDTH - x;
  if (y + h > LCD_HEIGHT) h = LCD_HEIGHT - y;
  if (w <= 0 || h <= 0) return;

  setAddrWindow(x, y, x + w - 1, y + h - 1);

  const uint8_t hi = color >> 8;
  const uint8_t lo = color & 0xFF;
  const uint32_t count = (uint32_t)w * (uint32_t)h;

  gpioWriteFast(PIN_CS, LOW);
  gpioWriteFast(PIN_DC, HIGH);
  for (uint32_t i = 0; i < count; i++) {
    write8(hi);
    write8(lo);
  }
  gpioWriteFast(PIN_CS, HIGH);
}

static void fillScreen(uint16_t color) {
  fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT, color);
}

static void drawColorBars() {
  const uint16_t colors[] = {
    COLOR_RED, COLOR_GREEN, COLOR_BLUE, COLOR_YELLOW, COLOR_CYAN, COLOR_MAGENTA
  };
  const int16_t barW = LCD_WIDTH / 6;
  for (uint8_t i = 0; i < 6; i++) {
    fillRect(i * barW, 0, barW + 1, LCD_HEIGHT, colors[i]);
  }
  fillRect(20, 124, 200, 72, COLOR_BLACK);
  fillRect(32, 136, 48, 48, COLOR_WHITE);
  fillRect(96, 136, 48, 48, COLOR_GREEN);
  fillRect(160, 136, 48, 48, COLOR_WHITE);
}

static void printPins() {
  Serial.println("mode=direct ESP32 8080 parallel, no TFT_eSPI");
  Serial.println("driver=ILI9341");
  Serial.println("TFT_RST=4");
  Serial.println("TFT_CS=15");
  Serial.println("TFT_DC=2");
  Serial.println("TFT_WR=21");
  Serial.println("TFT_RD=22");
  Serial.println("TFT_D0=12");
  Serial.println("TFT_D1=13");
  Serial.println("TFT_D2=26");
  Serial.println("TFT_D3=25");
  Serial.println("TFT_D4=33");
  Serial.println("TFT_D5=32");
  Serial.println("TFT_D6=27");
  Serial.println("TFT_D7=14");
  Serial.println("note=GPIO32/GPIO33 are handled via GPIO.out1 registers");
}

#if defined(QR2BUY_DIRECT8080_QR_DIAG)
static const char* QR_DIAG_URL = "https://qr2buy.com/p/demo";

static void drawQr() {
  Serial.println("draw=DIRECT_QR");
  Serial.print("url=");
  Serial.println(QR_DIAG_URL);

  fillScreen(COLOR_WHITE);

  QRCode qr;
  static uint8_t qrBuffer[400];
  qrcode_initText(&qr, qrBuffer, 4, 0, QR_DIAG_URL);

  Serial.print("qr_size=");
  Serial.println(qr.size);

  int16_t maxW = LCD_WIDTH - 24;
  int16_t maxH = LCD_HEIGHT - 24;
  int16_t scale = maxW / qr.size;
  if ((maxH / qr.size) < scale) scale = maxH / qr.size;
  if (scale < 2) scale = 2;

  const int16_t pixelSize = qr.size * scale;
  const int16_t x0 = (LCD_WIDTH - pixelSize) / 2;
  const int16_t y0 = (LCD_HEIGHT - pixelSize) / 2;

  fillRect(x0 - 6, y0 - 6, pixelSize + 12, pixelSize + 12, COLOR_WHITE);
  for (int16_t y = 0; y < qr.size; y++) {
    for (int16_t x = 0; x < qr.size; x++) {
      if (qrcode_getModule(&qr, x, y)) {
        fillRect(x0 + x * scale, y0 + y * scale, scale, scale, COLOR_BLACK);
      }
    }
  }
}
#endif

void setup() {
  Serial.begin(115200);
  delay(500);

#if defined(QR2BUY_DIRECT8080_QR_DIAG)
  Serial.println("DIRECT8080 QR DIAG START");
#else
  Serial.println("DIRECT8080 TFT DIAG START");
#endif

  printPins();
  buildMasks();
  initPins();
  resetDisplay();
  initIli9341();

#if defined(QR2BUY_DIRECT8080_QR_DIAG)
  drawQr();
#else
  fillScreen(COLOR_BLACK);
#endif
}

void loop() {
#if defined(QR2BUY_DIRECT8080_QR_DIAG)
  delay(1000);
#else
  static uint8_t step = 0;
  static uint32_t lastDrawMs = millis();

  if (millis() - lastDrawMs >= 1800UL) {
    lastDrawMs = millis();
    step = (step + 1) % 6;
    switch (step) {
      case 0:
        Serial.println("draw=BLACK");
        fillScreen(COLOR_BLACK);
        break;
      case 1:
        Serial.println("draw=RED");
        fillScreen(COLOR_RED);
        break;
      case 2:
        Serial.println("draw=GREEN");
        fillScreen(COLOR_GREEN);
        break;
      case 3:
        Serial.println("draw=BLUE");
        fillScreen(COLOR_BLUE);
        break;
      case 4:
        Serial.println("draw=WHITE");
        fillScreen(COLOR_WHITE);
        break;
      default:
        Serial.println("draw=COLOR_BARS");
        drawColorBars();
        break;
    }
  }
#endif
}
