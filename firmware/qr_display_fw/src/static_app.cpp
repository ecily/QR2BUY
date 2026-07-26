#include <Arduino.h>
#include <HTTPClient.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <qrcode.h>

#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_WIFI_SSID"
#endif

#ifndef WIFI_PASS
#define WIFI_PASS "YOUR_WIFI_PASSWORD"
#endif

#ifndef QR2BUY_CONFIG_URL
#define QR2BUY_CONFIG_URL "https://lionfish-app-zidqr.ondigitalocean.app/api/config?deviceId=demo-device"
#endif

static TFT_eSPI tft;

static const char* APP_TITLE = "qr2buy";
static const char* APP_FOOTER = "Scan zum Oeffnen";
static const uint32_t WIFI_TIMEOUT_MS = 20000UL;
static const uint32_t HTTP_TIMEOUT_MS = 12000UL;

struct ConfigPayload {
  String text;
  String status;
  String qr;
};

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
  drawCentered(line1, 105, 2, accent, TFT_WHITE);
  if (line2 && line2[0] != '\0') {
    drawCentered(line2, 132, 2, TFT_DARKGREY, TFT_WHITE);
  }
}

static void drawQrCode(const char* url) {
  QRCode qr;
  static uint8_t qrBuffer[400];
  qrcode_initText(&qr, qrBuffer, 4, 0, url);

  const int16_t areaTop = 102;
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

static void drawAppScreen(const ConfigPayload& config) {
  tft.fillScreen(TFT_WHITE);
  tft.fillRect(0, 0, tft.width(), 52, TFT_NAVY);

  drawCentered(APP_TITLE, 27, 4, TFT_WHITE, TFT_NAVY);
  drawCentered(config.text.c_str(), 68, 2, TFT_DARKGREEN, TFT_WHITE);
  drawCentered(config.status.c_str(), 88, 2, TFT_DARKGREY, TFT_WHITE);
  drawQrCode(config.qr.c_str());
  drawCentered(APP_FOOTER, tft.height() - 16, 2, TFT_DARKGREY, TFT_WHITE);
}

static bool hasConfiguredWifi() {
  return strcmp(WIFI_SSID, "YOUR_WIFI_SSID") != 0 && strlen(WIFI_SSID) > 0;
}

static bool connectWifi() {
  Serial.println("Verbinde WLAN...");

  if (!hasConfiguredWifi()) {
    Serial.println("WLAN nicht konfiguriert: src/secrets.h mit WIFI_SSID/WIFI_PASS anlegen");
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < WIFI_TIMEOUT_MS) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("WLAN Fehler, status=");
    Serial.println(WiFi.status());
    return false;
  }

  Serial.println("WiFi verbunden");
  Serial.print("IP=");
  Serial.println(WiFi.localIP());
  return true;
}

static void printJsonPreview(const String& body) {
  Serial.print("JSON: ");
  if (body.length() <= 700) {
    Serial.println(body);
    return;
  }

  Serial.print(body.substring(0, 700));
  Serial.println("... [gekuerzt]");
}

static bool jsonBoolValue(const String& json, const char* key) {
  const String needle = String("\"") + key + "\"";
  int pos = json.indexOf(needle);
  if (pos < 0) return false;

  pos = json.indexOf(':', pos + needle.length());
  if (pos < 0) return false;

  pos++;
  while (pos < json.length() && isspace(static_cast<unsigned char>(json[pos]))) pos++;
  return json.substring(pos, pos + 4) == "true";
}

static String jsonStringValue(const String& json, const char* key) {
  const String needle = String("\"") + key + "\"";
  int pos = json.indexOf(needle);
  if (pos < 0) return "";

  pos = json.indexOf(':', pos + needle.length());
  if (pos < 0) return "";

  pos++;
  while (pos < json.length() && isspace(static_cast<unsigned char>(json[pos]))) pos++;
  if (pos >= json.length() || json[pos] != '"') return "";

  pos++;
  String out;
  bool escaped = false;
  for (; pos < json.length(); pos++) {
    const char c = json[pos];
    if (escaped) {
      if (c == 'n') out += '\n';
      else if (c == 'r') out += '\r';
      else if (c == 't') out += '\t';
      else out += c;
      escaped = false;
      continue;
    }

    if (c == '\\') {
      escaped = true;
      continue;
    }
    if (c == '"') break;
    out += c;
  }

  return out;
}

static bool fetchConfig(ConfigPayload& config) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  Serial.print("GET ");
  Serial.println(QR2BUY_CONFIG_URL);

  if (!http.begin(client, QR2BUY_CONFIG_URL)) {
    Serial.println("HTTP begin fehlgeschlagen");
    return false;
  }

  const int statusCode = http.GET();
  Serial.print("HTTP status ");
  Serial.println(statusCode);

  const String body = http.getString();
  printJsonPreview(body);
  http.end();

  if (statusCode != HTTP_CODE_OK) {
    return false;
  }

  if (!jsonBoolValue(body, "ok")) {
    Serial.println("Config ok=false");
    return false;
  }

  config.text = jsonStringValue(body, "text");
  config.status = jsonStringValue(body, "status");
  config.qr = jsonStringValue(body, "qr");

  Serial.print("parsed text=");
  Serial.println(config.text);
  Serial.print("parsed status=");
  Serial.println(config.status);
  Serial.print("parsed qr=");
  Serial.println(config.qr);

  if (config.text.length() == 0) config.text = "qr2buy";
  if (config.status.length() == 0) config.status = "UNKNOWN";

  return config.qr.length() > 0;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("QR2BUY WIFI CONFIG APP START");

  enableBacklightIfConfigured();
  pulseResetIfConfigured();

  tft.init();
  tft.setRotation(0);
  tft.invertDisplay(false);
  drawMessageScreen("Verbinde WLAN...", "");

  if (!connectWifi()) {
    drawMessageScreen("WLAN Fehler", "Serial Monitor pruefen", TFT_RED);
    return;
  }

  drawMessageScreen("Lade Config...", "");

  ConfigPayload config;
  if (!fetchConfig(config)) {
    drawMessageScreen("Config Fehler", "Serial Monitor pruefen", TFT_RED);
    return;
  }

  drawAppScreen(config);
}

void loop() {
  delay(1000);
}
