import { createState, step, summary } from './demo-data.js';
import { initDemo } from './demo.js';

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
