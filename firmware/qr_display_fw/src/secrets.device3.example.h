#pragma once
// Copy to secrets.device3.h (ignored). Never reuse Device 1/2 credentials.
// Provisioning is a separate authorized operator step, not a build side effect.
// Replace WiFi placeholders and use the independently provisioned 32-byte token.
struct WifiCred { const char* ssid; const char* pass; };
static const WifiCred WIFI_LIST[] = {{ "YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD" }};
constexpr size_t WIFI_LIST_LEN = sizeof(WIFI_LIST) / sizeof(WifiCred);
#define QR2BUY_DEVICE_ID "QR2B-000003"
#define QR2BUY_DEVICE_SECRET "YOUR_DEVICE_SECRET"
#define QR2BUY_CREDENTIAL_VERSION 1
#define QR2BUY_API_ORIGIN "https://qr2buy.com"
