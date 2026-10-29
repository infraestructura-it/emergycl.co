import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOOP_SECONDS, SCRIPT, GRACE_SECONDS, MACHINES, createRng, loopTime, batteryAt, upsAt, upsAlerts,
  datacenterAt, isOnline, formatDuration, createState, step, summary, sparkPath, answer, runCommand,
} from '../site/js/demo-data.js';

const fixed = () => 0.5;

test('el generador con semilla es reproducible y queda en [0, 1)', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('loopTime da vueltas cada LOOP_SECONDS', () => {
  assert.equal(loopTime(0), 0);
  assert.equal(loopTime(LOOP_SECONDS + 5), 5);
  assert.equal(loopTime(-1), LOOP_SECONDS - 1);
});

test('la batería se descarga durante el corte y se recarga después', () => {
  assert.equal(batteryAt(0), 100);
  assert.equal(batteryAt(SCRIPT.powerCutStart), 100);
  assert.ok(batteryAt(SCRIPT.powerCutEnd - 1) < 50);
  assert.ok(batteryAt(SCRIPT.powerCutEnd + 10) > batteryAt(SCRIPT.powerCutEnd));
  assert.equal(batteryAt(LOOP_SECONDS - 1), 100);
});

test('la UPS está en batería solo durante el corte, con 0 V de entrada', () => {
  assert.equal(upsAt(10, fixed).source, 'red');
  const cut = upsAt(30, fixed);
  assert.equal(cut.source, 'bateria');
  assert.equal(cut.inputV, 0);
  assert.equal(upsAt(SCRIPT.powerCutEnd, fixed).source, 'red');
});

test('upsAlerts aplica los umbrales por defecto del producto', () => {
  const ok = { source: 'red', battery: 100, runtimeMin: 40, load: 40, tempC: 30 };
  assert.deepEqual(upsAlerts(ok), []);
  assert.deepEqual(upsAlerts({ ...ok, source: 'bateria' }), ['en_bateria']);
  assert.ok(upsAlerts({ ...ok, battery: 20, runtimeMin: 8 }).includes('bateria_baja'));
  assert.ok(upsAlerts({ ...ok, runtimeMin: 8 }).includes('autonomia_baja'));
  assert.deepEqual(upsAlerts({ ...ok, load: 85 }), ['carga_alta']);
  assert.deepEqual(upsAlerts({ ...ok, load: 96 }), ['carga_critica']);
  assert.deepEqual(upsAlerts({ ...ok, tempC: 41 }), ['temperatura']);
});

test('el datacenter da tres fases y lecturas en rangos razonables', () => {
  for (let t = 0; t < 200; t += 7) {
    const d = datacenterAt(t, fixed);
    assert.equal(d.phases.length, 3);
    assert.ok(d.tempC > 20 && d.tempC < 26);
    assert.ok(d.humidity > 35 && d.humidity < 60);
    for (const p of d.phases) assert.ok(p.v > 115 && p.v < 125);
  }
});

test('solo la planta de Funza se desconecta, y solo en su ventana', () => {
  for (const m of MACHINES) if (m.id !== 'planta-funza-gw') assert.equal(isOnline(m.id, 70), true);
  assert.equal(isOnline('planta-funza-gw', SCRIPT.funzaDropStart - 1), true);
  assert.equal(isOnline('planta-funza-gw', SCRIPT.funzaDropStart), false);
  assert.equal(isOnline('planta-funza-gw', SCRIPT.funzaDropEnd), true);
});

test('formatDuration escribe duraciones legibles', () => {
  assert.equal(formatDuration(0), '0 s');
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(60), '1 min');
  assert.equal(formatDuration(85), '1 min 25 s');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(3720), '1 h 2 min');
  assert.equal(formatDuration(-5), '0 s');
});

function runLoop(state, seconds) {
  const events = [];
  for (let i = 0; i < seconds; i++) events.push(...step(state));
  return events;
}

test('una vuelta del guion emite los avisos en orden y sin duplicados', () => {
  const state = createState(1);
  const events = runLoop(state, LOOP_SECONDS - 1);
  const types = events.map((e) => e.type);
  assert.deepEqual(types, ['ups_bateria', 'ia_diagnostico', 'ups_red', 'sin_latido', 'machine_offline', 'machine_online', 'puerta']);

  const at = Object.fromEntries(events.map((e) => [e.type, e.at]));
  assert.equal(at.ups_bateria, SCRIPT.powerCutStart);
  assert.equal(at.ia_diagnostico - at.ups_bateria, 3);
  assert.equal(at.machine_offline - at.sin_latido, GRACE_SECONDS);
  assert.match(events.find((e) => e.type === 'machine_online').text, /20 s/);
  assert.match(events.find((e) => e.type === 'ups_red').text, /25 s en batería/);
});

test('el guion se repite en la siguiente vuelta', () => {
  const state = createState(3);
  runLoop(state, LOOP_SECONDS);
  const second = runLoop(state, LOOP_SECONDS - 1);
  assert.equal(second.filter((e) => e.type === 'ups_bateria').length, 1);
  assert.equal(second.filter((e) => e.type === 'machine_offline').length, 1);
});

test('el historial y la lista de eventos tienen tope', () => {
  const state = createState(5);
  runLoop(state, LOOP_SECONDS * 8);
  assert.ok(state.history.battery.length <= 60);
  assert.ok(state.history.dcTemp.length <= 60);
  assert.ok(state.events.length <= 40);
});

test('summary cuenta las máquinas en línea', () => {
  const state = createState(2);
  assert.deepEqual(summary(state), { total: MACHINES.length, online: MACHINES.length, offline: 0 });
  runLoop(state, 65);
  assert.deepEqual(summary(state), { total: MACHINES.length, online: MACHINES.length - 1, offline: 1 });
});

test('sparkPath dibuja un punto por valor dentro del área', () => {
  assert.equal(sparkPath([], 100, 50), '');
  const d = sparkPath([0, 50, 100], 100, 50, 0, 100);
  assert.equal(d, 'M0 50 L50 25 L100 0');
  assert.equal(sparkPath([7, 7], 10, 10), 'M0 10 L10 10');
});

test('el asistente responde según el estado simulado', () => {
  const state = createState(4);
  assert.match(answer('¿Qué equipos están caídos?', state).text, /6 máquinas están en línea/);
  runLoop(state, 65);
  assert.match(answer('que equipos estan caidos', state).text, /Gateway de planta \(Alimentos Funza\)/);
  assert.match(answer('¿Cómo está la UPS?', state).text, /en red/);
  assert.match(answer('temperatura del datacenter', state).text, /°C/);
  const act = answer('Reinicia Node-RED en Funza', state);
  assert.ok(act.action, 'reiniciar propone una acción con aprobación');
  assert.equal(act.action.id, 'reiniciar-nodered');
  assert.match(answer('hola', state).text, /En la demo puedo/);
});

test('el asistente detecta la UPS en batería durante el corte', () => {
  const state = createState(6);
  runLoop(state, 30);
  assert.match(answer('bateria de la ups', state).text, /está en batería/);
});

test('la terminal solo ejecuta comandos de la lista blanca', () => {
  const state = createState(8);
  const m = state.machines[0];
  assert.match(runCommand('uptime', m, state), /load average/);
  assert.match(runCommand('  df   -h ', m, state), /Filesystem/);
  assert.match(runCommand('systemctl status iit-frpc', m, state), /active \(running\)/);
  assert.match(runCommand('help', m, state), /uptime/);
  assert.match(runCommand('rm -rf /', m, state), /no está en la lista/);
  assert.equal(runCommand('   ', m, state), '');
});
