/**
 * Generate iOS splash screen PNGs using Canvas API (node-canvas-free approach)
 * Since we don't want to install sharp/canvas, create simple HTML-based splash placeholders
 * These will be SVG-based PNGs with the IBZ branding colors
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const splashDir = join(import.meta.dirname, '..', 'public', 'splash');
mkdirSync(splashDir, { recursive: true });

const screens = [
  { name: 'iphone14promax', w: 1290, h: 2796 },
  { name: 'iphone14pro', w: 1179, h: 2556 },
  { name: 'iphone13promax', w: 1284, h: 2778 },
  { name: 'iphone13pro', w: 1170, h: 2532 },
  { name: 'iphonex', w: 1125, h: 2436 },
  { name: 'ipad', w: 1536, h: 2048 },
  { name: 'ipadpro10_5', w: 1668, h: 2224 },
  { name: 'ipadpro12_9', w: 2048, h: 2732 },
];

function generateSplashSVG(w, h) {
  const logoSize = Math.min(w, h) * 0.2;
  const cx = w / 2;
  const cy = h / 2 - logoSize * 0.3;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A0F1A"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="rgba(59,130,246,0.12)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#e5e7eb"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#9ca3af"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${logoSize * 0.5}" font-weight="800" fill="url(#textGrad)" letter-spacing="0.08em">IBZ</text>
  <text x="${cx}" y="${cy + logoSize * 0.5}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${logoSize * 0.15}" font-weight="600" fill="#94A3B8" letter-spacing="0.2em" text-transform="uppercase">INSTITUTO BARBER ZAC</text>
</svg>`;
}

for (const screen of screens) {
  const svg = generateSplashSVG(screen.w, screen.h);
  // Write as SVG first (browsers handle SVG splash screens)
  // For PNG we would need canvas, so let's write SVGs as a starting point
  // The recommended approach for production is to use a tool like pwa-asset-generator
  writeFileSync(join(splashDir, `${screen.name}.svg`), svg);
  console.log(`✓ ${screen.name}.svg (${screen.w}x${screen.h})`);
}

console.log('\n✅ Splash screens generated! For production PNG splash screens, use:');
console.log('   npx pwa-asset-generator public/icons/ibz-main-420.png public/splash --splash-only --background "#0A0F1A"');
