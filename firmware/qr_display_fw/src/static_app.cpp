#include <Arduino.h>
#include <HTTPClient.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <qrcode.h>
#include <time.h>

#include "qr2buy_root_ca.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
struct WifiCred {
  const char* ssid;
  const char* pass;
};

static const WifiCred WIFI_LIST[] = {
  { "YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD" }
};

constexpr size_t WIFI_LIST_LEN = sizeof(WIFI_LIST) / sizeof(WifiCred);
#endif

#ifndef QR2BUY_DEVICE_ID
#define QR2BUY_DEVICE_ID "demo-device"
#endif

#ifndef QR2BUY_DEVICE_SECRET
#define QR2BUY_DEVICE_SECRET "YOUR_DEVICE_SECRET"
#endif

static TFT_eSPI tft;

static const char* APP_TITLE = "qr2buy";
static const char* HARDWARE_CONFIG_URL =
  "https://qr2buy.com/api/demo/hardware/config?deviceId=" QR2BUY_DEVICE_ID;
static const uint32_t WIFI_TIMEOUT_PER_NETWORK_MS = 15000UL;
static const uint32_t WIFI_RETRY_INTERVAL_MS = 5000UL;
static const uint32_t CONFIG_POLL_INTERVAL_MS = 3000UL;
static const uint32_t HTTP_CONNECT_TIMEOUT_MS = 5000UL;
static const uint32_t HTTP_TIMEOUT_MS = 7000UL;
static const uint32_t CLOCK_RETRY_INTERVAL_MS = 30000UL;
static const uint32_t LIVE_FRESHNESS_MS = 10000UL;
static const uint32_t LIVE_PULSE_STEP_MS = 300UL;
static const time_t MIN_VALID_UNIX_TIME = 1700000000;
static const size_t MAX_CONFIG_JSON_BYTES = 4096;
static const uint8_t QR_MAX_VERSION = 10;
static const uint16_t QR_MAX_BUFFER_BYTES = 512;

// RGB565 counterparts of the Frontpage display palette.
static const uint16_t COLOR_PAPER = 0xFFFF;       // #fffdf8
static const uint16_t COLOR_WARM = 0xEF5B;        // #efe9dc
static const uint16_t COLOR_INK = 0x08C2;         // #0b1813
static const uint16_t COLOR_MUTED = 0x3207;       // #304239
static const uint16_t COLOR_PINE = 0x1A47;        // #1d4939
static const uint16_t COLOR_PINE_DARK = 0x1184;   // #123127
static const uint16_t COLOR_READY_BG = 0xB6B5;    // #b7d6af
static const uint16_t COLOR_READY_FG = 0x11A3;    // #12361f
static const uint16_t COLOR_CHECKOUT_BG = 0xDF3E; // #dbe7f0
static const uint16_t COLOR_CHECKOUT_FG = 0x3AF0; // #3f5f82
static const uint16_t COLOR_CANCELLED_BG = 0xEF1A;// #e8e1d7
static const uint16_t COLOR_CANCELLED_FG = 0x6B0B;// #6b6258
static const uint16_t COLOR_RESERVED_BG = 0xF6F9; // #f5dfcb
static const uint16_t COLOR_RESERVED_FG = 0xA2E5; // #a65d2f
static const uint16_t COLOR_SOLD_BG = 0xF6DA;     // #f0d8d4
static const uint16_t COLOR_SOLD_FG = 0xA269;     // #a04d49
static const uint16_t COLOR_COPPER = 0xAA85;      // #a9502d
static const uint16_t COLOR_ERROR = COLOR_SOLD_FG;
static const uint16_t COLOR_LIVE_DIM = 0x3347;    // #356b3d
static const uint16_t COLOR_LIVE_MID = 0x5469;    // #548c49
static const uint16_t COLOR_LIVE_BRIGHT = 0x7D6D; // #78ac68

struct ConfigPayload {
  bool bound = false;
  String productKey;
  String text;
  String priceText;
  String status;
  String interactionState;
  String interactionExpiresAt;
  String qr;
  long eventVersion = -1;
  String resetAt;
};

static SemaphoreHandle_t configMutex;
static ConfigPayload pendingConfig;
static bool pendingConfigReady = false;
static bool pendingBackendError = false;
static uint32_t pendingConfigFetchedAt = 0;
static ConfigPayload renderedConfig;
static bool hasRenderedConfig = false;
static bool hasSuccessfulConfigFetch = false;
static uint32_t lastSuccessfulConfigAt = 0;
static bool footerIndicatorVisible = false;
static bool footerIndicatorLive = false;
static uint8_t footerPulseStep = 0xFF;
static bool deviceSecretConfigured = false;
static bool runtimeReady = false;
static String bootstrapScreenKey;

static size_t wifiIndex = 0;
static bool wifiAttemptActive = false;
static bool wifiWasConnected = false;
static uint32_t wifiAttemptStartedAt = 0;
static uint32_t wifiRetryAt = 0;
static uint32_t lastClockRequestAt = 0;

static bool timeReached(uint32_t now, uint32_t target) {
  return static_cast<int32_t>(now - target) >= 0;
}

static bool clockReady();

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

static void drawCenteredAt(const char* text, int16_t x, int16_t y,
                           uint8_t font, uint16_t fg, uint16_t bg) {
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(fg, bg);
  tft.drawString(text, x, y, font);
}

static void drawMessageScreen(const char* line1, const char* line2, uint16_t accent = COLOR_PINE) {
  footerIndicatorVisible = false;
  tft.fillScreen(COLOR_WARM);
  tft.fillRoundRect(14, 14, tft.width() - 28, tft.height() - 28, 10, COLOR_PAPER);
  tft.fillRect(14, 14, 6, tft.height() - 28, accent);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COLOR_PINE_DARK, COLOR_PAPER);
  tft.drawString(APP_TITLE, 34, 30, 4);
  tft.setTextColor(COLOR_COPPER, COLOR_PAPER);
  tft.drawString("PHYSISCHES VERKAUFSSCHILD", 35, 64, 1);
  drawCentered(line1, 122, 4, accent, COLOR_PAPER);
  if (line2 && line2[0] != '\0') drawCentered(line2, 157, 2, COLOR_MUTED, COLOR_PAPER);
  drawCentered("qr2buy.com", 203, 1, COLOR_MUTED, COLOR_PAPER);
}

static void showBootstrapScreen(const char* line1, const char* line2, uint16_t accent = COLOR_PINE) {
  if (hasRenderedConfig) return;
  if (!deviceSecretConfigured && strcmp(line1, "Device Secret fehlt") != 0) return;
  const String key = String(line1) + '|' + line2;
  if (key == bootstrapScreenKey) return;
  bootstrapScreenKey = key;
  drawMessageScreen(line1, line2, accent);
}

static uint8_t selectQrVersion(size_t textLength) {
  // Byte-mode capacities for ECC_LOW, including the mode/length overhead.
  static const uint16_t capacityByVersion[] = { 17, 32, 53, 78, 106, 134, 154, 192, 230, 271 };
  for (uint8_t version = 1; version <= QR_MAX_VERSION; version++) {
    if (textLength <= capacityByVersion[version - 1]) return version;
  }
  return 0;
}

static bool validQrUrl(const String& url) {
  return url.startsWith("https://qr2buy.com/demo/p/")
    && url.indexOf("#session=") > 0
    && selectQrVersion(url.length()) > 0;
}

static bool drawQrCode(const String& url, int16_t areaLeft, int16_t areaTop,
                       int16_t areaWidth, int16_t areaHeight) {
  const uint8_t version = selectQrVersion(url.length());
  if (version == 0 || qrcode_getBufferSize(version) > QR_MAX_BUFFER_BYTES) return false;

  QRCode qr;
  static uint8_t qrBuffer[QR_MAX_BUFFER_BYTES];
  if (qrcode_initText(&qr, qrBuffer, version, ECC_LOW, url.c_str()) != 0) return false;

  const int16_t quietModules = 4;
  int16_t scale = areaWidth / (qr.size + quietModules * 2);
  const int16_t scaleByHeight = areaHeight / (qr.size + quietModules * 2);
  if (scaleByHeight < scale) scale = scaleByHeight;
  if (scale < 2) return false;

  const int16_t pixelSize = qr.size * scale;
  const int16_t quietZone = quietModules * scale;
  const int16_t totalSize = pixelSize + quietZone * 2;
  const int16_t x0 = areaLeft + (areaWidth - totalSize) / 2 + quietZone;
  const int16_t y0 = areaTop + (areaHeight - totalSize) / 2 + quietZone;
  tft.fillRect(x0 - quietZone, y0 - quietZone,
               totalSize, totalSize, COLOR_PAPER);
  for (int16_t y = 0; y < qr.size; y++) {
    for (int16_t x = 0; x < qr.size; x++) {
      if (qrcode_getModule(&qr, x, y)) {
        tft.fillRect(x0 + x * scale, y0 + y * scale, scale, scale, COLOR_PINE_DARK);
      }
    }
  }
  return true;
}

static const char* displayStatus(const String& status) {
  if (status == "READY") return "NOCH ZU HABEN";
  if (status == "CHECKOUT_STARTED") return "CHECKOUT LAEUFT";
  if (status == "CANCELLED") return "ABGEBROCHEN";
  if (status == "RESERVED") return "RESERVIERT";
  if (status == "PAID") return "BEZAHLT";
  if (status == "SOLD") return "VERKAUFT";
  return "UNBEKANNT";
}

static String displayPrice(const String& priceText) {
  String value = priceText;
  value.replace("\xE2\x82\xAC", "EUR");
  return value;
}

static void statusColors(const String& status, uint16_t& fg, uint16_t& bg) {
  if (status == "CHECKOUT_STARTED") {
    fg = COLOR_CHECKOUT_FG;
    bg = COLOR_CHECKOUT_BG;
  } else if (status == "CANCELLED") {
    fg = COLOR_CANCELLED_FG;
    bg = COLOR_CANCELLED_BG;
  } else if (status == "RESERVED") {
    fg = COLOR_RESERVED_FG;
    bg = COLOR_RESERVED_BG;
  } else if (status == "PAID" || status == "SOLD") {
    fg = COLOR_SOLD_FG;
    bg = COLOR_SOLD_BG;
  } else {
    fg = COLOR_READY_FG;
    bg = COLOR_READY_BG;
  }
}

static void drawStatusPill(const String& status, int16_t x, int16_t y) {
  uint16_t fg;
  uint16_t bg;
  statusColors(status, fg, bg);
  const char* label = displayStatus(status);
  const int16_t width = tft.textWidth(label, 1) + 29;
  tft.fillRoundRect(x, y, width, 24, 12, bg);
  tft.fillCircle(x + 11, y + 12, 3, fg);
  tft.setTextDatum(ML_DATUM);
  tft.setTextColor(fg, bg);
  tft.drawString(label, x + 20, y + 12, 1);
}

static bool scanInteractionVisible(const ConfigPayload& config) {
  return config.status == "READY" && config.interactionState == "SCANNED";
}

static void drawScanStatus(int16_t x, int16_t y) {
  tft.fillRoundRect(x, y, 150, 28, 8, COLOR_READY_BG);
  drawCenteredAt("SCAN ERKANNT", x + 75, y + 14, 2, COLOR_READY_FG, COLOR_READY_BG);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COLOR_PINE_DARK, COLOR_WARM);
  tft.drawString("Bitte am Smartphone", x, y + 39, 1);
  tft.drawString("fortfahren", x, y + 56, 2);
}

static void drawWrappedProductName(const String& text, int16_t x, int16_t y,
                                   int16_t maxWidth, uint16_t background) {
  String firstLine = text;
  String secondLine;
  while (firstLine.length() > 0 && tft.textWidth(firstLine, 2) > maxWidth) {
    const int split = firstLine.lastIndexOf(' ');
    if (split <= 0) break;
    secondLine = firstLine.substring(split + 1) + (secondLine.isEmpty() ? "" : " " + secondLine);
    firstLine = firstLine.substring(0, split);
  }
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COLOR_INK, background);
  tft.drawString(firstLine, x, y, 2);
  if (!secondLine.isEmpty()) tft.drawString(secondLine, x, y + 20, 2);
}

static bool splitTitleForFont(const String& text, uint8_t font, int16_t maxWidth,
                              String& firstLine, String& secondLine) {
  if (tft.textWidth(text, font) <= maxWidth) {
    firstLine = text;
    secondLine = "";
    return true;
  }

  int bestDifference = 32767;
  int split = text.indexOf(' ');
  while (split > 0) {
    const String left = text.substring(0, split);
    const String right = text.substring(split + 1);
    const int16_t leftWidth = tft.textWidth(left, font);
    const int16_t rightWidth = tft.textWidth(right, font);
    if (leftWidth <= maxWidth && rightWidth <= maxWidth) {
      const int difference = leftWidth > rightWidth
        ? leftWidth - rightWidth
        : rightWidth - leftWidth;
      if (difference < bestDifference) {
        bestDifference = difference;
        firstLine = left;
        secondLine = right;
      }
    }
    split = text.indexOf(' ', split + 1);
  }
  return !firstLine.isEmpty();
}

static void drawProminentProductName(const String& text, int16_t x, int16_t maxWidth) {
  String firstLine;
  String secondLine;
  tft.setTextDatum(TL_DATUM);

  if (splitTitleForFont(text, 4, maxWidth, firstLine, secondLine)) {
    const int16_t y = secondLine.isEmpty() ? 47 : 34;
    tft.setTextColor(COLOR_INK, COLOR_PAPER);
    tft.drawString(firstLine, x, y, 4);
    if (!secondLine.isEmpty()) tft.drawString(secondLine, x, y + 27, 4);
    return;
  }

  firstLine = "";
  secondLine = "";
  splitTitleForFont(text, 2, maxWidth - 1, firstLine, secondLine);
  const int16_t y = secondLine.isEmpty() ? 52 : 42;
  tft.setTextColor(COLOR_INK, COLOR_PAPER);
  tft.drawString(firstLine, x, y, 2);
  if (!secondLine.isEmpty()) tft.drawString(secondLine, x, y + 22, 2);
  tft.setTextColor(COLOR_INK);
  tft.drawString(firstLine, x + 1, y, 2);
  if (!secondLine.isEmpty()) tft.drawString(secondLine, x + 1, y + 22, 2);
}

static bool statusShowsQr(const String& status) {
  return status == "READY" || status == "CHECKOUT_STARTED" || status == "CANCELLED";
}

static bool knownStatus(const String& status) {
  return statusShowsQr(status) || status == "RESERVED" || status == "PAID" || status == "SOLD";
}

static bool connectionIsFresh(uint32_t now) {
  return hasSuccessfulConfigFetch
    && WiFi.status() == WL_CONNECTED
    && clockReady()
    && now - lastSuccessfulConfigAt <= LIVE_FRESHNESS_MS;
}

static uint16_t livePulseColor(uint8_t step) {
  static const uint16_t colors[] = {
    COLOR_LIVE_DIM, COLOR_LIVE_MID, COLOR_LIVE_BRIGHT,
    COLOR_LIVE_BRIGHT, COLOR_LIVE_MID, COLOR_LIVE_DIM
  };
  return colors[step % 6];
}

static void drawFooterPulse(uint16_t color) {
  tft.fillCircle(166, 233, 4, COLOR_WARM);
  tft.fillCircle(166, 233, 3, color);
}

static void drawConnectionFooter(bool live, uint32_t now) {
  tft.fillRect(158, 225, 162, 15, COLOR_WARM);
  tft.setTextDatum(TL_DATUM);
  if (live) {
    footerPulseStep = (now / LIVE_PULSE_STEP_MS) % 6;
    drawFooterPulse(livePulseColor(footerPulseStep));
    tft.setTextColor(COLOR_PINE_DARK, COLOR_WARM);
    tft.drawString("LIVE", 176, 229, 1);
    tft.fillCircle(205, 233, 1, COLOR_PINE);
    tft.drawString("SICHER VERBUNDEN", 212, 229, 1);
  } else {
    footerPulseStep = 0xFF;
    drawFooterPulse(COLOR_MUTED);
    tft.setTextColor(COLOR_MUTED, COLOR_WARM);
    tft.drawString("VERBINDUNG...", 176, 229, 1);
  }
  footerIndicatorLive = live;
}

static void serviceConnectionIndicator() {
  if (!footerIndicatorVisible) return;
  const uint32_t now = millis();
  const bool live = connectionIsFresh(now);
  if (live != footerIndicatorLive) {
    drawConnectionFooter(live, now);
    return;
  }
  if (!live) return;

  const uint8_t pulseStep = (now / LIVE_PULSE_STEP_MS) % 6;
  if (pulseStep == footerPulseStep) return;
  footerPulseStep = pulseStep;
  drawFooterPulse(livePulseColor(pulseStep));
}

static void drawProductScreen(const ConfigPayload& config) {
  static const int16_t QR_PANEL_X = 6;
  static const int16_t QR_PANEL_WIDTH = 146;
  static const int16_t CONTENT_X = 164;

  tft.fillScreen(COLOR_WARM);
  tft.fillRoundRect(QR_PANEL_X, 6, QR_PANEL_WIDTH, 228, 8, COLOR_PAPER);
  tft.drawFastVLine(157, 12, 216, COLOR_MUTED);
  drawQrCode(config.qr, 9, 14, 140, 140);

  drawCenteredAt("Mit dem Handy", 79, 163, 2, COLOR_INK, COLOR_PAPER);
  drawCenteredAt("scannen", 79, 188, 4, COLOR_INK, COLOR_PAPER);
  tft.fillRoundRect(20, 204, 118, 18, 9, COLOR_READY_BG);
  drawCenteredAt("KEINE APP NOETIG", 79, 213, 1, COLOR_READY_FG, COLOR_READY_BG);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COLOR_MUTED, COLOR_WARM);
  tft.drawString("QR2BUY LIVE-DEMO", CONTENT_X, 17, 1);
  tft.fillRoundRect(CONTENT_X - 5, 31, 156, 58, 6, COLOR_PAPER);
  drawProminentProductName(config.text, CONTENT_X + 2, 145);
  tft.setTextColor(COLOR_PINE_DARK, COLOR_WARM);
  tft.drawString(displayPrice(config.priceText), CONTENT_X, 94, 4);
  if (scanInteractionVisible(config)) {
    drawScanStatus(CONTENT_X, 126);
  } else {
    drawStatusPill(config.status, CONTENT_X, 129);
    tft.setTextColor(COLOR_MUTED, COLOR_WARM);
    tft.drawString("Fiktives Demo-Produkt", CONTENT_X, 176, 1);
    tft.drawString("Status live synchronisiert", CONTENT_X, 194, 1);
  }
  tft.fillRect(0, 225, tft.width(), 15, COLOR_WARM);
  tft.setTextColor(COLOR_PINE, COLOR_WARM);
  tft.drawString(APP_TITLE, 8, 229, 1);
  footerIndicatorVisible = true;
  const uint32_t now = millis();
  drawConnectionFooter(connectionIsFresh(now), now);
}

static void drawTerminalScreen(const ConfigPayload& config) {
  footerIndicatorVisible = false;
  uint16_t accent;
  uint16_t statusBackground;
  statusColors(config.status, accent, statusBackground);
  tft.fillScreen(COLOR_WARM);
  tft.fillRoundRect(14, 14, tft.width() - 28, tft.height() - 28, 10, COLOR_PAPER);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COLOR_PINE_DARK, COLOR_PAPER);
  tft.drawString(APP_TITLE, 30, 27, 4);
  tft.setTextColor(COLOR_COPPER, COLOR_PAPER);
  tft.drawString("STATUS LIVE AKTUALISIERT", 30, 62, 1);

  tft.drawCircle(56, 114, 23, accent);
  tft.drawCircle(56, 114, 22, accent);
  if (config.status == "SOLD") {
    tft.drawLine(46, 104, 66, 124, accent);
    tft.drawLine(66, 104, 46, 124, accent);
  } else {
    tft.drawLine(45, 114, 53, 122, accent);
    tft.drawLine(53, 122, 69, 103, accent);
  }

  tft.fillRoundRect(84, 84, 220, 39, 8, statusBackground);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(accent, statusBackground);
  tft.drawString(displayStatus(config.status), 96, 91, 4);
  drawWrappedProductName(config.text, 91, 128, 190, COLOR_PAPER);
  tft.setTextColor(COLOR_MUTED, COLOR_PAPER);
  tft.drawString(displayPrice(config.priceText), 91, 174, 2);
  tft.drawString("Der QR-Code ist jetzt deaktiviert.", 30, 205, 1);
}

static void renderConfig(const ConfigPayload& config) {
  bootstrapScreenKey = "";
  if (!config.bound) {
    drawMessageScreen("Hardware nicht", "gekoppelt");
  } else if (statusShowsQr(config.status)) {
    drawProductScreen(config);
  } else {
    drawTerminalScreen(config);
  }
}

static bool sameVisibleConfig(const ConfigPayload& left, const ConfigPayload& right) {
  return left.bound == right.bound
    && left.productKey == right.productKey
    && left.eventVersion == right.eventVersion
    && left.text == right.text
    && left.priceText == right.priceText
    && left.status == right.status
    && left.interactionState == right.interactionState
    && left.qr == right.qr;
}

static bool hasConfiguredWifi(const WifiCred& wifi) {
  return wifi.ssid && strlen(wifi.ssid) > 0 && strcmp(wifi.ssid, "YOUR_WIFI_SSID") != 0;
}

static bool hasConfiguredDeviceSecret() {
  return strlen(QR2BUY_DEVICE_SECRET) > 0
    && strcmp(QR2BUY_DEVICE_SECRET, "YOUR_DEVICE_SECRET") != 0;
}

static void startNextWifiAttempt(uint32_t now) {
  while (wifiIndex < WIFI_LIST_LEN) {
    const size_t currentIndex = wifiIndex++;
    const WifiCred& wifi = WIFI_LIST[currentIndex];
    if (!hasConfiguredWifi(wifi)) continue;

    Serial.print("WLAN Versuch ");
    Serial.print(currentIndex + 1);
    Serial.print('/');
    Serial.print(WIFI_LIST_LEN);
    Serial.print(": ");
    Serial.println(wifi.ssid);
    WiFi.disconnect();
    WiFi.begin(wifi.ssid, wifi.pass);
    wifiAttemptStartedAt = now;
    wifiAttemptActive = true;
    showBootstrapScreen("Verbinde WLAN...", "Netzwerk wird gesucht");
    return;
  }

  Serial.println("Kein konfiguriertes WLAN erreichbar");
  wifiIndex = 0;
  wifiAttemptActive = false;
  wifiRetryAt = now + WIFI_RETRY_INTERVAL_MS;
  showBootstrapScreen("WLAN Fehler", "Neuer Versuch folgt", COLOR_ERROR);
}

static void serviceWifi() {
  const uint32_t now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      Serial.print("WLAN verbunden: ");
      Serial.println(WiFi.SSID());
      wifiWasConnected = true;
    }
    wifiAttemptActive = false;
    wifiIndex = 0;
    return;
  }

  if (wifiWasConnected) {
    Serial.println("WLAN Verbindung verloren; Reconnect startet");
    wifiWasConnected = false;
    wifiAttemptActive = false;
    wifiIndex = 0;
    wifiRetryAt = now;
  }

  if (wifiAttemptActive) {
    if (now - wifiAttemptStartedAt < WIFI_TIMEOUT_PER_NETWORK_MS) return;
    Serial.print("WLAN Versuch fehlgeschlagen, status=");
    Serial.println(WiFi.status());
    WiFi.disconnect();
    wifiAttemptActive = false;
  }

  if (timeReached(now, wifiRetryAt)) startNextWifiAttempt(now);
}

static bool clockReady() {
  return time(nullptr) >= MIN_VALID_UNIX_TIME;
}

static void serviceClock() {
  if (WiFi.status() != WL_CONNECTED || clockReady()) return;
  const uint32_t now = millis();
  if (lastClockRequestAt == 0 || now - lastClockRequestAt >= CLOCK_RETRY_INTERVAL_MS) {
    Serial.println("Synchronisiere TLS-Uhrzeit");
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    lastClockRequestAt = now;
  }
  showBootstrapScreen("Sichere Verbindung", "Uhrzeit wird geladen");
}

static int jsonValuePosition(const String& json, const char* key) {
  const String needle = String('"') + key + '"';
  int position = json.indexOf(needle);
  if (position < 0) return -1;
  position = json.indexOf(':', position + needle.length());
  if (position < 0) return -1;
  position++;
  while (position < static_cast<int>(json.length())
         && isspace(static_cast<unsigned char>(json[position]))) position++;
  return position;
}

static bool jsonBoolValue(const String& json, const char* key, bool& value) {
  const int position = jsonValuePosition(json, key);
  if (position < 0) return false;
  if (json.substring(position, position + 4) == "true") {
    value = true;
    return true;
  }
  if (json.substring(position, position + 5) == "false") {
    value = false;
    return true;
  }
  return false;
}

static bool jsonStringValue(const String& json, const char* key, String& value, bool allowNull = false) {
  int position = jsonValuePosition(json, key);
  if (position < 0 || position >= static_cast<int>(json.length())) return false;
  if (allowNull && json.substring(position, position + 4) == "null") {
    value = "";
    return true;
  }
  if (json[position] != '"') return false;

  value = "";
  bool escaped = false;
  for (position++; position < static_cast<int>(json.length()); position++) {
    const char current = json[position];
    if (escaped) {
      if (current == 'n') value += '\n';
      else if (current == 'r') value += '\r';
      else if (current == 't') value += '\t';
      else if (current == 'b') value += '\b';
      else if (current == 'f') value += '\f';
      else if (current == '"' || current == '\\' || current == '/') value += current;
      else return false;
      escaped = false;
    } else if (current == '\\') {
      escaped = true;
    } else if (current == '"') {
      return true;
    } else if (static_cast<unsigned char>(current) < 0x20) {
      return false;
    } else {
      value += current;
    }
  }
  return false;
}

static bool jsonLongValue(const String& json, const char* key, long& value) {
  int position = jsonValuePosition(json, key);
  if (position < 0 || position >= static_cast<int>(json.length())) return false;
  const int start = position;
  if (json[position] == '-') position++;
  while (position < static_cast<int>(json.length()) && isdigit(static_cast<unsigned char>(json[position]))) position++;
  if (position == start || (position == start + 1 && json[start] == '-')) return false;
  const char terminator = position < static_cast<int>(json.length()) ? json[position] : '\0';
  if (terminator != '\0' && terminator != ',' && terminator != '}'
      && !isspace(static_cast<unsigned char>(terminator))) return false;
  value = json.substring(start, position).toInt();
  return true;
}

static bool parseConfig(HTTPClient& http, ConfigPayload& config) {
  const int contentLength = http.getSize();
  if (contentLength > static_cast<int>(MAX_CONFIG_JSON_BYTES)) {
    Serial.println("Config JSON zu gross");
    return false;
  }

  const String body = http.getString();
  if (body.isEmpty() || body.length() > MAX_CONFIG_JSON_BYTES) {
    Serial.println("Config JSON leer oder zu gross");
    return false;
  }

  bool ok = false;
  if (!jsonBoolValue(body, "ok", ok) || !ok || !jsonBoolValue(body, "bound", config.bound)) {
    Serial.println("Config Antwort unvollstaendig");
    return false;
  }

  if (!config.bound) return true;
  String responseDeviceId;
  if (!jsonStringValue(body, "deviceId", responseDeviceId) || responseDeviceId != QR2BUY_DEVICE_ID) {
    Serial.println("Config deviceId stimmt nicht ueberein");
    return false;
  }

  if (!jsonStringValue(body, "productKey", config.productKey)
      || !jsonStringValue(body, "text", config.text)
      || !jsonStringValue(body, "priceText", config.priceText)
      || !jsonStringValue(body, "status", config.status)
      || !jsonStringValue(body, "interactionState", config.interactionState, true)
      || !jsonStringValue(body, "interactionExpiresAt", config.interactionExpiresAt, true)
      || !jsonStringValue(body, "qr", config.qr)
      || !jsonLongValue(body, "eventVersion", config.eventVersion)
      || !jsonStringValue(body, "resetAt", config.resetAt, true)
      || config.productKey.isEmpty() || config.text.isEmpty() || config.priceText.isEmpty()
      || config.eventVersion < 0 || !knownStatus(config.status)
      || (!config.interactionState.isEmpty() && config.interactionState != "SCANNED")) {
    Serial.println("Config Felder ungueltig");
    return false;
  }
  if (statusShowsQr(config.status) && !validQrUrl(config.qr)) {
    Serial.println("QR URL ungueltig oder zu lang");
    return false;
  }
  return true;
}

static bool fetchConfig(ConfigPayload& config) {
  WiFiClientSecure client;
  client.setCACert(QR2BUY_ROOT_CA);

  HTTPClient http;
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, HARDWARE_CONFIG_URL)) {
    Serial.println("HTTP Initialisierung fehlgeschlagen");
    return false;
  }
  http.addHeader("x-device-secret", QR2BUY_DEVICE_SECRET);

  const int statusCode = http.GET();
  if (statusCode != HTTP_CODE_OK) {
    Serial.print("Hardware Config HTTP Fehler: ");
    Serial.println(statusCode);
    http.end();
    return false;
  }

  const bool parsed = parseConfig(http, config);
  http.end();
  if (parsed) Serial.println(config.bound ? "Hardware Config aktualisiert" : "Hardware nicht gekoppelt");
  return parsed;
}

static void configPollingTask(void*) {
  TickType_t lastWake = xTaskGetTickCount();
  for (;;) {
    if (hasConfiguredDeviceSecret() && WiFi.status() == WL_CONNECTED && clockReady()) {
      ConfigPayload config;
      const bool fetched = fetchConfig(config);
      if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        if (fetched) {
          pendingConfig = config;
          pendingConfigReady = true;
          pendingBackendError = false;
          pendingConfigFetchedAt = millis();
        } else {
          pendingBackendError = true;
        }
        xSemaphoreGive(configMutex);
      }
    }
    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(CONFIG_POLL_INTERVAL_MS));
  }
}

static void applyPendingConfig() {
  if (xSemaphoreTake(configMutex, 0) != pdTRUE) return;
  const bool showBackendError = pendingBackendError;
  pendingBackendError = false;
  if (!pendingConfigReady) {
    xSemaphoreGive(configMutex);
    if (showBackendError) {
      showBootstrapScreen("Backend temporaer", "nicht erreichbar", COLOR_ERROR);
    }
    return;
  }
  ConfigPayload config = pendingConfig;
  const uint32_t configFetchedAt = pendingConfigFetchedAt;
  pendingConfigReady = false;
  xSemaphoreGive(configMutex);

  lastSuccessfulConfigAt = configFetchedAt;
  hasSuccessfulConfigFetch = true;

  if (hasRenderedConfig && sameVisibleConfig(renderedConfig, config)) return;
  renderConfig(config);
  renderedConfig = config;
  hasRenderedConfig = true;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("QR2BUY DEMO HARDWARE APP START");

  enableBacklightIfConfigured();
  pulseResetIfConfigured();
  tft.init();
  tft.setRotation(1);
  tft.invertDisplay(false);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  deviceSecretConfigured = hasConfiguredDeviceSecret();
  if (deviceSecretConfigured) showBootstrapScreen("Verbinde WLAN...", "");
  else showBootstrapScreen("Device Secret fehlt", "secrets.h pruefen", COLOR_ERROR);

  configMutex = xSemaphoreCreateMutex();
  if (!configMutex) {
    drawMessageScreen("Interner Fehler", "Config Mutex", COLOR_ERROR);
    return;
  }
  if (!deviceSecretConfigured) {
    Serial.println("Device Secret fehlt: QR2BUY_DEVICE_SECRET lokal konfigurieren");
  }

  if (xTaskCreate(configPollingTask, "qr2buy-config", 8192, nullptr, 1, nullptr) != pdPASS) {
    drawMessageScreen("Interner Fehler", "Polling Task", COLOR_ERROR);
    return;
  }
  runtimeReady = true;
}

void loop() {
  if (!runtimeReady) {
    delay(10);
    return;
  }
  serviceWifi();
  serviceClock();
  applyPendingConfig();
  serviceConnectionIndicator();
  delay(10);
}
