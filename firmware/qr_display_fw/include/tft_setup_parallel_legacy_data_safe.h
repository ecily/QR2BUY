#pragma once

#define QR2BUY_TFT_SETUP_PARALLEL_LEGACY_DATA_SAFE

#define TFT_PARALLEL_8_BIT
#define ILI9341_DRIVER
#define TFT_WIDTH 240
#define TFT_HEIGHT 320

#define TFT_RST 4
#define TFT_CS 15
#define TFT_DC 2
#define TFT_WR 21
#define TFT_RD 22

#define TFT_D0 12
#define TFT_D1 13
#define TFT_D2 26
#define TFT_D3 25
#define TFT_D4 17
#define TFT_D5 16
#define TFT_D6 27
#define TFT_D7 14

#define TFT_BL -1

#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define LOAD_FONT6
#define LOAD_FONT7
#define LOAD_FONT8
#define LOAD_GFXFF
#define SMOOTH_FONT
