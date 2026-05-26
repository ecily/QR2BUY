#pragma once
// Wir konfigurieren TFT_eSPI ausschließlich über die build_flags in platformio.ini.
// Wenn USER_SETUP_LOADED gesetzt ist, macht TFT_eSPI intern mit genau diesen Defines weiter.
#ifdef USER_SETUP_LOADED
  // Keine Includes, keine weiteren Defines nötig.
#else
  // Fallback: nichts tun – Bibliothek nutzt ihre internen Defaults.
  // (Wir erwarten USER_SETUP_LOADED immer gesetzt zu haben.)
#endif
