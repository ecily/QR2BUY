import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "src" / "static_app.cpp").read_text(encoding="utf-8")
EXAMPLE_SECRETS = (ROOT / "src" / "secrets.example.h").read_text(encoding="utf-8")
ROOT_CA = (ROOT / "include" / "qr2buy_root_ca.h").read_text(encoding="utf-8")


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
            "READY": "BEREIT",
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
        self.assertIn("left.qr == right.qr", comparison)
        self.assertIn("if (hasRenderedConfig && sameVisibleConfig(renderedConfig, config)) return;", SOURCE)

    def test_http_and_json_failures_do_not_render_or_log_payload(self):
        self.assertIn("if (statusCode != HTTP_CODE_OK)", SOURCE)
        self.assertIn("Config JSON leer oder zu gross", SOURCE)
        self.assertIn("return false;", SOURCE)
        self.assertNotIn("printJsonPreview", SOURCE)
        self.assertNotRegex(SOURCE, r"Serial\.(?:print|println)\s*\(\s*(?:body|config\.qr)")

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
        self.assertIn('showBootstrapScreen("Device Secret fehlt", "secrets.h pruefen", TFT_RED)', SOURCE)
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


if __name__ == "__main__":
    unittest.main()
