import QRCode from 'qrcode';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = new URL('../../docs/exports/device-qrs/', import.meta.url);
await mkdir(output, { recursive: true });
for (const deviceId of ['QR2B-000001', 'QR2B-000002']) {
  const url = `https://qr2buy.com/device/${deviceId}`;
  const options = { errorCorrectionLevel: 'M', margin: 4, width: 900, color: { dark: '#000000', light: '#ffffff' } };
  const qr = await QRCode.toString(url, { ...options, type: 'svg' });
  const nested = qr.replace('<svg ', '<svg x="0" y="0" width="900" height="900" ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="55mm" viewBox="0 0 900 990"><title>${deviceId}</title><rect width="900" height="990" fill="white"/>${nested}<text x="450" y="958" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" fill="black">${deviceId}</text></svg>\n`;
  await writeFile(new URL(`${deviceId}-device-qr.svg`, output), svg);
  await QRCode.toFile(fileURLToPath(new URL(`${deviceId}-device-qr.png`, output)), url, options);
  console.log(`${deviceId}: ${url}; PNG 900x900; SVG 50x55mm; quiet zone 4 modules`);
}
