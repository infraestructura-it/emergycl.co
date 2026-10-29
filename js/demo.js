// Interfaz de la demo del panel (DOM). La lógica y los datos están en demo-data.js.
import { SOCIAL, youtubeEmbed, youtubeThumb } from './social.js';
import { answer, runCommand, sparkPath, summary, upsAlerts, formatDuration, TERMINAL_HELP } from './demo-data.js';

const $ = (sel, root = document) => root.querySelector(sel);
const ALERT_NAMES = {
  en_bateria: 'En batería',
  bateria_baja: 'Batería baja',
  autonomia_baja: 'Autonomía baja',
  carga_alta: 'Carga alta',
  carga_critica: 'Carga crítica',
  temperatura: 'Temperatura alta',
};

export function initDemo(state) {
  const root = $('#demo-live');
  if (!root) return { update() {} };

  setupTabs($('.app-nav', root));
  const cards = buildMachines(state);
  setupChat(state);
  setupTerminal(state);
  setupVideo();

  let tgCount = 0;

  function update(fresh) {
    const s = summary(state);
    $('#c-equipos').textContent = `${s.online}/${s.total}`;

    for (const m of state.machines) {
      const c = cards.get(m.id);
      c.el.classList.toggle('off', !m.online);
      c.dot.className = `dot ${m.online ? '' : 'bad'}`;
      c.state.textContent = m.online ? 'En línea' : 'Sin conexión';
      c.state.className = m.online ? '' : 'bad';
      c.latency.textContent = m.online ? `${m.latency} ms` : '—';
      c.btn.disabled = !m.online;
    }

    renderUps(state);
    renderDc(state);

    for (const ev of fresh.slice().reverse()) {
      addActivity(ev);
      if (ev.channel === 'telegram') {
        addTelegram(ev);
        tgCount += 1;
      }
    }
    $('#c-alertas').textContent = String(tgCount);
  }

  return { update };
}

/* ---------- Pestañas (patrón ARIA tabs) ---------- */
function setupTabs(list) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const select = (tab, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  };
  list.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) select(tab);
  });
  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (e.key in keys) {
      e.preventDefault();
      select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      select(tabs[0], true);
    } else if (e.key === 'End') {
      e.preventDefault();
      select(tabs[tabs.length - 1], true);
    }
  });
  list.selectTab = (id) => select(document.getElementById(id));
}

/* ---------- Equipos ---------- */
function buildMachines(state) {
  const wrap = $('#machines');
  const cards = new Map();
  for (const m of state.machines) {
    const el = document.createElement('article');
    el.className = 'machine';
    el.innerHTML = `
      <div class="machine-head"><span class="dot"></span><span class="machine-name"></span></div>
      <div class="machine-client"></div>
      <div class="tags"></div>
      <div class="machine-meta"><span data-k="state">En línea</span><span data-k="lat"></span></div>
      <button type="button" class="connect"></button>`;
    $('.machine-name', el).textContent = m.name;
    $('.machine-client', el).textContent = `${m.client} · ${m.device}`;
    $('.tags', el).append(...m.services.map((sv) => Object.assign(document.createElement('span'), { textContent: sv })));
    const btn = $('.connect', el);
    btn.textContent = m.os === 'windows' ? 'Abrir escritorio remoto' : 'Abrir terminal';
    btn.addEventListener('click', () => {
      if (m.os === 'windows') {
        openChatWith(`Abriría la pantalla de ${m.name} (${m.client}) por WebRTC directo con el agente 1.1.0. En la demo no hay un escritorio real detrás; pídanos la demostración en vivo para verlo.`);
      } else {
        $('#term-machine').value = m.id;
        $('#term-machine').dispatchEvent(new Event('change'));
        $('.app-nav').selectTab('t-term');
        $('#term-input').focus();
      }
    });
    wrap.append(el);
    cards.set(m.id, {
      el,
      btn,
      dot: $('.dot', el),
      state: $('[data-k="state"]', el),
      latency: $('[data-k="lat"]', el),
    });
  }
  $('#activity').innerHTML = '<li class="empty">Los eventos aparecen aquí a medida que ocurren.</li>';
  return cards;
}

function stamp(ev) {
  const d = new Date(Date.now());
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function addActivity(ev) {
  const list = $('#activity');
  $('.empty', list)?.remove();
  const li = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = stamp(ev);
  const text = document.createElement('span');
  text.textContent = ev.text.replace(/\n/g, ' · ');
  li.append(time, text);
  list.prepend(li);
  while (list.children.length > 25) list.lastChild.remove();
}

function addTelegram(ev) {
  const feed = $('#tg-feed');
  $('.empty', feed)?.remove();
  const li = document.createElement('li');
  li.className = 'new';
  li.textContent = ev.text;
  const time = document.createElement('time');
  time.textContent = stamp(ev);
  li.append(time);
  feed.prepend(li);
  while (feed.children.length > 30) feed.lastChild.remove();
}

/* ---------- UPS ---------- */
function renderUps(state) {
  const u = state.ups;
  const alerts = upsAlerts(u);
  const onBattery = u.source === 'bateria';
  $('#ups-lcd').classList.toggle('alarm', onBattery);
  $('#ups-source').textContent = onBattery ? 'En batería' : 'Red eléctrica';
  $('#f-ups').hidden = !onBattery;
  $('#ups-readings').innerHTML = [
    reading('Batería', u.battery, '%', u.battery < 30),
    reading('Autonomía', u.runtimeMin, 'min', u.runtimeMin < 10),
    reading('Carga de salida', u.load, '%', u.load >= 80),
    reading('Entrada', u.inputV, 'V', onBattery),
    reading('Salida', u.outputV, 'V'),
    reading('Temperatura', u.tempC, '°C', u.tempC >= 40),
  ].join('');
  $('#ups-spark').setAttribute('d', sparkPath(state.history.battery, 300, 66, 0, 100));
  $('#ups-batt-now').textContent = `${u.battery} %`;
  $('#ups-alarms').innerHTML = alerts.length
    ? alerts.map((a) => `<li>${ALERT_NAMES[a]}</li>`).join('')
    : '<li class="none">Sin alarmas</li>';
}

function renderDc(state) {
  const d = state.dc;
  $('#dc-readings').innerHTML = [
    reading('Temperatura', d.tempC, '°C', d.tempC >= 27),
    reading('Humedad', d.humidity, '%'),
    reading('Monóxido (CO)', d.coPpm, 'ppm'),
    `<div class="${d.doorOpen ? 'warn' : ''}"><dt>Puerta</dt><dd>${d.doorOpen ? 'Abierta' : 'Cerrada'}</dd></div>`,
  ].join('');
  $('#dc-spark').setAttribute('d', sparkPath(state.history.dcTemp, 300, 66, 20, 26));
  $('#dc-temp-now').textContent = `${d.tempC} °C`;
  $('#dc-phases').innerHTML = d.phases
    .map((p, i) => `<tr><th scope="row">L${i + 1}</th><td>${p.v.toFixed(1)} V</td><td>${p.a.toFixed(1)} A</td></tr>`)
    .join('');
}

function reading(label, value, unit, warn = false) {
  return `<div class="${warn ? 'warn' : ''}"><dt>${label}</dt><dd>${value}<small>${unit}</small></dd></div>`;
}

/* ---------- Asistente IA ---------- */
let chatState;
function setupChat(state) {
  chatState = state;
  const form = $('#chat-form');
  const input = $('#chat-input');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
    input.value = '';
  });
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) ask(b.textContent);
  });
}

function ask(text) {
  const q = text.trim();
  if (!q) return;
  pushMsg('me', q);
  const res = answer(q, chatState);
  setTimeout(() => {
    const li = pushMsg('bot', res.text);
    if (res.action) {
      const box = document.createElement('div');
      box.className = 'approve';
      box.innerHTML = `<p>Acción pendiente de aprobación · ${res.action.machine}</p>
        <button type="button" class="yes">Aprobar</button><button type="button" class="no">Rechazar</button>`;
      li.append(box);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const ok = b.classList.contains('yes');
        box.innerHTML = `<p>${ok ? 'Aprobada por usted' : 'Rechazada por usted'} · queda registrada en la actividad</p>`;
        if (ok) setTimeout(() => pushMsg('bot', 'Listo: Node-RED se reinició y responde en el puerto 1880 (3,2 s). El resultado quedó en la actividad de la máquina.'), 900);
      });
    }
  }, 450);
}

function pushMsg(who, text) {
  const chat = $('#chat');
  const li = document.createElement('li');
  li.className = `msg ${who}`;
  li.textContent = text;
  chat.append(li);
  chat.scrollTop = chat.scrollHeight;
  return li;
}

function openChatWith(text) {
  $('.app-nav').selectTab('t-ia');
  pushMsg('bot', text);
}

/* ---------- Terminal ---------- */
function setupTerminal(state) {
  const sel = $('#term-machine');
  const out = $('#term-out');
  const input = $('#term-input');
  const prompt = $('#term-prompt');
  const linux = state.machines.filter((m) => m.os === 'linux' && m.id !== 'sede-medellin-sw');
  sel.innerHTML = linux.map((m) => `<option value="${m.id}">${m.name} · ${m.client}</option>`).join('');
  const current = () => state.machines.find((m) => m.id === sel.value);
  const greet = () => {
    const m = current();
    prompt.textContent = `soporte@${m.id}:~$`;
    out.textContent = `Conectado a ${m.id} por SSH privado (sin puerto público).\nComandos de la demo: ${TERMINAL_HELP.join(', ')}\n`;
  };
  sel.addEventListener('change', greet);
  greet();
  $('#term').addEventListener('click', () => input.focus());
  $('#term-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const m = current();
    const cmd = input.value;
    input.value = '';
    if (cmd.trim() === 'clear') {
      out.textContent = '';
      return;
    }
    if (!m.online) {
      out.textContent += `${prompt.textContent} ${cmd}\nConexión perdida: la máquina está sin conexión desde hace ${formatDuration(state.elapsed - (state.flags.drop || state.elapsed))}.\n`;
    } else {
      out.textContent += `${prompt.textContent} ${cmd}\n${runCommand(cmd, m, state)}\n`;
    }
    out.scrollTop = out.scrollHeight;
  });
}

/* ---------- Video opcional ---------- */
// Si hay un video de YouTube en social.js se usa ese; si no, assets/video/demo.mp4 si existe.
// Sin ninguno de los dos, solo se ve la demo en vivo.
function setupVideo() {
  const video = $('#demo-video-el');
  const modes = $('#demo-modes');
  if (!video || !modes) return;
  const embed = youtubeEmbed(SOCIAL.youtube.videoId);

  if (embed) {
    video.remove();
    const yt = $('#demo-yt');
    yt.hidden = false;
    const thumb = $('#demo-yt-thumb');
    thumb.addEventListener('error', () => { thumb.hidden = true; }, { once: true });
    thumb.src = youtubeThumb(SOCIAL.youtube.videoId);
    $('#demo-yt-play').addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = embed;
      frame.title = 'Video de la demo de Emergycl';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      $('#demo-yt-play').replaceWith(frame);
    }, { once: true });
    modes.hidden = false;
  } else {
    video.addEventListener('loadedmetadata', () => { modes.hidden = false; }, { once: true });
  }

  const live = $('#mode-live');
  const vid = $('#mode-video');
  const pick = (isVideo) => {
    live.setAttribute('aria-selected', String(!isVideo));
    vid.setAttribute('aria-selected', String(isVideo));
    $('#demo-live').hidden = isVideo;
    $('#demo-video').hidden = !isVideo;
    if (!isVideo) {
      if (video.isConnected) video.pause();
      const frame = $('#demo-yt iframe');
      if (frame) frame.src = frame.src; // detiene la reproducción
    }
  };
  live.addEventListener('click', () => pick(false));
  vid.addEventListener('click', () => pick(true));
}
