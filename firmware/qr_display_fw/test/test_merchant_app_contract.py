import configparser
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class MerchantAppContractTest(unittest.TestCase):
    def test_shared_status_screen_has_no_qr_or_system_copy(self):
        source = (ROOT / 'src/static_app.cpp').read_text(encoding='utf-8')
        screen = source.split('static void drawStatusText(const char* text, int top, int height, uint8_t largest, uint16_t color, int left =', 1)[1].split('static void renderConfig', 1)[0]
        no_notify = screen.split('static void drawNotifyScreen', 1)[0]
        self.assertNotIn('drawQrCode', no_notify)
        self.assertNotIn('STATUS LIVE AKTUALISIERT', screen)
        self.assertNotIn('Der QR-Code ist jetzt deaktiviert.', screen)
        for kind in ['Reserved', 'Sold', 'Paused', 'OutOfStock']:
            self.assertIn('status_screen::Kind::' + kind, screen)
        self.assertIn('footerIndicatorVisible = false', screen)
        self.assertIn('left + (width - line.width) / 2', screen)
        self.assertIn('tft.textWidth(value, font)', screen)
        self.assertIn('if (glyph.umlaut)', screen)

    def test_out_of_stock_wire_status_is_separate_from_sold(self):
        source = (ROOT / 'src/static_app.cpp').read_text(encoding='utf-8')
        self.assertIn('config.bound && (config.status == "OUT_OF_STOCK" || config.status == "PAUSED")', source)
        screen = source.split('static void drawSoldOutOffer', 1)[1].split('static void drawUnavailableOffer', 1)[0]
        self.assertIn('status_screen::Kind::OutOfStock', screen)
        self.assertIn('http.addHeader("x-firmware-version", "0.3.11")', source)

    def test_binding_paid_and_qr_renderers_remain_unchanged(self):
        source = (ROOT / 'src/static_app.cpp').read_text(encoding='utf-8')
        baseline = subprocess.check_output(['git', 'show', '28dd17d:firmware/qr_display_fw/src/static_app.cpp'], cwd=ROOT, text=True, encoding='utf-8')
        for start, end in [('if (config.bindingPreview) {', '#if defined(QR2BUY_MERCHANT_DEVICE)')]:
            current = source.split(start, 1)[1].split(end, 1)[0]
            previous = baseline.split(start, 1)[1].split(end, 1)[0]
            self.assertEqual(current, previous)
        accepted = subprocess.check_output(['git', 'show', '202ec62:firmware/qr_display_fw/src/static_app.cpp'], cwd=ROOT, text=True, encoding='utf-8')
        for start, end in [('static bool drawQrCode', 'static const char* displayStatus'),
                           ('static void drawPaidScreen', 'static void drawStatusText'),
                           ('static void drawStatusScreen', 'static void renderConfig')]:
            self.assertEqual(source.split(start, 1)[1].split(end, 1)[0], accepted.split(start, 1)[1].split(end, 1)[0])

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
        self.assertIn('http.addHeader("x-firmware-version", "0.3.11")', source)
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
        for device in (1, 2, 3):
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

    def test_device3_has_explicit_identity_and_no_inherited_upload_target(self):
        ini = configparser.ConfigParser(interpolation=None)
        ini.read(ROOT / 'platformio.ini')
        for environment, profile in [('esp32dev_spi_cs5_rst4_merchant_app', 1),
                                     ('esp32dev_spi_nocs_rst4_merchant_app', 2),
                                     ('esp32dev_spi_cs5_rst4_device3_merchant_app', 3)]:
            self.assertIn(f'-D QR2BUY_DEVICE_PROFILE={profile}', ini['env:' + environment]['build_flags'])
        p3 = ini['env:esp32dev_spi_cs5_rst4_device3_merchant_app']
        self.assertEqual(p3['upload_port'], 'REQUIRE_EXPLICIT_DEVICE3_PORT')
        self.assertEqual(p3['monitor_port'], 'REQUIRE_EXPLICIT_DEVICE3_PORT')
        self.assertIn('${env:esp32dev_spi_cs5_rst4_app.build_flags}', p3['build_flags'])
        # Real git ignore evaluation, including future device headers and public examples.
        for device in (1, 2, 3, 4):
            path = f'firmware/qr_display_fw/src/secrets.device{device}.h'
            self.assertEqual(subprocess.run(['git', 'check-ignore', '-q', path], cwd=ROOT).returncode, 0)
            example = path.replace('.h', '.example.h')
            self.assertEqual(subprocess.run(['git', 'check-ignore', '-q', example], cwd=ROOT).returncode, 1)

    def test_real_compiler_rejects_cross_device_identity_and_unknown_profile(self):
        # Compile the actual identity-selection/assertion code with synthetic credentials.
        # Never read or copy real device headers into this host fixture.
        source = (ROOT / 'src/static_app.cpp').read_text(encoding='utf-8')
        selection = source[source.index('#if QR2BUY_DEVICE_PROFILE == 1'):source.index('#elif __has_include')]
        selection = selection.rsplit('#endif', 1)[0] + '#endif\n'
        checks = source[source.index('constexpr bool sameIdentity'):source.index('#ifndef QR2BUY_DEVICE_ID')]
        checks = checks.rsplit('#endif', 1)[0]
        build = ROOT / '.pio/identity-host'
        build.mkdir(parents=True, exist_ok=True)
        for device in (1, 2, 3):
            (build / f'secrets.device{device}.h').write_text(
                f'#define QR2BUY_DEVICE_ID "QR2B-00000{device}"\n'
                '#define QR2BUY_DEVICE_SECRET "' + 'a' * 64 + '"\n')
        fixture = build / 'identity.cpp'
        vcvars = Path('C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat')
        def compile_profile(profile, suffix=''):
            fixture.write_text(f'#define QR2BUY_DEVICE_PROFILE {profile}\n' + selection + suffix + checks + '\nint main() {}\n')
            if os.name == 'nt':
                script = build / 'compile.cmd'
                script.write_text(f'@echo off\ncall "{vcvars}" >nul\ncl /nologo /EHsc /std:c++14 /c identity.cpp\n')
                result = subprocess.run(['cmd.exe', '/d', '/c', script.name], cwd=build, capture_output=True)
                script.unlink()
            else:
                result = subprocess.run(['c++', '-std=c++14', '-c', 'identity.cpp'], cwd=build, capture_output=True)
            return result.returncode
        for profile in (1, 2, 3):
            self.assertEqual(compile_profile(profile), 0)
            self.assertNotEqual(compile_profile(profile, '#undef QR2BUY_DEVICE_ID\n#define QR2BUY_DEVICE_ID "QR2B-999999"\n'), 0)
        self.assertNotEqual(compile_profile(0), 0)

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
