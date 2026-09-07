#pragma once
// Copy to secrets.device1.h (ignored). Never commit credentials.
// Generate a 32-byte random token through the operator credential service.
// Local build-only configurations are NOT provisioned in Mongo.
struct WifiCred { const char* ssid; const char* pass; };
static const WifiCred WIFI_LIST[] = {{ "YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD" }};
constexpr size_t WIFI_LIST_LEN = sizeof(WIFI_LIST) / sizeof(WifiCred);
#define QR2BUY_DEVICE_ID "QR2B-000001"
#define QR2BUY_DEVICE_SECRET "YOUR_DEVICE_SECRET"
#define QR2BUY_CREDENTIAL_VERSION 1
#define QR2BUY_API_ORIGIN "https://qr2buy.com"
