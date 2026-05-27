// Legacy reconstructed parallel setup.
// Note: TFT_D4=33 and TFT_D5=32 trigger TFT_eSPI ESP32 mask warnings.
// Use esp32dev_parallel_legacy_direct8080_tft_diag to test this wiring without TFT_eSPI.

// ==== Display-Treiber ====
#define ILI9341_DRIVER        // Dein Controller

// ==== Bus: 8-Bit Parallel (kein SPI!) ====
#define TFT_PARALLEL_8_BIT

// ==== Steuer-Pins (gemäß deiner Verkabelung) ====
#define TFT_RST   4           // LCD_RST  -> GPIO 4
#define TFT_CS    15          // LCD_CS   -> GPIO 15
#define TFT_DC    2           // LCD_RS   -> GPIO 2   (Data/Command)
#define TFT_WR    21          // LCD_WR   -> GPIO 21
#define TFT_RD    22          // LCD_RD   -> GPIO 22

// ==== Daten-Pins D0..D7 ====
#define TFT_D0    12          // LCD_D0   -> GPIO 12
#define TFT_D1    13          // LCD_D1   -> GPIO 13
#define TFT_D2    26          // LCD_D2   -> GPIO 26
#define TFT_D3    25          // LCD_D3   -> GPIO 25
#define TFT_D4    33          // LCD_D4   -> GPIO 33
#define TFT_D5    32          // LCD_D5   -> GPIO 32
#define TFT_D6    27          // LCD_D6   -> GPIO 27
#define TFT_D7    14          // LCD_D7   -> GPIO 14

// ==== Optionales Zeug (ok so zu lassen) ====
#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define LOAD_FONT6
#define LOAD_FONT7
#define LOAD_FONT8
#define LOAD_GFXFF
#define SMOOTH_FONT
