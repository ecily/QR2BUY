#include "merchant_config.h"
#include <cassert>
#include <iostream>

std::string fixture(const char* state = "READY") {
  JsonDocument doc;
  doc["ok"] = true; doc["deviceId"] = "QR2B-000001"; doc["assigned"] = true;
  doc["product"]["productId"] = "P1"; doc["product"]["name"] = "Handgemachte Ledertasche";
  doc["offer"]["priceMinor"] = 12900; doc["offer"]["currency"] = "EUR";
  doc["offer"]["stockQuantity"] = 2; doc["offer"]["purchasable"] = true; doc["offer"]["reservable"] = false;
  doc["display"]["status"] = state; doc["display"]["eventVersion"] = "1234567890abcdef";
  doc["display"]["qr"] = "https://qr2buy.com/o/0123456789abcdef0123456789abcdef";
  std::string body; serializeJson(doc, body); return body;
}
bool parse(const std::string& body, MerchantConfig& c) {
  return parseMerchantConfig(body, "QR2B-000001", "https://qr2buy.com", c);
}
int main() {
  MerchantConfig c;
  assert(parse(fixture(), c)); assert(c.assigned); assert(c.productId == "P1");
  assert(c.name == "Handgemachte Ledertasche"); assert(c.priceText == "129,00 EUR");
  assert(c.stockQuantity == 2 && c.purchasable && !c.reservable);
  assert(c.eventVersion == "1234567890abcdef");
  for (auto state : {"READY", "SCANNED", "CHECKOUT_STARTED", "RESERVED", "CANCELLED", "PAID", "SOLD"}) {
    assert(parse(fixture(state), c)); assert(c.status == state);
    const bool terminal = c.status == "PAID" || c.status == "RESERVED" || c.status == "SOLD";
    assert(c.qr.empty() == terminal);
  }
  assert(!parse(fixture("UNKNOWN"), c));
  assert(parse(R"({"ok":true,"deviceId":"QR2B-000001","assigned":false})",c));
  assert(!c.assigned && c.name.empty() && c.qr.empty());
  const std::string preview = R"({"ok":true,"deviceId":"QR2B-000001","assigned":false,"bindingPreview":{"previewId":"0123456789abcdef0123456789abcdef","productName":"Ledertasche","priceMinor":12900,"currency":"EUR","code":"012345","expiresAt":1900000000},"display":{"qr":"https://evil.invalid"}})";
  assert(parse(preview,c)); assert(c.preview && !c.assigned && c.qr.empty());
  assert(c.name=="Ledertasche" && c.priceText=="129,00 EUR" && c.previewCode=="012345");
  assert(c.previewExpiresAt==1900000000);
  assert(!parseMerchantConfig(preview,"QR2B-000002","https://qr2buy.com",c));
  { JsonDocument p; deserializeJson(p,preview);p["bindingPreview"]["code"]="123";std::string b;serializeJson(p,b);assert(!parse(b,c)); }
  { JsonDocument p; deserializeJson(p,preview);p["assigned"]=true;std::string b;serializeJson(p,b);assert(!parse(b,c)); }
  assert(parse(fixture(),c)); assert(c.assigned && !c.preview && !c.qr.empty());
  assert(!parse(R"({"ok":true,"deviceId":"QR2B-000002","assigned":false})",c));
  assert(!parseMerchantConfig(fixture(), "QR2B-000002", "https://qr2buy.com", c));
  JsonDocument doc; deserializeJson(doc,fixture()); doc["deviceId"]="QR2B-000002";
  std::string second;serializeJson(doc,second);
  assert(parseMerchantConfig(second,"QR2B-000002","https://qr2buy.com",c));
  for (auto invalid : {"", "{}", "{", R"({"ok":true,"deviceId":"QR2B-000001","assigned":"false"})"}) assert(!parse(invalid,c));
  assert(!parse(std::string(4097,'x'),c));
  for (auto path : {"product", "offer", "display"}) {
    deserializeJson(doc,fixture());doc.remove(path);std::string body;serializeJson(doc,body);assert(!parse(body,c));
  }
  for (auto url : {"https://qr2buy.com/demo/p/bag#session=invalid", "https://evil.example/o/0123456789abcdef0123456789abcdef", "http://qr2buy.com/o/0123456789abcdef0123456789abcdef"}) {
    deserializeJson(doc,fixture());doc["display"]["qr"]=url;std::string body;serializeJson(doc,body);assert(!parse(body,c));
  }
  deserializeJson(doc,fixture());doc["offer"]["priceMinor"]=12.5;std::string decimal;serializeJson(doc,decimal);assert(!parse(decimal,c));
  deserializeJson(doc,fixture());doc["offer"]["stockQuantity"]=-1;std::string negative;serializeJson(doc,negative);assert(!parse(negative,c));
  std::string price;
  assert(merchantPrice(2490,"EUR",price) && price=="24,90 EUR");
  assert(merchantPrice(1,"EUR",price) && price=="0,01 EUR");
  assert(merchantPrice(0,"EUR",price) && price=="0,00 EUR");
  assert(merchantPrice(1234,"JPY",price) && price=="1234 JPY");
  assert(merchantPrice(1234,"KWD",price) && price=="1,234 KWD");
  assert(!merchantPrice(-1,"EUR",price));assert(!merchantPrice(1000000000,"EUR",price));assert(!merchantPrice(100,"XYZ",price));
  std::cout << "Merchant parser: identities, states, fields, prices, unassigned, malformed input and QR isolation OK\n";
}
