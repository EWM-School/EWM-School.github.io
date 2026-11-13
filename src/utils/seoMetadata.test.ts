import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  injectAbsoluteSocialMetadata,
  resolvePublicOrigin,
} from './seoMetadata.ts';

describe('seoMetadata & PWA icon compliance', () => {
  it('resolves Cloud Run public HTTPS origin from x-forwarded-host or host headers', () => {
    const origin = resolvePublicOrigin(
      {
        host: 'ais-pre-n3c3a2hbrnpukxmfnpropw-481607545996.us-west2.run.app',
        'x-forwarded-proto': 'http',
      },
      undefined
    );
    assert.equal(
      origin,
      'https://ais-pre-n3c3a2hbrnpukxmfnpropw-481607545996.us-west2.run.app'
    );
  });

  it('uses APP_URL fallback when requested via localhost', () => {
    const origin = resolvePublicOrigin(
      { host: 'localhost:3000' },
      'https://ais-pre-n3c3a2hbrnpukxmfnpropw-481607545996.us-west2.run.app/'
    );
    assert.equal(
      origin,
      'https://ais-pre-n3c3a2hbrnpukxmfnpropw-481607545996.us-west2.run.app'
    );
  });

  it('rewrites index.html OpenGraph, Twitter Card, Canonical, and Schema.org image URLs into absolute HTTPS URLs', () => {
    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
    const origin = 'https://ais-pre-n3c3a2hbrnpukxmfnpropw-481607545996.us-west2.run.app';
    const result = injectAbsoluteSocialMetadata(indexHtml, origin, '/');

    assert.match(
      result,
      new RegExp(
        `<meta property="og:image" content="${origin}/og-ewm-cover-1200x630\\.png" />`
      )
    );
    assert.match(
      result,
      new RegExp(
        `<meta property="og:image:secure_url" content="${origin}/og-ewm-cover-1200x630\\.png" />`
      )
    );
    assert.match(
      result,
      new RegExp(
        `<meta\\s+property="og:image"\\s+content="${origin}/assets/aistudio/WhatsApp_Image_2026-11-07_at_17\\.55\\.16_2916485b\\.jpeg"\\s*/>`
      )
    );
    assert.match(
      result,
      new RegExp(
        `<meta name="twitter:image" content="${origin}/og-ewm-cover-1200x630\\.png" />`
      )
    );
    assert.match(
      result,
      new RegExp(`<meta property="og:url" content="${origin}/" />`)
    );
    assert.match(
      result,
      new RegExp(`<link rel="canonical" href="${origin}/" />`)
    );
    assert.match(
      result,
      new RegExp(`"image": "${origin}/og-ewm-cover-1200x630\\.png"`)
    );
  });

  it('verifies Web App Manifest and required PNG icon files exist and meet PWA & iOS/iPadOS rules', () => {
    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');

    // Verify iOS / iPadOS specific meta tags & viewport-fit=cover
    assert.match(
      indexHtml,
      /<meta[\s\S]*?name="viewport"[\s\S]*?content="[^"]*viewport-fit=cover[^"]*"/i
    );
    assert.match(indexHtml, /<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"\s*\/>/i);
    assert.match(
      indexHtml,
      /<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="default"\s*\/>/i
    );
    assert.match(indexHtml, /<meta\s+name="apple-mobile-web-app-title"\s+content="EWM"\s*\/>/i);
    assert.match(indexHtml, /<meta\s+name="format-detection"\s+content="telephone=no"\s*\/>/i);

    // Verify multi-size apple-touch-icon declarations for iPhone & iPad
    assert.match(indexHtml, /<link\s+rel="apple-touch-icon"\s+href="\/apple-touch-icon\.png"\s*\/>/i);
    for (const size of ['76x76', '120x120', '152x152', '167x167', '180x180']) {
      assert.match(
        indexHtml,
        new RegExp(
          `<link\\s+rel="apple-touch-icon"\\s+sizes="${size}"\\s+href="/apple-touch-icon-${size}\\.png"\\s*/>`,
          'i'
        )
      );
    }
    assert.match(
      indexHtml,
      /<link\s+rel="apple-touch-icon-precomposed"\s+href="\/apple-touch-icon-precomposed\.png"\s*\/>/i
    );

    const manifestRaw = fs.readFileSync(
      path.resolve('public/manifest.webmanifest'),
      'utf-8'
    );
    const manifest = JSON.parse(manifestRaw) as {
      id: string;
      name: string;
      short_name: string;
      description: string;
      start_url: string;
      scope: string;
      display: string;
      orientation: string;
      background_color: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
    };

    assert.equal(manifest.id, './');
    assert.equal(manifest.name, 'EWM - Keep practicing');
    assert.equal(manifest.short_name, 'EWM');
    assert.ok(manifest.short_name.length <= 12);
    assert.ok(manifest.description.length >= 40);
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.orientation, 'any');
    assert.equal(manifest.background_color, '#F6F4EF');
    assert.equal(manifest.theme_color, '#28665E');

    const anyIcons = manifest.icons.filter((i) => i.purpose === 'any');
    const maskableIcons = manifest.icons.filter((i) => i.purpose === 'maskable');
    assert.ok(anyIcons.some((i) => i.sizes === '180x180'));
    assert.ok(anyIcons.some((i) => i.sizes === '192x192'));
    assert.ok(anyIcons.some((i) => i.sizes === '512x512'));
    assert.ok(maskableIcons.some((i) => i.sizes === '192x192'));
    assert.ok(maskableIcons.some((i) => i.sizes === '512x512'));
    assert.equal(maskableIcons.length, 2);

    const requiredPublicAssets = [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'apple-touch-icon.png',
      'apple-touch-icon-precomposed.png',
      'apple-touch-icon-76x76.png',
      'apple-touch-icon-120x120.png',
      'apple-touch-icon-152x152.png',
      'apple-touch-icon-167x167.png',
      'apple-touch-icon-180x180.png',
      'pwa-192x192.png',
      'pwa-512x512.png',
      'pwa-maskable-192x192.png',
      'pwa-maskable-512x512.png',
      'og-ewm-cover-1200x630.png',
      'assets/aistudio/WhatsApp_Image_2026-11-07_at_17.55.16_2916485b.jpeg',
    ];

    for (const relAsset of requiredPublicAssets) {
      const fullPath = path.resolve('public', relAsset);
      assert.ok(fs.existsSync(fullPath), `Expected asset to exist: ${relAsset}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 100, `Expected non-empty asset: ${relAsset}`);
    }
  });
});
