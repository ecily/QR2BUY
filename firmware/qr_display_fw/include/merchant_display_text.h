#pragma once
// Default pilot language is German. Define QR2BUY_DISPLAY_LANGUAGE_EN for English builds.
inline const char* merchantUnavailableTitle(bool paused, bool english =
#ifdef QR2BUY_DISPLAY_LANGUAGE_EN
true
#else
false
#endif
) {
  return english ? (paused ? "Offer paused" : "Currently sold out")
                 : (paused ? "Angebot pausiert" : "Momentan ausverkauft");
}
inline const char* merchantSoldOutLine1() {
#ifdef QR2BUY_DISPLAY_LANGUAGE_EN
  return "This product is currently";
#else
  return "Dieses Produkt ist gerade";
#endif
}
inline const char* merchantSoldOutFooter() {
#ifdef QR2BUY_DISPLAY_LANGUAGE_EN
  return "Discover our other offers.";
#else
  return "Entdecke unsere anderen Angebote.";
#endif
}
inline const char* merchantUnavailableLine1() {
#ifdef QR2BUY_DISPLAY_LANGUAGE_EN
  return "This product is currently";
#else
  return "Dieses Produkt ist derzeit";
#endif
}
inline const char* merchantUnavailableLine2() {
#ifdef QR2BUY_DISPLAY_LANGUAGE_EN
  return "unavailable.";
#else
  return "nicht verfuegbar.";
#endif
}
