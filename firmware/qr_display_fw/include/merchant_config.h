#pragma once
#include <ArduinoJson.h>
#include <stdint.h>
#include <string>
#include <cstdio>

// Portable parser: the exact same code is exercised by host tests and ESP32.
struct MerchantConfig {
  bool assigned = false;
  bool preview = false;
  std::string previewCode;
  int64_t previewExpiresAt = 0;
  std::string productId, name, priceText, status, qr, eventVersion;
  int64_t stockQuantity = 0;
  bool purchasable = false, reservable = false;
};
inline bool merchantStatus(const std::string& s) {
  return s == "READY" || s == "SCANNED" || s == "CHECKOUT_STARTED" || s == "RESERVED"
    || s == "CANCELLED" || s == "PAID" || s == "SOLD";
}
inline bool lowerHex(const std::string& s, size_t length) {
  return s.size() == length && s.find_first_not_of("0123456789abcdef") == std::string::npos;
}
inline bool merchantPrice(int64_t minor, const std::string& currency, std::string& text) {
  if (minor < 0 || minor > 999999999) return false;
  int digits = 2;
  if (currency == "JPY") digits = 0;
  else if (currency == "KWD" || currency == "BHD") digits = 3;
  else if (currency != "EUR" && currency != "USD" && currency != "GBP" && currency != "CHF") return false;
  const int64_t divisor = digits == 3 ? 1000 : (digits == 2 ? 100 : 1);
  char value[64];
  if (digits) snprintf(value, sizeof(value), "%lld,%0*lld %s", (long long)(minor / divisor), digits, (long long)(minor % divisor), currency.c_str());
  else snprintf(value, sizeof(value), "%lld %s", (long long)minor, currency.c_str());
  text = value;
  return true;
}
inline bool parseMerchantConfig(const std::string& body, const std::string& deviceId,
                                const std::string& apiOrigin, MerchantConfig& output) {
  if (body.empty() || body.size() > 4096) return false;
  JsonDocument doc;
  if (deserializeJson(doc, body, DeserializationOption::NestingLimit(6))) return false;
  if (!doc["ok"].is<bool>() || !doc["ok"].as<bool>() || !doc["assigned"].is<bool>()
      || !doc["deviceId"].is<const char*>() || doc["deviceId"].as<std::string>() != deviceId) return false;
  MerchantConfig result;
  result.assigned = doc["assigned"].as<bool>();
  if (!doc["bindingPreview"].isNull()) {
    auto preview = doc["bindingPreview"].as<JsonObjectConst>();
    if (result.assigned || !preview["previewId"].is<const char*>() || !preview["productName"].is<const char*>()
        || !preview["code"].is<const char*>() || !preview["expiresAt"].is<int64_t>()
        || !preview["priceMinor"].is<int64_t>() || !preview["currency"].is<const char*>()) return false;
    result.eventVersion = preview["previewId"].as<std::string>();
    result.name = preview["productName"].as<std::string>();
    result.previewCode = preview["code"].as<std::string>();
    result.previewExpiresAt = preview["expiresAt"].as<int64_t>();
    if (!lowerHex(result.eventVersion, 32) || result.name.empty() || result.name.size() > 256
        || result.previewCode.size() != 6 || result.previewCode.find_first_not_of("0123456789") != std::string::npos
        || result.previewExpiresAt < 1700000000LL || result.previewExpiresAt > 4102444800LL
        || !merchantPrice(preview["priceMinor"].as<int64_t>(), preview["currency"].as<std::string>(), result.priceText)) return false;
    result.preview = true;
    result.status = "BINDING_PREVIEW";
    result.qr.clear();
    output = result;
    return true;
  }
  if (!result.assigned) { output = result; return true; }
  auto product = doc["product"].as<JsonObjectConst>();
  auto offer = doc["offer"].as<JsonObjectConst>();
  auto display = doc["display"].as<JsonObjectConst>();
  if (!product["productId"].is<const char*>() || !product["name"].is<const char*>()
      || !offer["priceMinor"].is<int64_t>() || !offer["stockQuantity"].is<int64_t>()
      || !offer["currency"].is<const char*>() || !offer["purchasable"].is<bool>() || !offer["reservable"].is<bool>()
      || !display["status"].is<const char*>() || !display["qr"].is<const char*>() || !display["eventVersion"].is<const char*>()) return false;
  result.productId = product["productId"].as<std::string>();
  result.name = product["name"].as<std::string>();
  result.stockQuantity = offer["stockQuantity"].as<int64_t>();
  result.purchasable = offer["purchasable"].as<bool>();
  result.reservable = offer["reservable"].as<bool>();
  result.status = display["status"].as<std::string>();
  result.qr = display["qr"].as<std::string>();
  result.eventVersion = display["eventVersion"].as<std::string>();
  if (result.productId.empty() || result.productId.size() > 128 || result.name.empty() || result.name.size() > 256
      || result.stockQuantity < 0 || !merchantStatus(result.status) || !lowerHex(result.eventVersion, 16)
      || !merchantPrice(offer["priceMinor"].as<int64_t>(), offer["currency"].as<std::string>(), result.priceText)) return false;
  const bool terminal = result.status == "PAID" || result.status == "SOLD" || result.status == "RESERVED";
  const std::string prefix = apiOrigin + "/o/";
  if (!terminal && (result.qr.compare(0, prefix.size(), prefix) != 0 || !lowerHex(result.qr.substr(prefix.size()), 32))) return false;
  if (terminal) result.qr.clear();
  output = result;
  return true;
}
