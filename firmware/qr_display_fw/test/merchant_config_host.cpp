#include "merchant_config.h"
#include "merchant_display_text.h"
#include <cassert>
#include <iostream>
#include "status_screen_host.h"

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
  assert(claimDisplayName("ecily.com"));assert(claimDisplayName(u8"\u00c4\u00d6\u00dc \u00e4\u00f6\u00fc"));
  assert(claimDisplayName(std::string(64,'x')));assert(!claimDisplayName(std::string(65,'x')));
  for(const auto name : {"", " A", "A ", "A\nB", u8"Caf\u00e9", u8"\u00df", u8"\u5546\u5e97", u8"a\u0308", u8"a\u202eB"}) assert(!claimDisplayName(name));
  {
    const std::string valid=R"({"ok":true,"deviceId":"QR2B-000001","assigned":false,"claimSetup":{"code":"abcdef0123456789abcdef0123456789","expiresAt":1900000000}})";
    MerchantConfig setup;assert(parse(valid,setup));assert(setup.setup && !setup.claim && !setup.assigned && setup.qr.empty());
    for(const auto key : {"code", "expiresAt", "assigned", "claimPreview"}) {
      JsonDocument d;deserializeJson(d,valid);
      if(std::string(key)=="assigned")d[key]=true;
      else if(std::string(key)=="claimPreview")d[key]["claimId"]="bad";
      else d["claimSetup"][key]="bad";
      std::string body;serializeJson(d,body);assert(!parse(body,setup));
    }
  }
  {
    const std::string valid = R"({"ok":true,"deviceId":"QR2B-000001","assigned":false,"claimPreview":{"claimId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","merchantName":"Merchant A","locationName":"Window A","code":"123456","expiresAt":1900000000}})";
    MerchantConfig claim;
    assert(parse(valid,claim));assert(claim.claim && !claim.preview && !claim.assigned && claim.qr.empty());
    assert(claim.claimMerchant == "Merchant A" && claim.claimLocation == "Window A");
    assert(claim.previewCode == "123456" && claim.previewExpiresAt == 1900000000);
    for (const auto invalid : {"assigned", "code", "claimId", "expiresAt", "merchantName", "locationName", "bindingPreview", "product"}) {
      JsonDocument d;deserializeJson(d,valid);
      if (std::string(invalid)=="assigned") d[invalid]=true;
      else if (std::string(invalid)=="bindingPreview" || std::string(invalid)=="product") d[invalid]["bad"]=true;
      else d["claimPreview"][invalid]="";
      std::string body;serializeJson(d,body);assert(!parse(body,claim));
    }
  }
  testStatusLayout();
  for (const auto state : {"OUT_OF_STOCK", "RESERVED", "PAUSED", "SOLD", "READY"}) {
    JsonDocument d; deserializeJson(d,fixture(state));
    d["display"]["notifyAvailable"] = true;
    std::string body; serializeJson(d,body); MerchantConfig notify;
    if (std::string(state) == "READY") { assert(!parse(body,notify)); continue; }
    assert(parse(body,notify));
    assert(notify.notifyAvailable == (std::string(state) != "SOLD"));
    assert(notify.qr.empty() == (std::string(state) == "SOLD"));
    if (std::string(state) != "SOLD") {
      d["display"]["qr"] = "https://foreign.invalid/o/0123456789abcdef0123456789abcdef";
      body.clear();serializeJson(d,body);assert(!parse(body,notify));
    }
    d["display"]["notifyAvailable"] = false; d["display"]["qr"] = "";
    body.clear();serializeJson(d,body);assert(parse(body,notify));assert(notify.qr.empty());
  }
  assert(std::string(merchantUnavailableTitle(false, false)) == "Momentan ausverkauft");
  assert(std::string(merchantUnavailableTitle(true, false)) == "Angebot pausiert");
  assert(std::string(merchantUnavailableTitle(false, true)) == "Currently sold out");
  assert(std::string(merchantUnavailableTitle(true, true)) == "Offer paused");
  MerchantConfig c;
  assert(parse(fixture(), c)); assert(c.assigned); assert(c.productId == "P1");
  assert(c.name == "Handgemachte Ledertasche"); assert(c.priceText == "129,00 EUR");
  assert(c.stockQuantity == 2 && c.purchasable && !c.reservable);
  assert(c.eventVersion == "1234567890abcdef");
  for (auto state : {"READY", "SCANNED", "CHECKOUT_STARTED", "RESERVED", "CANCELLED", "PAID", "SOLD", "PAUSED"}) {
    assert(parse(fixture(state), c)); assert(c.status == state);
    const bool terminal = c.status == "PAID" || c.status == "RESERVED" || c.status == "SOLD" || c.status == "PAUSED";
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
  // A third CS5 device must accept only its own projection, including UNBOUND.
  assert(parseMerchantConfig(R"({"ok":true,"deviceId":"QR2B-000003","assigned":false})",
                             "QR2B-000003","https://qr2buy.com",c));
  assert(!c.assigned && c.qr.empty());
  doc["deviceId"]="QR2B-000003";
  std::string third;serializeJson(doc,third);
  assert(parseMerchantConfig(third,"QR2B-000003","https://qr2buy.com",c));
  for (auto other : {"QR2B-000001", "QR2B-000002"}) {
    assert(!parseMerchantConfig(third,other,"https://qr2buy.com",c));
  }
  assert(!parseMerchantConfig(fixture(),"QR2B-000003","https://qr2buy.com",c));
  assert(!parseMerchantConfig(second,"QR2B-000003","https://qr2buy.com",c));
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
