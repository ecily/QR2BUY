# qr2buy ESP32 display firmware

Project path: `firmware/qr_display_fw`

This is the PlatformIO firmware for the qr2buy display prototype. It connects an ESP32 to WiFi, polls the qr2buy backend, renders a product QR code on an ILI9341 TFT, and shows `VERKAUFT!` when the backend reports `SOLD`.

## PlatformIO

- Environment: `esp32dev`
- Platform: `espressif32`
- Board: `esp32dev`
- Framework: `arduino`
- Main file: `src/main.cpp`

Useful commands from this directory:

```bash
pio run
pio run --target upload
pio device monitor
```

`platformio.ini` currently sets `upload_port = COM5` and `monitor_port = COM5`. These are local machine settings and may need to be changed or removed on another laptop.

## Local secrets

The firmware includes `src/secrets.h`. This file is intentionally not versioned.

Create it locally from the example:

```bash
copy src\secrets.example.h src\secrets.h
```

Then replace the placeholders in `src/secrets.h`.

Expected defines:

- `WIFI_SSID`
- `WIFI_PASS`
- `BACKEND_URL`
- `HEALTH_INTERVAL_MS`
- `CONFIG_URL`
- `CONFIG_INTERVAL_MS`
- `EVENTS_HOST`
- `EVENTS_PORT`
- `EVENTS_PATH`

Do not commit real WiFi data, IPs, tokens, API keys, or private secrets.

## Backend expectation

The primary firmware path is polling:

```text
GET /api/config?deviceId=ESP32-DEMO-001
```

The backend is expected to return JSON with at least:

- `text`
- `qr`
- `status`

The backend currently also returns `ok`, `deviceId`, `version`, and `updatedAt`.

Expected status values:

- `AVAILABLE`
- `SOLD`

When `status` is `SOLD`, or when `text` is `VERKAUFT!`, the firmware clears the QR display area and shows `VERKAUFT!`.

The firmware also opens an SSE stream at `/api/events`, but polling `CONFIG_URL` is the reliable baseline for the current demo.

## Current hardware assumptions

Known from the current configuration:

- ESP32 dev board (`esp32dev`)
- ILI9341 TFT
- 240x320 display
- TFT_eSPI
- QRCode library renders the QR code locally
- no touch, button, or controllable LED behavior is implemented

## TFT configuration notes

The configuration most likely used by the current build is the `build_flags` block in `platformio.ini`, because it defines `USER_SETUP_LOADED` and the TFT pins directly.

Current `platformio.ini` SPI assumptions:

- `TFT_MISO=19`
- `TFT_MOSI=23`
- `TFT_SCLK=18`
- `TFT_CS=5`
- `TFT_DC=15`
- `TFT_RST=4`
- `SPI_FREQUENCY=8000000`

Known conflicts to resolve before treating the hardware setup as stable:

- `src/TFT_eSPI_Setup.h` describes an SPI setup with `TFT_CS=-1` and backlight fixed to 3V3.
- `lib/TFT_eSPI/User_Setup.h` describes an 8-bit parallel setup with a different pinout.
- Do not change TFT pins until the real wiring is confirmed.

## Git safety

The repository ignore rules protect local firmware artifacts and secrets, including:

- `firmware/**/.pio/`
- `firmware/**/.vscode/`
- `firmware/**/*.code-workspace`
- `firmware/**/src/secrets.h`
- `firmware/**/include/secrets.h`

Keep `src/secrets.example.h` versioned. Keep `src/secrets.h` local only.
