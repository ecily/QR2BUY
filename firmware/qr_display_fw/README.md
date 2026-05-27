# qr2buy ESP32 display firmware

Alpha hardware milestone reached on 2026-05-27:

- `esp32dev_spi_cs5_rst4_tft_diag` shows visible display output.
- `esp32dev_spi_cs5_rst4_qr_diag` shows a QR code.
- The QR code scans successfully with a phone.
- Working hardware mode: SPI with `CS=5`, `RST=4`, `MOSI=23`, `MISO=19`, `SCLK=18`, `DC=15`.
- Test URL: `https://qr2buy.com/p/demo`.
- `https://qr2buy.com/p/demo` does not need to be live for this milestone; the success condition is a scanable QR code on the TFT.

No WiFi, backend, Stripe, MongoDB, secrets, or live qr2buy flow is needed for the display diagnostics.

Project path:

```bash
cd /c/coding/qr2buy/firmware/qr_display_fw
```

PlatformIO path used on this machine:

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe
```

Current USB serial port:

```text
COM3
```

## Working reference: SPI prototype

This is the confirmed working alpha hardware path. Use this first for the SPI prototype.

Build, upload, and monitor the color/text diagnostic:

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_cs5_rst4_tft_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_cs5_rst4_tft_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

Expected display output:

```text
black -> red -> green -> blue -> white text -> color bars with QR2BUY DISPLAY OK
```

After visible TFT output, build, upload, and monitor the confirmed QR diagnostic:

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_cs5_rst4_qr_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_cs5_rst4_qr_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

Expected display output:

```text
QR2BUY QR TEST
QR code for https://qr2buy.com/p/demo
```

Expected serial start:

```text
QR DIAG START
url=https://qr2buy.com/p/demo
```

Scan with a phone. A successful scan proves QR rendering and TFT output; the target URL may still return a non-live page.

## Fallback: parallel prototype, direct 8080 driver

Use this only for the parallel prototype. It bypasses TFT_eSPI completely and drives the legacy 8-bit bus directly, including GPIO32/GPIO33 via the ESP32 high-GPIO registers.

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_direct8080_tft_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_direct8080_tft_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

Expected serial start:

```text
DIRECT8080 TFT DIAG START
mode=direct ESP32 8080 parallel, no TFT_eSPI
note=GPIO32/GPIO33 are handled via GPIO.out1 registers
```

Expected display output:

```text
black -> red -> green -> blue -> white -> color bars
```

Abort this test after about 45 seconds if the display stays solid white and the serial monitor keeps printing `draw=...`.

## Parallel QR test after visible direct 8080 output

Only flash this after the direct color test visibly works.

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_direct8080_qr_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_direct8080_qr_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

Expected display output:

```text
white background with black QR code for https://qr2buy.com/p/demo
```

Expected serial start:

```text
DIRECT8080 QR DIAG START
url=https://qr2buy.com/p/demo
qr_size=33
```

Scan with a phone. If it scans, the parallel display bus is proven good enough for alpha hardware work.

## If direct 8080 stays white

Try the TFT_eSPI legacy environment next. It uses the same reconstructed legacy pinout but still has known GPIO32/GPIO33 shift warnings in TFT_eSPI.

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_tft_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_tft_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

Expected display output:

```text
black -> red -> green -> blue -> white text -> color bars with QR2BUY DISPLAY OK
```

If it is still white, test the older common TFT_eSPI Setup14-style pinout. This only helps if the physical wiring actually matches that pinout.

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_setup14_tft_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_setup14_tft_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

If you intentionally rewire only legacy data lines D4/D5 away from GPIO33/GPIO32 to GPIO17/GPIO16, use this:

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_data_safe_tft_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_parallel_legacy_data_safe_tft_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

## SPI fallback variants

If the SPI display has CS tied to GND:

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_nocs_rst4_tft_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_nocs_rst4_tft_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

If reset is not wired:

```bash
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_cs5_norst_tft_diag
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe run -e esp32dev_spi_cs5_norst_tft_diag --target upload --upload-port COM3
/c/Users/Nutzer/.platformio/penv/Scripts/platformio.exe device monitor -p COM3 -b 115200
```

## Environment matrix

| Environment | Purpose | Pins |
| --- | --- | --- |
| `esp32dev_spi_cs5_rst4_tft_diag` | Confirmed working SPI color/text test | MISO19 MOSI23 SCLK18 CS5 DC15 RST4 |
| `esp32dev_spi_cs5_rst4_qr_diag` | Confirmed working SPI QR test | MISO19 MOSI23 SCLK18 CS5 DC15 RST4 |
| `esp32dev_parallel_legacy_direct8080_tft_diag` | First parallel color test, no TFT_eSPI | RST4 CS15 DC2 WR21 RD22 D0=12 D1=13 D2=26 D3=25 D4=33 D5=32 D6=27 D7=14 |
| `esp32dev_parallel_legacy_direct8080_qr_diag` | Direct QR test after color works | same as direct 8080 TFT |
| `esp32dev_parallel_legacy_tft_diag` | TFT_eSPI legacy test | same legacy pins, known GPIO32/GPIO33 warnings |
| `esp32dev_parallel_legacy_qr_diag` | TFT_eSPI QR on legacy pins | same legacy pins |
| `esp32dev_parallel_setup14_tft_diag` | TFT_eSPI Setup14-style fallback | CS33 DC15 RST32 WR4 RD2 D0=12 D1=13 D2=26 D3=25 D4=17 D5=16 D6=27 D7=14 |
| `esp32dev_parallel_legacy_data_safe_tft_diag` | Rewired legacy-control variant with safe data pins | RST4 CS15 DC2 WR21 RD22 D4=17 D5=16 |
| `esp32dev_spi_nocs_rst4_tft_diag` | SPI when CS is tied to GND | MISO19 MOSI23 SCLK18 CS=-1 DC15 RST4 |
| `esp32dev_spi_cs5_norst_tft_diag` | SPI when reset is not wired | MISO19 MOSI23 SCLK18 CS5 DC15 RST=-1 |

## Build status checked on 2026-05-27

All of these built successfully locally before the hardware test:

```text
esp32dev_spi_cs5_rst4_tft_diag                SUCCESS, hardware visible
esp32dev_spi_cs5_rst4_qr_diag                 SUCCESS, hardware scanable QR
esp32dev_parallel_legacy_direct8080_tft_diag  SUCCESS
esp32dev_parallel_legacy_direct8080_qr_diag   SUCCESS
esp32dev_parallel_legacy_tft_diag             SUCCESS
esp32dev_parallel_legacy_qr_diag              SUCCESS
esp32dev_parallel_setup14_tft_diag            SUCCESS
esp32dev_parallel_legacy_data_safe_tft_diag   SUCCESS
esp32dev_spi_nocs_rst4_tft_diag               SUCCESS
esp32dev_spi_cs5_norst_tft_diag               SUCCESS
esp32dev                                      SUCCESS
```

Known warning:

```text
esp32dev_parallel_legacy_tft_diag: left shift count >= width of type
```

That warning comes from TFT_eSPI's ESP32 parallel GPIO masks with data pins on GPIO32/GPIO33. The direct 8080 diagnostic exists specifically to bypass this.

## Commit safety

Do not commit local firmware artifacts or secrets:

```text
firmware/**/.pio/
firmware/**/.vscode/
firmware/**/src/secrets.h
firmware/**/*.code-workspace
```
