#pragma once

// ---- Display-Typ -------------------------------------------------
#define ILI9341_DRIVER
#define TFT_WIDTH  240
#define TFT_HEIGHT 320

// ---- SPI-Pins (ESP32 DevKitC V4) --------------------------------
#define TFT_MISO 19
#define TFT_MOSI 23
#define TFT_SCLK 18

// CS ist hart auf GND gesteckt -> -1
#define TFT_CS   -1
// DC bleibt auf GPIO15
#define TFT_DC   15
// RESET jetzt aktiv auf GPIO4
#define TFT_RST  4

#define TFT_BL   -1  // LED fest auf 3V3

// ---- Fonts / Features --------------------------------------------
#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define SMOOTH_FONT

// ---- SPI-Takt (konservativ für Tests) ----------------------------
#define SPI_FREQUENCY       10000000   // 10 MHz
#define SPI_READ_FREQUENCY   6000000
