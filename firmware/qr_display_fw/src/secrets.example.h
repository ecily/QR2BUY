#pragma once

// Copy this file to src/secrets.h and adjust the placeholders locally.
// Never commit src/secrets.h with real WiFi credentials, IPs, tokens, or secrets.

struct WifiCred {
  const char* ssid;
  const char* pass;
};

static const WifiCred WIFI_LIST[] = {
  { "YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD" },
  { "YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD" }
};

constexpr size_t WIFI_LIST_LEN = sizeof(WIFI_LIST) / sizeof(WifiCred);

// Compatibility aliases for the older main.cpp firmware path.
#define WIFI_SSID (WIFI_LIST[0].ssid)
#define WIFI_PASS (WIFI_LIST[0].pass)

// Demo hardware identity used by static_app.cpp. The real secret must match the
// demo-device entry in the backend ENV DEMO_HARDWARE_DEVICE_SECRETS.
#define QR2BUY_DEVICE_ID "demo-device"
#define QR2BUY_DEVICE_SECRET "YOUR_DEVICE_SECRET"

// Backend health endpoint used by healthPing().
#define BACKEND_URL "http://192.168.x.x:3001/api/health"
#define HEALTH_INTERVAL_MS 15000UL

// Device-specific config endpoint used by fetchConfig().
// Keep the deviceId in sync with the backend Device record.
#define CONFIG_URL "http://192.168.x.x:3001/api/config?deviceId=ESP32-DEMO-001"
#define CONFIG_INTERVAL_MS 20000UL

// Optional SSE stream used by the inline SSE client in main.cpp.
// Polling via CONFIG_URL remains the primary reliable path for the demo.
#define EVENTS_HOST "192.168.x.x"
#define EVENTS_PORT 3001
#define EVENTS_PATH "/api/events"
