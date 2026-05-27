#pragma once

#define QR2BUY_TFT_SETUP_SPI_CS5_RST4

#define ILI9341_DRIVER
#define TFT_WIDTH 240
#define TFT_HEIGHT 320

#define TFT_MISO 19
#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_CS 5
#define TFT_DC 15
#define TFT_RST 4
#define TFT_BL -1

#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define SMOOTH_FONT

#define SPI_FREQUENCY 4000000
#define SPI_READ_FREQUENCY 4000000
