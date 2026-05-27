#pragma once

#define QR2BUY_PROJECT_USER_SETUP_SELECT

#ifndef USER_SETUP_LOADED
  #error "qr2buy firmware expects USER_SETUP_LOADED and an explicit preincluded TFT setup header from platformio.ini"
#endif

// This project file intentionally shadows TFT_eSPI's User_Setup_Select.h.
// The active setup is injected via platformio.ini with -include include/tft_setup_*.h.
#if !defined(TFT_DRIVER)
  #if defined(ILI9341_DRIVER) || defined(ILI9341_2_DRIVER) || defined(ILI9342_DRIVER)
    #include <TFT_Drivers/ILI9341_Defines.h>
    #define TFT_DRIVER 0x9341
  #endif
#endif
