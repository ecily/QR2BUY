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
static const time_t MIN_VALID_UNIX_TIME = 1700000000;
static const size_t MAX_CONFIG_JSON_BYTES = 4096;
static const uint8_t QR_MAX_VERSION = 10;
static const uint16_t QR_MAX_BUFFER_BYTES = 512;

struct ConfigPayload {
  bool bound = false;
  String productKey;
  String text;
  String priceText;
  String status;
  String qr;
  long eventVersion = -1;
  String resetAt;
};

static SemaphoreHandle_t configMutex;
static ConfigPayload pendingConfig;
static bool pendingConfigReady = false;
static ConfigPayload renderedConfig;
static bool hasRenderedConfig = false;
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

static void drawMessageScreen(const char* line1, const char* line2, uint16_t accent = TFT_NAVY) {
  tft.fillScreen(TFT_WHITE);
  tft.fillRect(0, 0, tft.width(), 52, accent);
  drawCentered(APP_TITLE, 27, 4, TFT_WHITE, accent);
  drawCentered(line1, 112, 2, accent, TFT_WHITE);
  if (line2 && line2[0] != '\0') drawCentered(line2, 140, 2, TFT_DARKGREY, TFT_WHITE);
}

static void showBootstrapScreen(const char* line1, const char* line2, uint16_t accent = TFT_NAVY) {
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

static bool drawQrCode(const String& url, int16_t areaTop) {
  const uint8_t version = selectQrVersion(url.length());
  if (version == 0 || qrcode_getBufferSize(version) > QR_MAX_BUFFER_BYTES) return false;

  QRCode qr;
  static uint8_t qrBuffer[QR_MAX_BUFFER_BYTES];
  if (qrcode_initText(&qr, qrBuffer, version, ECC_LOW, url.c_str()) != 0) return false;

  const int16_t areaBottom = tft.height() - 32;
  const int16_t quietModules = 4;
  int16_t scale = tft.width() / (qr.size + quietModules * 2);
  const int16_t scaleByHeight = (areaBottom - areaTop) / (qr.size + quietModules * 2);
  if (scaleByHeight < scale) scale = scaleByHeight;
  if (scale < 2) return false;

  const int16_t pixelSize = qr.size * scale;
  const int16_t quietZone = quietModules * scale;
  const int16_t x0 = (tft.width() - pixelSize) / 2;
  const int16_t y0 = areaTop + ((areaBottom - areaTop - pixelSize) / 2);
  tft.fillRect(x0 - quietZone, y0 - quietZone,
               pixelSize + quietZone * 2, pixelSize + quietZone * 2, TFT_WHITE);
  for (int16_t y = 0; y < qr.size; y++) {
    for (int16_t x = 0; x < qr.size; x++) {
      if (qrcode_getModule(&qr, x, y)) {
        tft.fillRect(x0 + x * scale, y0 + y * scale, scale, scale, TFT_BLACK);
      }
    }
  }
  return true;
}

static const char* displayStatus(const String& status) {
  if (status == "READY") return "BEREIT";
  if (status == "CHECKOUT_STARTED") return "CHECKOUT LAEUFT";
  if (status == "CANCELLED") return "ABGEBROCHEN";
  if (status == "RESERVED") return "RESERVIERT";
  if (status == "PAID") return "BEZAHLT";
  if (status == "SOLD") return "VERKAUFT";
  return "UNBEKANNT";
}

static bool statusShowsQr(const String& status) {
  return status == "READY" || status == "CHECKOUT_STARTED" || status == "CANCELLED";
}

static bool knownStatus(const String& status) {
  return statusShowsQr(status) || status == "RESERVED" || status == "PAID" || status == "SOLD";
}

static void drawProductScreen(const ConfigPayload& config) {
  tft.fillScreen(TFT_WHITE);
  tft.fillRect(0, 0, tft.width(), 52, TFT_NAVY);
  drawCentered(APP_TITLE, 27, 4, TFT_WHITE, TFT_NAVY);
  drawCentered(config.text.c_str(), 66, 2, TFT_DARKGREEN, TFT_WHITE);
  drawCentered(config.priceText.c_str(), 87, 2, TFT_BLACK, TFT_WHITE);
  drawCentered(displayStatus(config.status), 108, 2, TFT_DARKGREY, TFT_WHITE);
  drawQrCode(config.qr, 122);
  drawCentered("Scan zum Oeffnen", tft.height() - 15, 2, TFT_DARKGREY, TFT_WHITE);
}

static void drawTerminalScreen(const ConfigPayload& config) {
  const uint16_t accent = config.status == "SOLD" ? TFT_RED : TFT_DARKGREEN;
  tft.fillScreen(TFT_WHITE);
  tft.fillRect(0, 0, tft.width(), 52, accent);
  drawCentered(APP_TITLE, 27, 4, TFT_WHITE, accent);
  drawCentered(displayStatus(config.status), 112, 4, accent, TFT_WHITE);
  drawCentered(config.text.c_str(), 158, 2, TFT_DARKGREY, TFT_WHITE);
  drawCentered(config.priceText.c_str(), 186, 2, TFT_BLACK, TFT_WHITE);
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
  showBootstrapScreen("WLAN Fehler", "Neuer Versuch folgt", TFT_RED);
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
      || !jsonStringValue(body, "qr", config.qr)
      || !jsonLongValue(body, "eventVersion", config.eventVersion)
      || !jsonStringValue(body, "resetAt", config.resetAt, true)
      || config.productKey.isEmpty() || config.text.isEmpty() || config.priceText.isEmpty()
      || config.eventVersion < 0 || !knownStatus(config.status)) {
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
      if (fetchConfig(config) && xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        pendingConfig = config;
        pendingConfigReady = true;
        xSemaphoreGive(configMutex);
      }
    }
    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(CONFIG_POLL_INTERVAL_MS));
  }
}

static void applyPendingConfig() {
  if (xSemaphoreTake(configMutex, 0) != pdTRUE) return;
  if (!pendingConfigReady) {
    xSemaphoreGive(configMutex);
    return;
  }
  ConfigPayload config = pendingConfig;
  pendingConfigReady = false;
  xSemaphoreGive(configMutex);

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
  tft.setRotation(0);
  tft.invertDisplay(false);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  deviceSecretConfigured = hasConfiguredDeviceSecret();
  if (deviceSecretConfigured) showBootstrapScreen("Verbinde WLAN...", "");
  else showBootstrapScreen("Device Secret fehlt", "secrets.h pruefen", TFT_RED);

  configMutex = xSemaphoreCreateMutex();
  if (!configMutex) {
    drawMessageScreen("Interner Fehler", "Config Mutex", TFT_RED);
    return;
  }
  if (!deviceSecretConfigured) {
    Serial.println("Device Secret fehlt: QR2BUY_DEVICE_SECRET lokal konfigurieren");
  }

  if (xTaskCreate(configPollingTask, "qr2buy-config", 8192, nullptr, 1, nullptr) != pdPASS) {
    drawMessageScreen("Interner Fehler", "Polling Task", TFT_RED);
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
  delay(10);
}
