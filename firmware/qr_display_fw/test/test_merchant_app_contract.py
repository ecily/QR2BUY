import configparser
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class MerchantAppContractTest(unittest.TestCase):
    def test_pilot_unavailable_screen_is_merchant_only_without_qr(self):
        source = (ROOT / 'src/static_app.cpp').read_text()
        screen = source.split('static void drawUnavailableOffer', 1)[1].split('static void renderConfig', 1)[0]
        self.assertNotIn('drawQrCode', screen)
        self.assertIn('merchantUnavailableTitle', screen)
        self.assertIn('drawProminentProductName(config.text, 18, 284, 68)', screen)
        self.assertIn('config.bound && (config.status == "SOLD" || config.status == "PAUSED")', source)
        self.assertIn('http.addHeader("x-firmware-version", "0.3.7")', source)

    def test_sold_out_layout_and_copy_are_separate_from_paused(self):
        source = (ROOT / 'src/static_app.cpp').read_text()
        screen = source.split('static void drawSoldOutOffer', 1)[1].split('static void drawUnavailableOffer', 1)[0]
        self.assertNotIn('drawQrCode', screen)
        self.assertIn('drawProminentProductName(config.text, 18, 284, 51)', screen)
        self.assertIn('merchantSoldOutFooter(), 220, 1', screen)
        self.assertIn('merchantSoldOutLine1(), 157, 2', screen)
        paused = source.split('static void drawUnavailableOffer', 1)[1].split('static void renderConfig', 1)[0]
        self.assertIn('if (config.status == "SOLD")', paused)
        self.assertIn('merchantUnavailableLine1(), 171, 2', paused)
        self.assertIn('merchantUnavailableLine2(), 192, 2', paused)
        copy = (ROOT / 'include/merchant_display_text.h').read_text()
        for text in ['Dieses Produkt ist gerade', 'Entdecke unsere anderen Angebote.', 'Currently sold out', 'This product is currently', 'Discover our other offers.']:
            self.assertIn(text, copy)

    def test_preview_has_no_buyer_qr_and_expires_without_network(self):
        source = (ROOT / 'src/static_app.cpp').read_text()
        preview = source.split('if (config.bindingPreview) {', 1)[1].split('} else if (!config.bound)', 1)[0]
        self.assertIn('ZUORDNUNG PRUEFEN', preview)
        self.assertIn('config.text', preview)
        self.assertIn('config.priceText', preview)
        self.assertIn('config.previewCode', preview)
        self.assertNotIn('drawQrCode', preview)
        self.assertIn('time(nullptr) >= renderedConfig.previewExpiresAt', source)
        self.assertIn('left.previewCode == right.previewCode', source)
        self.assertIn('http.addHeader("x-firmware-version", "0.3.7")', source)
        self.assertNotIn('Serial.println(config.previewCode', source)

    def test_shared_app_and_separate_hardware_and_secret_configs(self):
        ini = configparser.ConfigParser(interpolation=None)
        ini.read(ROOT / 'platformio.ini')
        cs = ini['env:esp32dev_spi_cs5_rst4_merchant_app']
        nc = ini['env:esp32dev_spi_nocs_rst4_merchant_app']
        self.assertEqual(cs['extends'], 'env:esp32dev_spi_cs5_rst4_app')
        self.assertEqual(nc['extends'], 'env:esp32dev_spi_cs5_rst4_merchant_app')
        self.assertEqual(cs['upload_port'], 'COM3')
        self.assertEqual(nc['upload_port'], 'COM4')
        self.assertIn('tft_setup_spi_nocs_rst4.h', nc['build_flags'])
        self.assertIn('#define TFT_CS -1', (ROOT / 'include/tft_setup_spi_nocs_rst4.h').read_text())
        self.assertIn('#define QR2BUY_DISPLAY_ROTATION 3', (ROOT / 'include/tft_setup_spi_nocs_rst4.h').read_text())
        self.assertNotIn('QR2BUY_DISPLAY_ROTATION', (ROOT / 'include/tft_setup_spi_cs5_rst4.h').read_text())
        source = (ROOT / 'src/static_app.cpp').read_text()
        for device in (1, 2):
            self.assertIn(f'#include "secrets.device{device}.h"', source)
            example = (ROOT / f'src/secrets.device{device}.example.h').read_text()
            self.assertIn(f'QR2B-00000{device}', example)
            self.assertIn('YOUR_DEVICE_SECRET', example)
        self.assertIn('left.merchantEventVersion == right.merchantEventVersion', source)
        self.assertIn('if (config.interactionParsedScanned) config.status = "READY"', source)
        self.assertIn('parseMerchantConfig(body.c_str()', source)
        for header in ('x-device-id', 'x-device-secret', 'x-device-credential-version', 'x-firmware-version'):
            self.assertIn(f'http.addHeader("{header}"', source)
        self.assertNotIn('setInsecure()', source)
        self.assertIn('client.setCACert(QR2BUY_ROOT_CA)', source)

    def test_real_cpp_parser_on_host(self):
        build = ROOT / '.pio/merchant-host'
        build.mkdir(parents=True, exist_ok=True)
        library = ROOT / '.pio/libdeps/esp32dev/ArduinoJson/src'
        if os.name == 'nt':
            vcvars = Path('C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat')
            command = f'call "{vcvars}" >nul && cl /nologo /EHsc /std:c++14 /I"{ROOT / "include"}" /I"{library}" "{ROOT / "test/merchant_config_host.cpp"}" /Fe:merchant_config_test.exe && merchant_config_test.exe'
            # A list argument containing an entire cmd command is escaped using
            # Windows argv rules by subprocess, but cmd does not interpret \".
            # Keep shell syntax in a batch file and pass only its simple name.
            script = build / 'merchant_host_test.cmd'
            script.write_text('@echo off\n' + command + '\n', encoding='utf-8')
            try:
                subprocess.run(['cmd.exe', '/d', '/c', script.name], cwd=build, check=True)
            finally:
                script.unlink()
        else:
            subprocess.run(['c++', '-std=c++14', '-I'+str(ROOT/'include'), '-I'+str(library), str(ROOT/'test/merchant_config_host.cpp'), '-o', str(build/'parser')], check=True)
            subprocess.run([str(build/'parser')], check=True)
