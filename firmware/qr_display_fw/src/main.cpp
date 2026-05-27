// C:\Users\Lenovo\Documents\PlatformIO\Projects\qr_display_fw\src\main.cpp
#include <Arduino.h>
#include <TFT_eSPI.h>

TFT_eSPI tft;

#if defined(QR2BUY_TFT_DIAG) || defined(QR2BUY_QR_DIAG)

#define STR_HELPER(x) #x
#define STR(x) STR_HELPER(x)

void printTftBuildConfig(){
  Serial.println("[TFT DIAG] expected build flags:");
#ifdef USER_SETUP_LOADED
  Serial.println("  USER_SETUP_LOADED=yes");
#else
  Serial.println("  USER_SETUP_LOADED=no");
#endif
#ifdef ILI9341_DRIVER
  Serial.println("  driver=ILI9341");
#else
  Serial.println("  driver=unknown");
#endif
#ifdef TFT_PARALLEL_8_BIT
  Serial.println("  bus=TFT_PARALLEL_8_BIT");
#endif
#ifdef ESP32_PARALLEL
  Serial.println("  ESP32_PARALLEL=yes");
#endif
#ifdef TFT_WIDTH
  Serial.println("  TFT_WIDTH=" STR(TFT_WIDTH));
#endif
#ifdef TFT_HEIGHT
  Serial.println("  TFT_HEIGHT=" STR(TFT_HEIGHT));
#endif
#ifdef TFT_MISO
  Serial.println("  TFT_MISO=" STR(TFT_MISO));
#endif
#ifdef TFT_MOSI
  Serial.println("  TFT_MOSI=" STR(TFT_MOSI));
#endif
#ifdef TFT_SCLK
  Serial.println("  TFT_SCLK=" STR(TFT_SCLK));
#endif
#ifdef TFT_CS
  Serial.println("  TFT_CS=" STR(TFT_CS));
#endif
#ifdef TFT_DC
  Serial.println("  TFT_DC=" STR(TFT_DC));
#endif
#ifdef TFT_RST
  Serial.println("  TFT_RST=" STR(TFT_RST));
#endif
#ifdef TFT_WR
  Serial.println("  TFT_WR=" STR(TFT_WR));
#endif
#ifdef TFT_RD
  Serial.println("  TFT_RD=" STR(TFT_RD));
#endif
#ifdef TFT_D0
  Serial.println("  TFT_D0=" STR(TFT_D0));
#endif
#ifdef TFT_D1
  Serial.println("  TFT_D1=" STR(TFT_D1));
#endif
#ifdef TFT_D2
  Serial.println("  TFT_D2=" STR(TFT_D2));
#endif
#ifdef TFT_D3
  Serial.println("  TFT_D3=" STR(TFT_D3));
#endif
#ifdef TFT_D4
  Serial.println("  TFT_D4=" STR(TFT_D4));
#endif
#ifdef TFT_D5
  Serial.println("  TFT_D5=" STR(TFT_D5));
#endif
#ifdef TFT_D6
  Serial.println("  TFT_D6=" STR(TFT_D6));
#endif
#ifdef TFT_D7
  Serial.println("  TFT_D7=" STR(TFT_D7));
#endif
#ifdef SPI_FREQUENCY
  Serial.println("  SPI_FREQUENCY=" STR(SPI_FREQUENCY));
#endif
#ifdef SPI_READ_FREQUENCY
  Serial.println("  SPI_READ_FREQUENCY=" STR(SPI_READ_FREQUENCY));
#endif
}

#endif

#ifdef QR2BUY_TFT_DIAG

void drawDiagStep(uint8_t step){
  switch(step){
    case 0:
      Serial.println("[TFT DIAG] draw black");
      tft.fillScreen(TFT_BLACK);
      break;
    case 1:
      Serial.println("[TFT DIAG] draw red");
      tft.fillScreen(TFT_RED);
      break;
    case 2:
      Serial.println("[TFT DIAG] draw green");
      tft.fillScreen(TFT_GREEN);
      break;
    case 3:
      Serial.println("[TFT DIAG] draw blue");
      tft.fillScreen(TFT_BLUE);
      break;
    default:
      Serial.println("[TFT DIAG] draw text TFT OK");
      tft.fillScreen(TFT_BLACK);
      tft.setTextDatum(MC_DATUM);
      tft.setTextColor(TFT_WHITE, TFT_BLACK);
      tft.drawString("TFT OK", tft.width() / 2, tft.height() / 2, 4);
      break;
  }
}

void setup(){
  Serial.begin(115200);
  delay(300);
  Serial.println("TFT DIAG START");
  printTftBuildConfig();

  tft.init();
  tft.setRotation(0);
  drawDiagStep(0);
}

void loop(){
  static uint8_t step = 0;
  static uint32_t lastDrawMs = millis();

  if(millis() - lastDrawMs >= 2000UL){
    lastDrawMs = millis();
    step = (step + 1) % 5;
    drawDiagStep(step);
  }
}

#elif defined(QR2BUY_QR_DIAG)

#include <qrcode.h>

static const char* QR_DIAG_URL = "https://qr2buy.com/p/demo";

void drawQrDiag(){
  Serial.println("[QR DIAG] draw QR https://qr2buy.com/p/demo");

  tft.fillScreen(TFT_WHITE);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_BLACK, TFT_WHITE);
  tft.drawString("QR2BUY QR TEST", tft.width() / 2, 24, 2);

  QRCode qr;
  static uint8_t buf[400];
  qrcode_initText(&qr, buf, 4, 0, QR_DIAG_URL);

  int maxW = tft.width() - 24;
  int maxH = tft.height() - 76;
  int scale = min(maxW / qr.size, maxH / qr.size);
  if(scale < 2) scale = 2;

  int size = qr.size * scale;
  int x0 = (tft.width() - size) / 2;
  int y0 = 56 + ((tft.height() - 56 - size) / 2);

  tft.fillRect(x0 - 6, y0 - 6, size + 12, size + 12, TFT_WHITE);
  for(int y = 0; y < qr.size; y++){
    for(int x = 0; x < qr.size; x++){
      if(qrcode_getModule(&qr, x, y)){
        tft.fillRect(x0 + x * scale, y0 + y * scale, scale, scale, TFT_BLACK);
      }
    }
  }
}

void setup(){
  Serial.begin(115200);
  delay(300);
  Serial.println("QR DIAG START");
  printTftBuildConfig();

  tft.init();
  tft.setRotation(0);
  drawQrDiag();
}

void loop(){
  delay(1000);
}

#else

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <qrcode.h>
#include "secrets.h"

// ─────────────────────────────────────────────────────────────
// Defaults / Fallbacks (falls in secrets.h nicht definiert)
// ─────────────────────────────────────────────────────────────
#ifndef BACKEND_URL
  #define BACKEND_URL "http://10.0.0.55:3001/api/health"
#endif
#ifndef HEALTH_INTERVAL_MS
  #define HEALTH_INTERVAL_MS 15000UL
#endif
#ifndef CONFIG_URL
  #define CONFIG_URL "http://10.0.0.55:3001/api/config?deviceId=ESP32-DEMO-001"
#endif
#ifndef CONFIG_INTERVAL_MS
  #define CONFIG_INTERVAL_MS 20000UL
#endif
#ifndef EVENTS_HOST
  #define EVENTS_HOST "10.0.0.55"
#endif
#ifndef EVENTS_PORT
  #define EVENTS_PORT 3001
#endif
#ifndef EVENTS_PATH
  #define EVENTS_PATH "/api/events"
#endif

// ───────── Farben & Layout ─────────
static const uint16_t BG_COLOR   = TFT_SILVER;
static const uint16_t TXT_MAIN   = TFT_BLACK;
static const uint16_t TXT_OK     = TFT_DARKGREEN;
static const uint16_t TXT_WARN   = TFT_ORANGE;
static const uint16_t TXT_HEADER = TFT_NAVY;
static const uint16_t TXT_ACTION = TFT_RED;

static const int Y_HEADER = 26;
static const int Y_WIFI   = 54;
static const int Y_HEALTH = 84;
static const int Y_TEXT   = 114;     // Haupttextzeile
static const int Y_QR     = 222;     // QR zentriert mit Luft
static const int QR_BAND_H = 180;    // Höhe des QR-Bereichs

// ───────── Laufende Zustände ─────────
uint32_t lastHealth=0,lastConfig=0;
int curHttpCode=0; uint32_t curLatencyMs=0;
bool curWifiOK=false; String curIP=""; int curRSSIBucket=0;

String currentText="Jetzt kaufen";
String currentQR  ="https://example.com/demo";
String currentStatus="UNKNOWN";

int prevHttpCode=-999; uint32_t prevLatencyBucket=0;
bool prevWifiOK=false; String prevIP=""; int prevRSSIBucket=999;
String prevText="", prevQR="", prevStatus="";

// ───────── Push-Integration (SSE) ─────────
volatile bool hasPendingUpdate = false;
String pendingText, pendingQR, pendingStatus;

// ───────── Helpers ─────────
void clearBand(int y,int h){int y0=y-h/2;if(y0<0)y0=0;tft.fillRect(0,y0,tft.width(),h,BG_COLOR);}
void clearQRBand(){ tft.fillRect(0, Y_QR - QR_BAND_H/2, tft.width(), QR_BAND_H, BG_COLOR); }
void drawCentered(const String&s,int y,uint8_t f,uint16_t c){tft.setTextDatum(MC_DATUM);tft.setTextColor(c,BG_COLOR);tft.drawString(s,tft.width()/2,y,f);}

// ───────── Header ─────────
void drawHeaderStatic(){
  tft.fillScreen(BG_COLOR);
  tft.fillRect(0,0,tft.width(),40,TXT_HEADER);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_WHITE,TXT_HEADER);
  int16_t w=tft.textWidth("qr2buy.com - QR PROTOTYP",2);
  if(w<tft.width()-8)
    tft.drawString("qr2buy.com - QR PROTOTYP",tft.width()/2,24,2);
  else{
    tft.drawString("qr2buy.com",tft.width()/2,16,2);
    tft.drawString("QR PROTOTYP",tft.width()/2,32,2);
  }
}

// ───────── QR Rendering ─────────
void drawQR(const String& data,int cx,int cy,int scale=3){
  const uint8_t version=6,ecc=0;
  QRCode qr; static uint8_t buf[370];
  qrcode_initText(&qr,buf,version,ecc,data.c_str());
  int size=qr.size*scale;
  int x0=cx-size/2,y0=cy-size/2;
  tft.fillRect(x0-4,y0-4,size+8,size+8,BG_COLOR);
  for(int y=0;y<qr.size;y++)
    for(int x=0;x<qr.size;x++)
      if(qrcode_getModule(&qr,x,y))
        tft.fillRect(x0+x*scale,y0+y*scale,scale,scale,TFT_BLACK);
}

// ───────── WiFi + HTTP ─────────
bool connectWiFi(uint32_t timeoutMs=20000){
  WiFi.mode(WIFI_STA); WiFi.setSleep(false); WiFi.begin(WIFI_SSID,WIFI_PASS);
  uint32_t s=millis();while(WiFi.status()!=WL_CONNECTED&&millis()-s<timeoutMs){delay(200);Serial.print('.');}
  Serial.println();return WiFi.status()==WL_CONNECTED;
}
void healthPing(){
  if(WiFi.status()!=WL_CONNECTED){curHttpCode=-1;curLatencyMs=0;return;}
  HTTPClient h;h.setConnectTimeout(4000);h.setTimeout(4000);h.begin(BACKEND_URL);
  uint32_t t0=millis();int code=h.GET();curLatencyMs=millis()-t0;curHttpCode=code;h.end();
}
void fetchConfig(){
  if(WiFi.status()!=WL_CONNECTED)return;
  HTTPClient h;h.setConnectTimeout(5000);h.setTimeout(5000);h.begin(CONFIG_URL);
  int c=h.GET();
  if(c==HTTP_CODE_OK){
    String p=h.getString();
    JsonDocument d; // v7 dynamisch
    DeserializationError err=deserializeJson(d,p);
    if(!err){
      if(d["text"].is<const char*>())   currentText   = String((const char*)d["text"]);
      if(d["qr"].is<const char*>())     currentQR     = String((const char*)d["qr"]);
      if(d["status"].is<const char*>()) currentStatus = String((const char*)d["status"]);
    } else {
      Serial.printf("[CONFIG] JSON parse error: %s (len=%u)\n", err.c_str(), p.length());
    }
  }
  h.end();
}

// ───────── Partielle Updates ─────────
void updateWifi(){
  bool ok=(WiFi.status()==WL_CONNECTED);String ip=ok?WiFi.localIP().toString():"";
  int rssi=ok?(WiFi.RSSI()/5):0;
  if(ok!=prevWifiOK||ip!=prevIP||rssi!=prevRSSIBucket){
    prevWifiOK=ok;prevIP=ip;prevRSSIBucket=rssi;clearBand(Y_WIFI,24);
    if(ok)drawCentered("WLAN OK  IP: "+ip+"  RSSI: "+String(WiFi.RSSI())+" dBm",Y_WIFI,2,TXT_OK);
    else drawCentered("WLAN GETRENNT (reconnect...)",Y_WIFI,2,TXT_WARN);
  }
}
void updateHealth(){
  uint32_t latB=(curLatencyMs+49)/100;
  if(curHttpCode!=prevHttpCode||latB!=prevLatencyBucket){
    prevHttpCode=curHttpCode;prevLatencyBucket=latB;clearBand(Y_HEALTH,24);
    String s="Health "+String(curHttpCode)+" ("+String(curLatencyMs)+" ms)";
    drawCentered(s,Y_HEALTH,2,curHttpCode==200?TXT_OK:TXT_WARN);
  }
}

// Text-Update abhängig vom Status
void updateText(){
  bool statusChanged = (currentStatus != prevStatus);
  bool textChanged   = (currentText   != prevText);
  if(!(statusChanged || textChanged)) return;

  prevStatus = currentStatus;
  prevText   = currentText;

  // Textbereiche leeren
  clearBand(Y_TEXT, 60);

  if(currentStatus == "SOLD" || currentText.equalsIgnoreCase("VERKAUFT!") ){
    // Großes "VERKAUFT!" zentriert im QR-Bereich anzeigen (nachdem updateQR ggf. vorher gelöscht hat)
    drawCentered("VERKAUFT!", Y_QR, 4, TXT_ACTION);
  } else {
    drawCentered(currentText, Y_TEXT, 4, TXT_ACTION);
  }
}

// QR-Update: bei SOLD keinen QR zeichnen, aber QR-Band nur dann löschen, wenn vorher QR da war
void updateQR(){
  if(currentStatus == "SOLD" || currentText.equalsIgnoreCase("VERKAUFT!") ){
    if(prevQR.length() > 0){
      prevQR = "";
      clearQRBand();   // Band leeren; updateText() zeichnet danach "VERKAUFT!"
    }
    return;
  }
  if(currentQR!=prevQR){
    prevQR=currentQR;
    clearQRBand();
    drawQR(currentQR,tft.width()/2,Y_QR,3);
  }
}

// ───────── SSE-Client (inline) ─────────
struct SseConfig {
  const char* host;      // z.B. "10.0.0.55"
  uint16_t    port;      // 3001
  const char* path;      // "/api/events"
  uint32_t    backoffInitialMs;
  uint32_t    backoffMaxMs;
  SseConfig(const char* h, uint16_t p, const char* pa, uint32_t bi, uint32_t bm)
  : host(h), port(p), path(pa), backoffInitialMs(bi), backoffMaxMs(bm) {}
  SseConfig(): host(nullptr), port(0), path(nullptr), backoffInitialMs(3000), backoffMaxMs(30000) {}
};

typedef void (*OnUpdateFn)(const char* text, const char* qr, const char* status);

class SseClient {
public:
  SseClient(const SseConfig& cfg, OnUpdateFn cb): cfg_(cfg), cb_(cb) {}
  void begin(){ xTaskCreatePinnedToCore(taskEntry,"SSE",8192,this,1,nullptr,1); }
private:
  static void taskEntry(void* arg){ reinterpret_cast<SseClient*>(arg)->run(); }
  void run(){
    uint32_t backoff=cfg_.backoffInitialMs;
    for(;;){
      if(connectAndStream()){
        backoff=cfg_.backoffInitialMs;
      }else{
        Serial.printf("[SSE] reconnect in %lu ms\n",(unsigned long)backoff);
        delay(backoff);
        backoff = (backoff < cfg_.backoffMaxMs/2) ? (backoff*2) : cfg_.backoffMaxMs;
      }
    }
  }
  bool connectAndStream(){
    if(WiFi.status()!=WL_CONNECTED){ delay(1000); return false; }
    WiFiClient client;
    Serial.printf("[SSE] connect %s:%u%s\n",cfg_.host,cfg_.port,cfg_.path);
    if(!client.connect(cfg_.host,cfg_.port)){ Serial.println("[SSE] connect failed"); return false; }
    client.setTimeout(60000);
    client.print(String("GET ")+cfg_.path+" HTTP/1.1\r\n");
    client.print(String("Host: ")+cfg_.host+":"+String(cfg_.port)+"\r\n");
    client.print("Accept: text/event-stream\r\n");
    client.print("Cache-Control: no-cache\r\n");
    client.print("Connection: keep-alive\r\n\r\n");
    if(!client.find("\r\n\r\n")){ Serial.println("[SSE] no header end"); client.stop(); return false; }
    Serial.println("[SSE] stream open");

    String line, eventName, dataBuf;
    uint32_t lastRx=millis();
    for(;;){
      if(!client.connected()){ Serial.println("[SSE] disconnected"); client.stop(); return false; }
      if(millis()-lastRx>70000){ Serial.println("[SSE] idle timeout"); client.stop(); return false; }
      if(!client.available()){ delay(10); continue; }
      line = client.readStringUntil('\n');
      lastRx=millis();
      line.trim();

      if(line.length()==0){
        if(eventName=="update" && dataBuf.length()){
          JsonDocument doc; // v7 dynamisch
          DeserializationError err = deserializeJson(doc, dataBuf);
          if(!err && cb_){
            const char* text   = doc["text"]   | "";
            const char* qr     = doc["qr"]     | "";
            const char* status = doc["status"] | "";
            Serial.printf("[SSE] update parsed (textLen=%u, qrLen=%u, status=%s)\n",
                          (unsigned)strlen(text), (unsigned)strlen(qr), status);
            cb_(text, qr, status);
          } else {
            Serial.printf("[SSE] parse error: %s (len=%u)\n",
                          err.c_str(), dataBuf.length());
          }
        }
        eventName=""; dataBuf="";
        continue;
      }

      if(line.startsWith("event:")){
        eventName = line.substring(6); eventName.trim();
      }else if(line.startsWith("data:")){
        if(dataBuf.length()) dataBuf+='\n';
        String part = line.substring(5); part.trim();
        dataBuf += part;
      }
    }
  }
  SseConfig  cfg_;
  OnUpdateFn cb_;
};

// Callback aus SSE-Task → nur Daten übernehmen, Redraw im loop()
void applyServerUpdate(const char* text, const char* qr, const char* status){
  pendingText   = String(text   ? text   : "");
  pendingQR     = String(qr     ? qr     : "");
  pendingStatus = String(status ? status : "");
  hasPendingUpdate = true;
}

// Globaler SSE-Client
SseConfig sseCfg(EVENTS_HOST, EVENTS_PORT, EVENTS_PATH, 3000, 30000);
SseClient sse(sseCfg, applyServerUpdate);

// ───────── Setup / Loop ─────────
void setup(){
  Serial.begin(115200);delay(300);
  tft.init();tft.setRotation(0);tft.setTextDatum(MC_DATUM);
  drawHeaderStatic();

  connectWiFi();curWifiOK=(WiFi.status()==WL_CONNECTED);
  healthPing();fetchConfig();

  prevWifiOK=!curWifiOK;
  updateWifi(); updateHealth();
  // Reihenfolge entscheidend:
  updateQR();  updateText();

  lastHealth=millis();lastConfig=millis();

  // Push-Stream starten (SSE)
  sse.begin();
}

void loop(){
  // WiFi-Handling
  if(WiFi.status()!=WL_CONNECTED){
    if(curWifiOK){curWifiOK=false;updateWifi();}
    if(connectWiFi()){
      curWifiOK=true;
      updateWifi(); healthPing(); updateHealth(); fetchConfig();
      // Reihenfolge entscheidend:
      updateQR();  updateText();
    }
  }else{
    updateWifi();
  }

  // Periodische Tasks
  if(millis()-lastHealth>=HEALTH_INTERVAL_MS){
    lastHealth=millis(); healthPing(); updateHealth();
  }
  if(millis()-lastConfig>=CONFIG_INTERVAL_MS){
    lastConfig=millis(); fetchConfig();
    // Reihenfolge entscheidend:
    updateQR(); updateText();
  }

  // Push-Updates anwenden (thread-sicher)
  if(hasPendingUpdate){
    hasPendingUpdate = false;

    if(pendingText.length())   currentText   = pendingText;
    if(pendingQR.length())     currentQR     = pendingQR;
    if(pendingStatus.length()) currentStatus = pendingStatus;

    if(!pendingStatus.length() && currentText.equalsIgnoreCase("VERKAUFT!")){
      currentStatus = "SOLD";
    }

    // Reihenfolge entscheidend:
    updateQR(); updateText();
  }
}

#endif
