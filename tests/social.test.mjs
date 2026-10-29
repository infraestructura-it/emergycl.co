import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, whatsappLink, youtubeId, youtubeEmbed, youtubeThumb, safeProfile, socialLinks } from '../js/social.js';

test('normalizePhone agrega el 57 a celulares colombianos de 10 dígitos', () => {
  assert.equal(normalizePhone('300 123 4567'), '573001234567');
  assert.equal(normalizePhone('+57 300 123 4567'), '573001234567');
  assert.equal(normalizePhone('0057-300-123-4567'), '573001234567');
  assert.equal(normalizePhone('+1 (415) 555-0100'), '14155550100');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone('123'), '');
});

test('whatsappLink arma el enlace wa.me con el mensaje codificado', () => {
  assert.equal(whatsappLink('3001234567'), 'https://wa.me/573001234567');
  assert.equal(whatsappLink('3001234567', 'Hola, ¿demo?'), 'https://wa.me/573001234567?text=Hola%2C%20%C2%BFdemo%3F');
  assert.equal(whatsappLink('', 'Hola'), '');
});

test('youtubeId acepta el id o los enlaces habituales', () => {
  const id = 'dQw4w9WgXcQ';
  for (const s of [id, `https://youtu.be/${id}`, `https://www.youtube.com/watch?v=${id}&t=10`, `https://www.youtube.com/embed/${id}`, `https://youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}`]) {
    assert.equal(youtubeId(s), id, s);
  }
  assert.equal(youtubeId('https://www.youtube.com/@emergycl'), '');
  assert.equal(youtubeId(''), '');
});

test('el video de YouTube se incrusta en modo de privacidad mejorada', () => {
  assert.equal(youtubeEmbed('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
  assert.equal(youtubeThumb('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(youtubeEmbed('no es un video'), '');
});

test('safeProfile solo acepta https hacia la red correcta', () => {
  assert.equal(safeProfile('instagram', 'https://www.instagram.com/emergycl'), 'https://www.instagram.com/emergycl');
  assert.equal(safeProfile('facebook', 'https://fb.com/emergycl'), 'https://fb.com/emergycl');
  assert.equal(safeProfile('instagram', 'http://www.instagram.com/emergycl'), '');
  assert.equal(safeProfile('instagram', 'https://instagram.com.evil.co/x'), '');
  assert.equal(safeProfile('facebook', 'javascript:alert(1)'), '');
  assert.equal(safeProfile('youtube', ''), '');
});

test('socialLinks omite lo vacío y respeta el orden', () => {
  assert.deepEqual(socialLinks({ whatsapp: {}, youtube: {} }), []);
  const links = socialLinks({
    whatsapp: { number: '3001234567', message: 'Hola' },
    youtube: { channel: 'https://www.youtube.com/@emergycl' },
    instagram: 'https://www.instagram.com/emergycl',
    facebook: 'https://www.facebook.com/emergycl',
    linkedin: '',
  });
  assert.deepEqual(links.map((l) => l.id), ['whatsapp', 'youtube', 'instagram', 'facebook']);
  assert.match(links[0].url, /^https:\/\/wa\.me\/573001234567\?text=Hola$/);
});
