import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "src" / "static_app.cpp").read_text(encoding="utf-8")
EXAMPLE_SECRETS = (ROOT / "src" / "secrets.example.h").read_text(encoding="utf-8")
ROOT_CA = (ROOT / "include" / "qr2buy_root_ca.h").read_text(encoding="utf-8")
ACTIVE_TFT_SETUP = (ROOT / "include" / "tft_setup_spi_cs5_rst4.h").read_text(encoding="utf-8")


class StaticAppContractTest(unittest.TestCase):
    def test_uses_only_demo_hardware_endpoint_and_device_header(self):
        self.assertIn("https://qr2buy.com/api/demo/hardware/config?deviceId=", SOURCE)
        self.assertIn('http.addHeader("x-device-secret", QR2BUY_DEVICE_SECRET)', SOURCE)
        self.assertNotIn("/api/config?deviceId=", SOURCE)

    def test_bound_false_has_dedicated_display_and_keeps_polling(self):
        self.assertIn('drawMessageScreen("Hardware nicht", "gekoppelt")', SOURCE)
        self.assertRegex(SOURCE, r"if \(!config\.bound\) return true;")
        self.assertIn("CONFIG_POLL_INTERVAL_MS = 3000UL", SOURCE)
        self.assertIn("vTaskDelayUntil", SOURCE)

    def test_required_statuses_have_backend_driven_rendering(self):
        expected = {
            "READY": "NOCH ZU HABEN",
            "CHECKOUT_STARTED": "CHECKOUT LAEUFT",
            "CANCELLED": "ABGEBROCHEN",
            "RESERVED": "RESERVIERT",
            "PAID": "BEZAHLT",
            "SOLD": "VERKAUFT",
        }
        for status, label in expected.items():
            self.assertIn(f'if (status == "{status}") return "{label}"', SOURCE)
        self.assertRegex(SOURCE, r'status == "READY" \|\| status == "CHECKOUT_STARTED" \|\| status == "CANCELLED"')
        for terminal in ("RESERVED", "PAID", "SOLD"):
            self.assertNotRegex(SOURCE, rf"statusShowsQr\([^)]*{terminal}")

    def test_render_deduplication_includes_product_and_event_version(self):
        comparison = SOURCE[SOURCE.index("static bool sameVisibleConfig"):SOURCE.index("static bool hasConfiguredWifi")]
        self.assertIn("left.productKey == right.productKey", comparison)
        self.assertIn("left.eventVersion == right.eventVersion", comparison)
        self.assertIn("left.status == right.status", comparison)
        self.assertIn("left.interactionState == right.interactionState", comparison)
        self.assertIn("left.qr == right.qr", comparison)
        self.assertIn("const bool redraw = !hasRenderedConfig || !sameVisibleConfig(renderedConfig, config);", SOURCE)
        self.assertIn("if (!redraw) return;", SOURCE)

    def test_http_and_json_failures_do_not_render_or_log_payload(self):
        self.assertIn("if (statusCode != HTTP_CODE_OK)", SOURCE)
        self.assertIn("Config JSON leer oder zu gross", SOURCE)
        self.assertIn("return false;", SOURCE)
        self.assertNotIn("printJsonPreview", SOURCE)
        self.assertNotRegex(SOURCE, r"Serial\.(?:print|println)\s*\(\s*(?:body|config\.qr)")
        self.assertIn('showBootstrapScreen("Backend temporaer", "nicht erreichbar", COLOR_ERROR)', SOURCE)
        self.assertIn("if (hasRenderedConfig) return;", SOURCE)

    def test_wifi_fallback_reconnect_is_non_blocking(self):
        self.assertIn("while (wifiIndex < WIFI_LIST_LEN)", SOURCE)
        self.assertIn("WLAN Verbindung verloren; Reconnect startet", SOURCE)
        self.assertIn("wifiRetryAt = now", SOURCE)
        self.assertIn("serviceWifi();", SOURCE)
        loop_body = SOURCE[SOURCE.index("void loop()") :]
        self.assertNotIn("delay(1000)", loop_body)
        self.assertIn("delay(10)", loop_body)

    def test_missing_device_secret_is_safe_and_visible(self):
        self.assertIn('#define QR2BUY_DEVICE_SECRET "YOUR_DEVICE_SECRET"', SOURCE)
        self.assertIn('strcmp(QR2BUY_DEVICE_SECRET, "YOUR_DEVICE_SECRET") != 0', SOURCE)
        self.assertIn('showBootstrapScreen("Device Secret fehlt", "secrets.h pruefen", COLOR_ERROR)', SOURCE)
        self.assertIn('#define QR2BUY_DEVICE_ID "demo-device"', EXAMPLE_SECRETS)
        self.assertIn('#define QR2BUY_DEVICE_SECRET "YOUR_DEVICE_SECRET"', EXAMPLE_SECRETS)

    def test_tls_uses_root_ca_and_requires_network_time(self):
        self.assertIn("client.setCACert(QR2BUY_ROOT_CA)", SOURCE)
        self.assertNotIn("setInsecure", SOURCE)
        self.assertIn("configTime(0, 0", SOURCE)
        self.assertIn("MIN_VALID_UNIX_TIME", SOURCE)
        self.assertIn("BEGIN CERTIFICATE", ROOT_CA)
        self.assertIn("END CERTIFICATE", ROOT_CA)

    def test_qr_capacity_covers_current_urls_and_rejects_oversize_input(self):
        capacities_match = re.search(r"capacityByVersion\[\] = \{ ([0-9, ]+) \}", SOURCE)
        self.assertIsNotNone(capacities_match)
        capacities = [int(value.strip()) for value in capacities_match.group(1).split(",")]
        longest_product_key = "christmas-tree"
        sample_url = f"https://qr2buy.com/demo/p/{longest_product_key}#session={'x' * 43}"
        self.assertLessEqual(len(sample_url), capacities[-1])
        self.assertGreater(len(sample_url), capacities[3])
        self.assertIn("if (version == 0", SOURCE)
        self.assertIn("QR_MAX_BUFFER_BYTES = 512", SOURCE)
        self.assertIn("quietModules = 4", SOURCE)
        self.assertIn("if (scale < 2) return false", SOURCE)

    def test_landscape_frontpage_inspired_sales_display_contract(self):
        self.assertIn("tft.setRotation(1)", SOURCE)
        self.assertIn("QR_PANEL_WIDTH = 146", SOURCE)
        self.assertIn("CONTENT_X = 164", SOURCE)
        self.assertIn("drawQrCode(config.qr, 9, 14, 140, 140)", SOURCE)
        self.assertIn('"Mit dem Handy"', SOURCE)
        self.assertIn('"KEINE APP NOETIG"', SOURCE)
        self.assertIn('"Fiktives Demo-Produkt"', SOURCE)
        self.assertIn('"Status live synchronisiert"', SOURCE)

    def test_display_palette_uses_named_rgb565_colors_and_dark_qr(self):
        expected_colors = {
            "COLOR_PAPER": "0xFFFF",
            "COLOR_WARM": "0xEF5B",
            "COLOR_INK": "0x08C2",
            "COLOR_MUTED": "0x3207",
            "COLOR_PINE": "0x1A47",
            "COLOR_READY_BG": "0xB6B5",
            "COLOR_READY_FG": "0x11A3",
        }
        for name, value in expected_colors.items():
            self.assertRegex(SOURCE, rf"{name}\s*=\s*{value}")
        qr_renderer = SOURCE[SOURCE.index("static bool drawQrCode"):SOURCE.index("static const char* displayStatus")]
        self.assertIn("COLOR_PINE_DARK", qr_renderer)
        self.assertIn("COLOR_PAPER", qr_renderer)

    def test_active_hardware_does_not_claim_software_backlight_control(self):
        self.assertRegex(ACTIVE_TFT_SETUP, r"#define\s+TFT_BL\s+-1")
        self.assertNotIn("QR2BUY_BACKLIGHT_PIN", ACTIVE_TFT_SETUP)
        self.assertNotIn("ledcWrite", SOURCE)

    def test_live_footer_requires_a_fresh_successful_config_fetch(self):
        self.assertIn("LIVE_FRESHNESS_MS = 10000UL", SOURCE)
        self.assertIn("hasSuccessfulConfigFetch = false", SOURCE)
        freshness = SOURCE[SOURCE.index("static bool connectionIsFresh"):SOURCE.index("static uint16_t livePulseColor")]
        self.assertIn("hasSuccessfulConfigFetch", freshness)
        self.assertIn("WiFi.status() == WL_CONNECTED", freshness)
        self.assertIn("clockReady()", freshness)
        self.assertIn("now - lastSuccessfulConfigAt <= LIVE_FRESHNESS_MS", freshness)
        success_path = SOURCE[SOURCE.index("static void configPollingTask"):SOURCE.index("static void applyPendingConfig")]
        self.assertRegex(success_path, r"if \(fetched\)[\s\S]*pendingConfigFetchedAt = millis\(\)")
        self.assertIn("lastSuccessfulConfigAt = configFetchedAt", SOURCE)

    def test_live_pulse_only_redraws_its_small_footer_dot(self):
        self.assertIn("LIVE_PULSE_STEP_MS = 300UL", SOURCE)
        self.assertIn('tft.drawString("LIVE", 176, 229, 1)', SOURCE)
        self.assertIn('tft.drawString("SICHER VERBUNDEN", 212, 229, 1)', SOURCE)
        service = SOURCE[SOURCE.index("static void serviceConnectionIndicator"):SOURCE.index("static void drawProductScreen")]
        self.assertIn("drawFooterPulse(livePulseColor(pulseStep))", service)
        self.assertNotIn("fillScreen", service)
        self.assertNotIn("drawProductScreen", service)

    def test_scan_usp_is_prominent_without_changing_qr_geometry(self):
        self.assertIn('drawCenteredAt("Mit dem Handy", 79, 163, 2', SOURCE)
        self.assertIn('drawCenteredAt("scannen", 79, 188, 4', SOURCE)
        self.assertIn("tft.fillRoundRect(20, 204, 118, 18, 9, COLOR_READY_BG)", SOURCE)
        self.assertIn('drawCenteredAt("KEINE APP NOETIG", 79, 213, 1', SOURCE)
        self.assertIn("drawQrCode(config.qr, 9, 14, 140, 140)", SOURCE)

    def test_transient_scan_display_preserves_commerce_priority_and_layout(self):
        self.assertIn('String interactionState;', SOURCE)
        self.assertIn('jsonStringValue(body, "interactionState", config.interactionState, true)', SOURCE)
        priority = SOURCE[SOURCE.index("static bool scanInteractionVisible"):SOURCE.index("static void drawScanStatus")]
        self.assertIn('config.status == "READY"', priority)
        self.assertIn('config.interactionState == "SCANNED"', priority)
        self.assertIn('drawCenteredAt("SCAN ERKANNT"', SOURCE)
        self.assertIn('drawCenteredAt("Bitte am"', SOURCE)
        self.assertIn('drawCenteredAt("Smartphone"', SOURCE)
        self.assertIn('drawCenteredAt("fortfahren"', SOURCE)
        scan_branch = SOURCE[SOURCE.index("if (scanInteractionVisible(config))"):SOURCE.index("tft.fillRect(0, 225")]
        self.assertIn("drawScanStatus(CONTENT_X, 122)", scan_branch)
        self.assertIn("drawStatusPill(config.status", scan_branch)
        self.assertIn("drawQrCode(config.qr, 9, 14, 140, 140)", SOURCE)
        self.assertNotIn("interactionExpiresAt", priority)
        self.assertNotIn("millis()", priority)

    def test_scanned_overlay_clears_ready_region_and_finishes_before_footer(self):
        overlay = SOURCE[SOURCE.index("static void drawScanStatus"):SOURCE.index("static void drawWrappedProductName")]
        self.assertIn("FOOTER_TOP = 225", overlay)
        self.assertIn("tft.fillRect(clearX, y, tft.width() - clearX, FOOTER_TOP - y, COLOR_WARM)", overlay)
        self.assertIn("tft.fillRoundRect(x, blockY, blockWidth, blockHeight, 8, COLOR_PINE_DARK)", overlay)
        self.assertIn('drawCenteredAt("SCAN ERKANNT"', overlay)
        self.assertIn('drawCenteredAt("Bitte am"', overlay)
        self.assertIn('drawCenteredAt("Smartphone"', overlay)
        self.assertIn('drawCenteredAt("fortfahren"', overlay)
        product_screen = SOURCE[SOURCE.index("static void drawProductScreen"):SOURCE.index("static void drawTerminalScreen")]
        self.assertLess(product_screen.index("drawScanStatus(CONTENT_X, 122)"), product_screen.index("drawConnectionFooter"))
        self.assertIn("left.interactionState == right.interactionState", SOURCE)
        self.assertIn("drawStatusPill(config.status", product_screen)

    def test_scan_diagnostics_are_compact_and_secret_safe(self):
        self.assertIn("interactionFieldPresent", SOURCE)
        self.assertIn("interactionParsedScanned", SOURCE)
        self.assertIn('diagnosticDisplayMode(config)', SOURCE)
        self.assertIn('diagnosticDisplayMode(renderedConfig)', SOURCE)
        self.assertIn('redraw ? "yes" : "no"', SOURCE)
        self.assertIn('redraw ? diagnosticRenderTarget(config) : "none"', SOURCE)
        self.assertIn('"visible-change" : "same-visible-config"', SOURCE)
        self.assertIn('return "drawScanStatus"', SOURCE)
        diagnostic = SOURCE[SOURCE.index('"CFG status=%s'):SOURCE.index("if (!redraw) return;")]
        for forbidden in ("config.qr", "QR2BUY_DEVICE_SECRET", "body", "x-device-secret"):
            self.assertNotIn(forbidden, diagnostic)

    def test_product_title_adapts_between_loaded_fonts_and_stays_two_lines(self):
        self.assertIn("#define LOAD_FONT2", ACTIVE_TFT_SETUP)
        self.assertIn("#define LOAD_FONT4", ACTIVE_TFT_SETUP)
        splitter = SOURCE[SOURCE.index("static bool splitTitleForFont"):SOURCE.index("static void drawProminentProductName")]
        self.assertIn("leftWidth <= maxWidth && rightWidth <= maxWidth", splitter)
        self.assertNotIn("thirdLine", splitter)
        renderer = SOURCE[SOURCE.index("static void drawProminentProductName"):SOURCE.index("static bool statusShowsQr")]
        self.assertIn("splitTitleForFont(text, 4, maxWidth", renderer)
        self.assertIn("splitTitleForFont(text, 2, maxWidth - 1", renderer)
        self.assertIn("y + 27, 4", renderer)
        self.assertIn("x + 1, y, 2", renderer)
        self.assertIn("y + 22, 2", renderer)
        self.assertNotIn("thirdLine", renderer)
        self.assertIn("tft.fillRoundRect(CONTENT_X - 5, 31, 156, 58, 6, COLOR_PAPER)", SOURCE)
        self.assertIn("drawProminentProductName(config.text, CONTENT_X + 2, 145)", SOURCE)
        self.assertIn("tft.drawString(displayPrice(config.priceText), CONTENT_X, 94, 4)", SOURCE)


if __name__ == "__main__":
    unittest.main()
