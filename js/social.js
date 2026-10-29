// Redes sociales de Emergycl.
// Complete aquí los enlaces: lo que quede vacío no aparece en la página.

export const SOCIAL = {
  whatsapp: {
    number: '', // con indicativo o celular colombiano de 10 dígitos, p. ej. '3001234567' o '+57 300 123 4567'
    message: 'Hola, quiero ver una demostración de Emergycl.',
  },
  youtube: {
    channel: '', // p. ej. 'https://www.youtube.com/@emergycl'
    videoId: '', // id o enlace del video de la demo, p. ej. 'dQw4w9WgXcQ' o 'https://youtu.be/dQw4w9WgXcQ'
  },
  instagram: '', // p. ej. 'https://www.instagram.com/emergycl'
  facebook: '', // p. ej. 'https://www.facebook.com/emergycl'
  linkedin: '', // opcional
};

// Número para wa.me: solo dígitos y con indicativo de país (57 si es un celular colombiano)
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  if (digits.startsWith('00')) return digits.slice(2);
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

export function whatsappLink(number, message = '') {
  const phone = normalizePhone(number);
  if (!phone) return '';
  return message ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/${phone}`;
}

// Acepta el id o cualquier enlace habitual de YouTube y devuelve el id de 11 caracteres
export function youtubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : '';
}

export function youtubeEmbed(id) {
  const v = youtubeId(id);
  return v ? `https://www.youtube-nocookie.com/embed/${v}?autoplay=1&rel=0` : '';
}

export function youtubeThumb(id) {
  const v = youtubeId(id);
  return v ? `https://i.ytimg.com/vi/${v}/hqdefault.jpg` : '';
}

const HOSTS = {
  youtube: /(^|\.)youtube\.com$/,
  instagram: /(^|\.)instagram\.com$/,
  facebook: /(^|\.)(facebook\.com|fb\.com)$/,
  linkedin: /(^|\.)linkedin\.com$/,
};

// Solo enlaces https a la red que corresponde; cualquier otra cosa se descarta
export function safeProfile(network, url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && HOSTS[network]?.test(u.hostname) ? u.href : '';
  } catch {
    return '';
  }
}

// Lista ordenada de redes con enlace válido, lista para pintar
export function socialLinks(cfg = SOCIAL) {
  const out = [];
  const wa = whatsappLink(cfg.whatsapp?.number, cfg.whatsapp?.message);
  if (wa) out.push({ id: 'whatsapp', label: 'WhatsApp', url: wa });
  const yt = safeProfile('youtube', cfg.youtube?.channel);
  if (yt) out.push({ id: 'youtube', label: 'YouTube', url: yt });
  for (const [id, label] of [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn']]) {
    const url = safeProfile(id, cfg[id]);
    if (url) out.push({ id, label, url });
  }
  return out;
}
