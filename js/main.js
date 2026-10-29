import { createState, step, summary } from './demo-data.js';
import { initDemo } from './demo.js';
import { SOCIAL, socialLinks, whatsappLink } from './social.js';

// Correo que recibe las solicitudes del formulario de contacto
export const CONTACT_EMAIL = 'contacto@emergycl.co';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* Reloj de Bogotá */
const clock = document.getElementById('clock-time');
const fmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const tickClock = () => { if (clock) clock.textContent = fmt.format(new Date()); };
tickClock();
setInterval(tickClock, 1000);

/* Menú móvil */
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav-toggle');
toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav?.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

/* Animación de la topología: Esc la pausa; respeta "reducir movimiento" */
const topo = document.getElementById('topo');
let paused = reduceMotion.matches;
const applyPause = () => {
  if (!topo?.pauseAnimations) return;
  paused ? topo.pauseAnimations() : topo.unpauseAnimations();
  document.body.classList.toggle('paused', paused);
};
applyPause();
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const t = e.target;
  if (t instanceof HTMLElement && t.matches('input, textarea, select')) return;
  paused = !paused;
  applyPause();
});

/* Demo: un segundo simulado por segundo real */
const state = createState(Date.now() % 1000);
const demo = initDemo(state);
const heroStatus = document.getElementById('hero-status');
const heroDot = document.getElementById('hero-dot');
const funzaLink = document.querySelector('[data-machine="planta-funza-gw"]');
const funzaSite = document.getElementById('site-funza');
const funzaPacket = document.querySelector('.pk-funza');

function render(fresh) {
  const s = summary(state);
  const onBattery = state.ups.source === 'bateria';
  if (heroStatus) {
    heroStatus.textContent = s.offline
      ? `${s.online} de ${s.total} equipos en línea en la demo · Planta Funza sin conexión`
      : onBattery
        ? `${s.online} de ${s.total} equipos en línea · UPS de Clínica Norte en batería`
        : `${s.online} de ${s.total} equipos en línea en la demo`;
    heroDot.className = `dot ${s.offline ? 'bad' : onBattery ? 'warn' : ''}`;
  }
  const funzaDown = !state.machines.find((m) => m.id === 'planta-funza-gw').online;
  funzaLink?.classList.toggle('down', funzaDown);
  funzaSite?.classList.toggle('down', funzaDown);
  funzaPacket?.classList.toggle('hidden', funzaDown);
  demo.update(fresh);
}

render([]);
setInterval(() => render(step(state)), 1000);

/* Formulario de contacto: abre el correo con la solicitud lista */
const form = document.getElementById('contact-form');
const status = document.getElementById('cf-status');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = form.elements.nombre;
  const email = form.elements.correo;
  let bad = null;
  for (const f of [name, email]) f.removeAttribute('aria-invalid');
  if (!String(data.get('nombre')).trim()) bad = name;
  else if (!email.checkValidity() || !String(data.get('correo')).trim()) bad = email;
  if (bad) {
    bad.setAttribute('aria-invalid', 'true');
    bad.focus();
    status.className = 'form-status error';
    status.textContent = bad === name ? 'Escriba su nombre para saber a quién contactar.' : 'Revise el correo: lo necesitamos para enviarle la invitación.';
    return;
  }
  const body = [
    `Nombre: ${data.get('nombre')}`,
    `Empresa: ${data.get('empresa') || '—'}`,
    `Correo: ${data.get('correo')}`,
    `Sedes o equipos: ${data.get('sedes')}`,
    '',
    String(data.get('mensaje') || ''),
  ].join('\n');
  const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Demostración de Emergycl')}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
  status.className = 'form-status';
  status.textContent = `Abrimos su correo con la solicitud lista. Si no se abrió, escríbanos a ${CONTACT_EMAIL}.`;
});

/* Redes sociales y WhatsApp: solo aparece lo que está configurado en social.js */
const ICONS = {
  whatsapp: '<path d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v6l5-3z" fill="currentColor"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/>',
  facebook: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 20.5v-7h2.4M13 13.5h-2.2M13 13.5V11c0-1.4.8-2.2 2.2-2.2h1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5v6M8 7.6v.1M11.5 16.5v-6M11.5 13c0-1.5 1-2.5 2.3-2.5s2.2.9 2.2 2.5v3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};

function renderSocial() {
  const links = socialLinks(SOCIAL);
  const ns = 'http://www.w3.org/2000/svg';
  for (const ul of document.querySelectorAll('[data-social]')) {
    const skip = (ul.dataset.socialSkip || '').split(',');
    ul.replaceChildren(...links.filter((l) => !skip.includes(l.id)).map((l) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.dataset.network = l.id;
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = ICONS[l.id];
      a.append(svg, l.label);
      li.append(a);
      return li;
    }));
  }
  const wa = whatsappLink(SOCIAL.whatsapp.number, SOCIAL.whatsapp.message);
  for (const id of ['wa-float', 'contact-wa']) {
    const el = document.getElementById(id);
    if (el && wa) { el.href = wa; el.hidden = false; }
  }
  const foot = document.getElementById('foot-social');
  const alt = document.getElementById('contact-alt');
  if (foot) foot.hidden = links.length === 0;
  if (alt) alt.hidden = links.length === 0;
}
renderSocial();
