// Revisa el HTML del sitio: recursos que existen, anclas válidas, accesibilidad básica y dominio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const site = fileURLToPath(new URL('../site/', import.meta.url));
const html = readFileSync(join(site, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const attrs = (name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]+)"`, 'g'))].map((m) => m[1]);

test('los ids no se repiten', () => {
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = all.filter((id, i) => all.indexOf(id) !== i);
  assert.deepEqual(dup, []);
});

test('todos los enlaces internos (#) apuntan a un id existente', () => {
  const missing = attrs('href').filter((h) => h.startsWith('#') && h.length > 1).filter((h) => !ids.has(h.slice(1)));
  assert.deepEqual(missing, []);
});

test('los recursos locales referenciados existen', () => {
  const locals = [...attrs('href'), ...attrs('src'), ...attrs('poster')].filter((u) => !/^(https?:|#|mailto:)/.test(u) && u !== '');
  const optional = new Set(['assets/video/demo.mp4']); // el video es opcional
  const missing = locals.filter((u) => !optional.has(u) && !existsSync(join(site, u)));
  assert.deepEqual(missing, []);
});

test('aria-controls, aria-labelledby y label[for] apuntan a ids existentes', () => {
  const refs = [...attrs('aria-controls'), ...attrs('aria-labelledby'), ...attrs('for')];
  assert.deepEqual(refs.filter((r) => !ids.has(r)), []);
});

test('cada pestaña del panel controla un tabpanel', () => {
  const panels = [...html.matchAll(/role="tabpanel" id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(panels.length, 6);
  for (const p of panels) assert.match(html, new RegExp(`aria-controls="${p}"`));
});

test('metadatos básicos: idioma, título, descripción y viewport', () => {
  assert.match(html, /<html lang="es-CO">/);
  assert.match(html, /<title>[^<]{10,}<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{50,}">/);
  assert.match(html, /name="viewport"/);
});

test('hay un solo h1', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
});

test('el dominio de GitHub Pages es emergycl.co', () => {
  assert.equal(readFileSync(join(site, 'CNAME'), 'utf8').trim(), 'emergycl.co');
  assert.match(html, /<link rel="canonical" href="https:\/\/emergycl.co\/">/);
});

test('los módulos JS importan archivos que existen', () => {
  for (const f of ['main.js', 'demo.js', 'demo-data.js']) {
    const src = readFileSync(join(site, 'js', f), 'utf8');
    for (const [, imp] of src.matchAll(/from '(\.\/[^']+)'/g)) {
      assert.ok(existsSync(join(site, 'js', imp)), `${f} importa ${imp}`);
    }
  }
});

test('el sitio no publica datos privados del hub', () => {
  const all = ['index.html', 'js/main.js', 'js/demo.js', 'js/demo-data.js'].map((f) => readFileSync(join(site, f), 'utf8')).join('\n');
  assert.doesNotMatch(all, /ADMIN_TOKEN|10\.147\.|hubups\.|@gmail\.com/);
});
