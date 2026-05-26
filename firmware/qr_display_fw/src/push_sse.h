#pragma once
#include <WiFi.h>
#include <ArduinoJson.h>

struct SseConfig {
  const char* host;      // z.B. "10.0.0.55"
  uint16_t    port;      // 3001
  const char* path;      // "/events"
  uint32_t    reconnectInitialMs = 3000;
  uint32_t    reconnectMaxMs     = 30000;
};

typedef void (*OnUpdateFn)(const char* text, const char* qr);

class SseClient {
public:
  SseClient(const SseConfig& cfg, OnUpdateFn cb)
  : cfg_(cfg), cb_(cb) {}

  void begin() {
    xTaskCreatePinnedToCore(taskEntry, "SSE", 8192, this, 1, nullptr, 1);
  }

private:
  static void taskEntry(void* arg) {
    reinterpret_cast<SseClient*>(arg)->run();
  }

  void run() {
    uint32_t backoff = cfg_.reconnectInitialMs;
    for (;;) {
      if (connectAndStream()) {
        backoff = cfg_.reconnectInitialMs; // erfolgreiche Session → Backoff resetten
      } else {
        delay(backoff);
        backoff = min<uint32_t>(backoff * 2, cfg_.reconnectMaxMs);
      }
    }
  }

  bool connectAndStream() {
    WiFiClient client;
    if (!client.connect(cfg_.host, cfg_.port)) return false;
    client.setTimeout(60000);

    // HTTP-Request für SSE
    client.print(String("GET ") + cfg_.path + " HTTP/1.1\r\n");
    client.print(String("Host: ") + cfg_.host + ":" + String(cfg_.port) + "\r\n");
    client.print("Accept: text/event-stream\r\n");
    client.print("Cache-Control: no-cache\r\n");
    client.print("Connection: keep-alive\r\n\r\n");

    // Header lesen
    if (!client.find("\r\n\r\n")) return false;

    String line, eventName, dataBuf;
    for (;;) {
      line = client.readStringUntil('\n');
      if (!client.connected()) return false;

      line.trim();
      if (line.length() == 0) {
        // Event-Komplett – dispatch
        if (eventName == "update" && dataBuf.length()) {
          StaticJsonDocument<512> doc;
          DeserializationError err = deserializeJson(doc, dataBuf);
          if (!err && cb_) {
            const char* text = doc["text"] | "";
            const char* qr   = doc["qr"]   | "";
            cb_(text, qr);
          }
        }
        eventName = "";
        dataBuf   = "";
        continue;
      }

      if (line.startsWith("event:")) {
        eventName = line.substring(6);
        eventName.trim();
      } else if (line.startsWith("data:")) {
        if (dataBuf.length()) dataBuf += '\n';
        dataBuf += line.substring(5);
        dataBuf.trim();
      }
      // "id:" & "retry:" ignorieren wir auf dem ESP
    }
    // unreachable
    // return true;
  }

  SseConfig cfg_;
  OnUpdateFn cb_;
};
