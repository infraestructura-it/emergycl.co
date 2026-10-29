// Datos y lógica de la demo de Emergycl.
// Módulo puro (sin DOM): lo usa la página y lo prueban los tests de Node.
// Todo es simulado: ningún dato sale de un equipo real.

export const LOOP_SECONDS = 100;
export const GRACE_SECONDS = 8; // en el producto es 1 min; en la demo se acorta

// Guion de la demo (segundos dentro de cada vuelta de 100 s)
export const SCRIPT = {
  powerCutStart: 20,
  powerCutEnd: 45,
  funzaDropStart: 60,
  funzaDropEnd: 80,
};

export const MACHINES = [
  {
    id: 'clinica-norte-ups',
    name: 'Gateway sala eléctrica',
    client: 'Clínica Norte',
    os: 'linux',
    device: 'Raspberry Pi 4',
    services: ['SNMP UPS', 'SSH privado', 'Node-RED'],
    baseLatency: 38,
  },
  {
    id: 'dc-calle26-rack',
    name: 'Monitor de sitio',
    client: 'Datacenter Calle 26',
    os: 'linux',
    device: 'Raspberry Pi 4',
    services: ['Sensores', 'Cámara RTSP', 'SSH privado'],
    baseLatency: 21,
  },
  {
    id: 'oficina-usaquen-pc',
    name: 'PC recepción',
    client: 'Notaría Usaquén',
    os: 'windows',
    device: 'Windows 11 Pro',
    services: ['Escritorio remoto', 'Pantalla (agente 1.1.0)'],
    baseLatency: 44,
  },
  {
    id: 'planta-funza-gw',
    name: 'Gateway de planta',
    client: 'Alimentos Funza',
    os: 'linux',
    device: 'PC industrial',
    services: ['Node-RED', 'SSH privado', 'VNC'],
    baseLatency: 57,
  },
  {
    id: 'almacen-chapinero-nvr',
    name: 'Grabador de cámaras',
    client: 'Almacenes Chapinero',
    os: 'linux',
    device: 'NVR + Raspberry Pi',
    services: ['Panel NVR (https)', 'SSH privado'],
    baseLatency: 33,
  },
  {
    id: 'sede-medellin-sw',
    name: 'Switch principal',
    client: 'Clínica Norte',
    os: 'linux',
    device: 'Switch gestionable',
    services: ['SNMP interfaces'],
    baseLatency: 61,
  },
];

// Generador pseudoaleatorio con semilla (mulberry32): la demo es reproducible
export function createRng(seed = 7) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loopTime(elapsedSeconds) {
  const t = elapsedSeconds % LOOP_SECONDS;
  return t < 0 ? t + LOOP_SECONDS : t;
}

// Batería de la UPS según el guion: 100 % → descarga en el corte → recarga
export function batteryAt(t) {
  const { powerCutStart: a, powerCutEnd: b } = SCRIPT;
  const low = 100 - (b - a) * 2.6; // 35 %
  if (t < a) return 100;
  if (t < b) return round1(100 - (t - a) * 2.6);
  return round1(Math.min(100, low + (t - b) * 1.3));
}

export function upsAt(t, rng = Math.random) {
  const onBattery = t >= SCRIPT.powerCutStart && t < SCRIPT.powerCutEnd;
  const battery = batteryAt(t);
  const load = round1(onBattery ? 58 + rng() * 2 : 41 + rng() * 3);
  return {
    source: onBattery ? 'bateria' : 'red',
    battery,
    runtimeMin: Math.round(battery * 0.42),
    load,
    inputV: onBattery ? 0 : round1(119 + rng() * 3),
    outputV: round1(119.5 + rng() * 1.2),
    tempC: round1(29 + (onBattery ? 2.5 : 0) + rng() * 0.6),
  };
}

// Umbrales por defecto del producto para UPS
export function upsAlerts(ups) {
  const out = [];
  if (ups.source === 'bateria') out.push('en_bateria');
  if (ups.battery < 30) out.push('bateria_baja');
  if (ups.runtimeMin < 10) out.push('autonomia_baja');
  if (ups.load >= 95) out.push('carga_critica');
  else if (ups.load >= 80) out.push('carga_alta');
  if (ups.tempC >= 40) out.push('temperatura');
  return out;
}

export function datacenterAt(elapsed, rng = Math.random) {
  const temp = 22.6 + Math.sin(elapsed / 18) * 0.9 + rng() * 0.2;
  return {
    tempC: round1(temp),
    humidity: Math.round(46 + Math.cos(elapsed / 25) * 3 + rng()),
    coPpm: Math.round(2 + rng() * 2),
    doorOpen: loopTime(elapsed) >= 86 && loopTime(elapsed) < 92,
    phases: [0, 1, 2].map((i) => ({
      v: round1(120 + Math.sin(elapsed / 9 + i) * 1.4 + rng() * 0.3),
      a: round1([18.2, 16.9, 17.5][i] + rng() * 0.8),
    })),
  };
}

export function isOnline(machineId, t) {
  if (machineId !== 'planta-funza-gw') return true;
  return !(t >= SCRIPT.funzaDropStart && t < SCRIPT.funzaDropEnd);
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m} min ${r} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} h ${rm} min` : `${h} h`;
}

export function createState(seed = 7) {
  return {
    rng: createRng(seed),
    elapsed: 0,
    loop: 0,
    flags: {},
    events: [],
    history: { battery: [], dcTemp: [], load: [] },
    machines: MACHINES.map((m) => ({ ...m, online: true, latency: m.baseLatency })),
    ups: upsAt(0, () => 0.5),
    dc: datacenterAt(0, () => 0.5),
  };
}

const HISTORY_MAX = 60;

function pushHistory(arr, v) {
  arr.push(v);
  if (arr.length > HISTORY_MAX) arr.shift();
}

// Avanza la demo 1 segundo y devuelve los eventos nuevos
export function step(state) {
  state.elapsed += 1;
  const t = loopTime(state.elapsed);
  const loop = Math.floor(state.elapsed / LOOP_SECONDS);
  if (loop !== state.loop) {
    state.loop = loop;
    state.flags = {};
  }
  const rng = state.rng;
  const f = state.flags;
  const fresh = [];
  const emit = (type, channel, text, extra = {}) => {
    const ev = { at: state.elapsed, type, channel, text, ...extra };
    fresh.push(ev);
    state.events.unshift(ev);
  };

  state.ups = upsAt(t, rng);
  state.dc = datacenterAt(state.elapsed, rng);
  for (const m of state.machines) {
    m.online = isOnline(m.id, t);
    m.latency = m.online ? Math.round(m.baseLatency + rng() * 12) : null;
  }
  pushHistory(state.history.battery, state.ups.battery);
  pushHistory(state.history.load, state.ups.load);
  pushHistory(state.history.dcTemp, state.dc.tempC);

  // Corte de energía en Clínica Norte
  if (state.ups.source === 'bateria' && !f.cut) {
    f.cut = state.elapsed;
    emit('ups_bateria', 'telegram', '⚠️ UPS en batería\nClínica Norte · sala eléctrica\nBatería 100 % · autonomía 42 min');
  }
  if (f.cut && !f.diag && state.elapsed - f.cut >= 3) {
    f.diag = true;
    emit(
      'ia_diagnostico',
      'telegram',
      '🤖 Diagnóstico\nLa UPS pasó a batería y la entrada marca 0 V: es un corte de la red eléctrica, no una falla de la UPS. Los demás equipos de Clínica Norte siguen en línea. A este ritmo de consumo hay unos 30 min de respaldo.',
    );
  }
  if (f.cut && state.ups.source === 'red' && !f.restored) {
    f.restored = true;
    emit('ups_red', 'telegram', `✅ UPS volvió a la red\nClínica Norte · ${formatDuration(state.elapsed - f.cut)} en batería`);
  }

  // Desconexión de la planta de Funza
  const funza = state.machines.find((m) => m.id === 'planta-funza-gw');
  if (!funza.online && !f.drop) {
    f.drop = state.elapsed;
    emit('sin_latido', 'panel', 'Gateway de planta · Alimentos Funza dejó de enviar latidos (esperando tiempo de gracia)');
  }
  if (f.drop && !funza.online && !f.dropAlert && state.elapsed - f.drop >= GRACE_SECONDS) {
    f.dropAlert = true;
    emit('machine_offline', 'telegram', '🔴 Máquina sin conexión\nGateway de planta · Alimentos Funza\nÚltima IP 181.x.x.x');
  }
  if (f.drop && funza.online && !f.back) {
    f.back = true;
    emit('machine_online', 'telegram', `🟢 Máquina reconectada\nGateway de planta · Alimentos Funza\nEstuvo caída ${formatDuration(state.elapsed - f.drop)}`);
  }

  if (state.dc.doorOpen && !f.door) {
    f.door = true;
    emit('puerta', 'panel', 'Datacenter Calle 26 · apertura de puerta validada con huella (técnico: María G.)');
  }

  if (state.events.length > 40) state.events.length = 40;
  return fresh;
}

export function summary(state) {
  const online = state.machines.filter((m) => m.online).length;
  return { total: state.machines.length, online, offline: state.machines.length - online };
}

// Trazo SVG para mini gráficas
export function sparkPath(values, width, height, min, max) {
  if (!values.length) return '';
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const dx = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = round1(i * dx);
      const y = round1(height - ((v - lo) / span) * height);
      return `${i ? 'L' : 'M'}${x} ${y}`;
    })
    .join(' ');
}

// Asistente de la demo: respuestas preparadas a partir del estado simulado
export function answer(question, state) {
  const q = normalize(question);
  const s = summary(state);
  const down = state.machines.filter((m) => !m.online);

  if (/reinici|node.?red/.test(q)) {
    return {
      text: 'Puedo reiniciar Node-RED en el Gateway de planta de Alimentos Funza con el comando permitido «reiniciar-nodered». Es una acción: queda pendiente hasta que alguien la apruebe.',
      action: { id: 'reiniciar-nodered', machine: 'Gateway de planta · Alimentos Funza' },
    };
  }
  if (/ups|bater|energ|corte/.test(q)) {
    const u = state.ups;
    return {
      text:
        u.source === 'bateria'
          ? `La UPS de Clínica Norte está en batería: ${u.battery} %, unos ${u.runtimeMin} min de autonomía con ${u.load} % de carga. La entrada marca 0 V, es un corte de red.`
          : `La UPS de Clínica Norte está en red: entrada ${u.inputV} V, batería ${u.battery} % y carga ${u.load} %. Sin alarmas.`,
    };
  }
  if (/temper|datacenter|humedad|sitio/.test(q)) {
    const d = state.dc;
    return { text: `Datacenter Calle 26: ${d.tempC} °C y ${d.humidity} % de humedad, CO en ${d.coPpm} ppm. Todo dentro de los umbrales.` };
  }
  if (/ca[ií]d|desconect|linea|offline|estado/.test(q)) {
    if (!down.length) return { text: `Las ${s.total} máquinas están en línea. La de mayor latencia es el Switch principal de Clínica Norte.` };
    return {
      text: `${down.length === 1 ? 'Hay 1 máquina' : `Hay ${down.length} máquinas`} sin conexión: ${down
        .map((m) => `${m.name} (${m.client})`)
        .join(', ')}. Ningún otro equipo del mismo cliente cayó, así que apunta a la red de la sede y no al servidor.`,
    };
  }
  return {
    text: 'En la demo puedo responder sobre equipos caídos, la UPS de Clínica Norte, el datacenter o proponer reiniciar Node-RED. En el producto trabajo con los datos reales de sus máquinas.',
  };
}

// Terminal de la demo: solo comandos de una lista blanca
export const TERMINAL_HELP = ['uptime', 'df -h', 'systemctl status iit-frpc', 'free -h', 'clear', 'help'];

export function runCommand(input, machine, state) {
  const cmd = input.trim().replace(/\s+/g, ' ');
  if (!cmd) return '';
  const up = formatDuration(18 * 86400 + state.elapsed);
  switch (cmd) {
    case 'help':
      return `Comandos de la demo: ${TERMINAL_HELP.join(', ')}`;
    case 'uptime':
      return ` up ${up}, 1 user, load average: 0.21, 0.18, 0.15`;
    case 'df -h':
      return [
        'Filesystem      Size  Used Avail Use% Mounted on',
        '/dev/root        29G  7.9G   20G  29% /',
        '/dev/mmcblk0p1  510M   64M  447M  13% /boot/firmware',
      ].join('\n');
    case 'free -h':
      return ['               total        used        free', 'Mem:           3.7Gi       612Mi       2.4Gi'].join('\n');
    case 'systemctl status iit-frpc':
      return [
        '● iit-frpc.service - Túnel hacia Emergycl',
        `     Active: active (running) since hace ${up}`,
        `   Main PID: 612 (frpc)`,
        `   ${machine.id}: login correcto, ${machine.services.length} servicios publicados`,
      ].join('\n');
    default:
      return `${cmd.split(' ')[0]}: no está en la lista de la demo. Escriba help.`;
  }
}

function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
