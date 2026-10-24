// =====================================================
// 🧑‍🍳 PANEL DEL MESERO - VILLA PARAÍSO GUARDALAVACA
// Login por Nombre, Turnos, 3 Capas de Notificación y Alarma
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { lock: async (name, acquireTimeout, fn) => await fn() }
});

let pedidosActuales = [];
let idsConocidos = new Set();
let filtroActual = 'activos';
let realtimeChannel = null;
let realtimeActivo = false;
let timerActualizar = null;
let timerWatchdog = null;
let timerAutoRefresh = null;
let sesionActiva = false;
let registrandoNotif = false;
let yaRegistrado = false;
let alarmaActiva = false;
let intervaloAlarma = null;

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const meseroScreen = document.getElementById('meseroScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const pedidosContainer = document.getElementById('pedidosContainer');
const rtStatus = document.getElementById('rtStatus');
const refreshBtn = document.getElementById('refreshBtn');
const notifBar = document.getElementById('notifBar');
const activarNotifBtn = document.getElementById('activarNotifBtn');
const badgeActivos = document.getElementById('badgeActivos');
const statActivos = document.getElementById('statActivos');
const statVentas = document.getElementById('statVentas');
const statTotal = document.getElementById('statTotal');
const toast = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMsg = document.getElementById('toastMsg');

// Auth DOM
const authTitle = document.getElementById('authTitle');
const authBtn = document.getElementById('authBtn');
const authToggleText = document.getElementById('authToggleText');
const authToggleLink = document.getElementById('authToggleLink');

const VAPID_PUBLIC_KEY = 'BBEN4za2_pHp5jUM1ZDBXV6fBZe7T-74QBUxNWg9VwNJ55h048_m-dnIl5bOi-6VZkO36U68kHW8SLZlWbYsjRs';

// =====================================================
// 🔐 AUTENTICACIÓN CON NOMBRE
// =====================================================
let isRegisterMode = false;

authToggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    authTitle.textContent = 'Crear Cuenta';
    authBtn.textContent = 'Registrarse';
    authToggleText.textContent = '¿Ya tienes cuenta?';
    authToggleLink.textContent = 'Inicia sesión aquí';
  } else {
    authTitle.textContent = 'Iniciar Sesión';
    authBtn.textContent = 'Entrar';
    authToggleText.textContent = '¿Eres mesero nuevo?';
    authToggleLink.textContent = 'Regístrate aquí';
  }
  loginError.textContent = '';
});

function generarEmailFalso(nombre) {
  const slug = nombre.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${slug}@mesero.villaparaiso.com`;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const nombreRaw = document.getElementById('nombre').value.trim();
  const password = document.getElementById('password').value;
  
  if (!nombreRaw) { loginError.textContent = '❌ Por favor, escribe tu nombre.'; return; }
  const emailInterno = generarEmailFalso(nombreRaw);
  authBtn.disabled = true; authBtn.textContent = 'Cargando...';

  try {
    if (isRegisterMode) {
      const { data, error } = await supabase.auth.signUp({
        email: emailInterno, password, options: { data: { nombre: nombreRaw } }
      });
      if (error) {
        if (error.message.includes('already registered')) throw new Error('Ese nombre ya está en uso. Intenta con "Nombre Apellido".');
        throw error;
      }
      if (data.user && !data.session) { alert('Registro exitoso. Ya puedes iniciar sesión.'); authToggleLink.click(); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailInterno, password });
      if (error) throw new Error('Nombre o contraseña incorrectos.');
    }
  } catch (err) {
    loginError.textContent = '❌ ' + err.message;
  } finally {
    authBtn.disabled = false; authBtn.textContent = isRegisterMode ? 'Registrarse' : 'Entrar';
  }
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) activarSesion(session); else mostrarLogin();
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session && !sesionActiva) activarSesion(session);
  if (event === 'SIGNED_OUT') { sesionActiva = false; mostrarLogin(); }
});

function mostrarLogin() {
  sesionActiva = false;
  detenerAlarma();
  loginScreen.classList.remove('hidden');
  meseroScreen.classList.add('hidden');
  document.getElementById('nombre').value = '';
  document.getElementById('password').value = '';
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; realtimeActivo = false; }
  if (timerActualizar) { clearInterval(timerActualizar); timerActualizar = null; }
  if (timerWatchdog) { clearInterval(timerWatchdog); timerWatchdog = null; }
  if (timerAutoRefresh) { clearInterval(timerAutoRefresh); timerAutoRefresh = null; }
  document.title = 'Mesero · Villa Paraíso';
}

async function activarSesion(session) {
  if (sesionActiva) return;
  sesionActiva = true;

  loginScreen.classList.add('hidden');
  meseroScreen.classList.remove('hidden');
  
  const nombreMesero = session.user.user_metadata?.nombre || 'Mesero';
  userEmail.innerHTML = `👨‍🍳 ${nombreMesero}`;

  // Registrar entrada (Turno)
  let turnoId = localStorage.getItem('turno_activo');
  if (!turnoId) {
    const { data } = await supabase.from('turnos').insert({ mesero_id: session.user.id, mesero_nombre: nombreMesero }).select().single();
    if (data) localStorage.setItem('turno_activo', data.id);
  }

  await cargarPedidos(false);
  suscribirRealtime();

  if (timerActualizar) clearInterval(timerActualizar);
  timerActualizar = setInterval(() => { renderPedidos(); actualizarStats(); }, 60000);

  if (timerWatchdog) clearInterval(timerWatchdog);
  timerWatchdog = setInterval(() => { if (sesionActiva && !realtimeActivo) suscribirRealtime(); }, 20000);

  if (timerAutoRefresh) clearInterval(timerAutoRefresh);
  timerAutoRefresh = setInterval(() => { if (sesionActiva) cargarPedidos(true); }, 8000);

  setTimeout(() => { if (!yaRegistrado) verificarNotificaciones(); }, 1000);
}

logoutBtn.addEventListener('click', async () => {
  if (confirm('¿Cerrar sesión y terminar turno?')) {
    const turnoId = localStorage.getItem('turno_activo');
    if (turnoId) {
      await supabase.from('turnos').update({ fin: new Date().toISOString() }).eq('id', turnoId);
      localStorage.removeItem('turno_activo');
    }
    detenerAlarma();
    await supabase.auth.signOut();
  }
});

// =====================================================
// 🔔 NOTIFICACIONES PUSH
// =====================================================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function verificarNotificaciones() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const permission = Notification.permission;
  if (permission === 'granted') { await registrarNotificaciones(); notifBar.classList.add('hidden'); }
  else if (permission === 'default') { notifBar.classList.remove('hidden'); }
  else { notifBar.classList.add('hidden'); }
}

activarNotifBtn.onclick = async () => { await registrarNotificaciones(); notifBar.classList.add('hidden'); };

async function registrarNotificaciones() {
  if (registrandoNotif || yaRegistrado) return;
  registrandoNotif = true;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') { registrandoNotif = false; return; }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const subJson = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh, auth: subJson.keys.auth
    }, { onConflict: 'endpoint' });

    if (error) throw error;
    yaRegistrado = true;
  } catch (err) { console.error('❌ Error notificaciones:', err); } 
  finally { registrandoNotif = false; }
}

// =====================================================
// 📥 CARGAR Y RENDERIZAR PEDIDOS
// =====================================================
async function cargarPedidos(detectarNuevos = true) {
  try {
    let query = supabase.from('pedidos').select('*').order('creado_en', { ascending: false });
    if (filtroActual === 'activos') query = query.in('estado', ['pendiente', 'confirmado', 'en_preparacion']);
    else if (filtroActual === 'hoy') {
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      query = query.gte('creado_en', hoy.toISOString());
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;

    const pedidos = data || [];
    if (detectarNuevos) {
      const nuevos = pedidos.filter(p => !idsConocidos.has(p.id) && p.estado === 'pendiente');
      if (nuevos.length > 0) {
        activarAlarma();
        mostrarToast(`🍽️ ${nuevos.length} pedido(s) nuevo(s)`, nuevos.map(p => `Mesa ${p.mesa}`).join(' · '));
      }
    }

    idsConocidos = new Set(pedidos.map(p => p.id));
    pedidosActuales = pedidos;
    renderPedidos();
    actualizarStats();

    const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
    if (pendientes > 0 && document.visibilityState !== 'visible') document.title = `(${pendientes}) 🔴 Nuevos pedidos`;
    else if (pendientes === 0) document.title = 'Mesero · Villa Paraíso';
  } catch (err) { console.error('Error al cargar pedidos:', err); }
}

function renderPedidos() {
  if (pedidosActuales.length === 0) {
    pedidosContainer.innerHTML = `<div class="pedidos-empty"><span class="pedidos-empty-icon">📭</span><p class="pedidos-empty-title">Todo en orden</p><p class="pedidos-empty-msg">No hay pedidos en esta vista.</p></div>`;
    return;
  }

  const orden = { pendiente: 1, confirmado: 2, en_preparacion: 3, entregado: 4, cancelado: 5 };
  const ordenados = [...pedidosActuales].sort((a, b) => {
    const diff = (orden[a.estado] || 9) - (orden[b.estado] || 9);
    if (diff !== 0) return diff;
    return new Date(b.creado_en) - new Date(a.creado_en);
  });

  pedidosContainer.innerHTML = ordenados.map(p => renderPedidoCard(p)).join('');
  pedidosContainer.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = () => manejarAccion(btn.dataset.action, btn.dataset.id, btn);
  });
}

function renderPedidoCard(pedido) {
  const hora = new Date(pedido.creado_en);
  const horaStr = hora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hace = tiempoRelativo(hora);
  const urgente = (Date.now() - hora.getTime()) > 10 * 60 * 1000 && pedido.estado === 'pendiente';
  const items = Array.isArray(pedido.items) ? pedido.items : [];

  const itemsHTML = items.map(item => `
    <div class="pedido-item-row">
      <span class="qty">×${item.cantidad}</span>
      <span class="nom">${escapeHTML(item.nombre)}</span>
      <span class="sub">$${(item.precio * item.cantidad).toFixed(2)}</span>
    </div>
  `).join('');

  let notasHTML = '';
  if (pedido.notas) {
    const tieneAlergia = /alergi|alérgic|celiac|gluten|lactosa|marisco|maní|cacahuete/i.test(pedido.notas);
    const claseAlerta = tieneAlergia ? 'pedido-notas alerta-alergia' : 'pedido-notas';
    const icono = tieneAlergia ? '🚨 ¡ALERGIA!' : '📝 Notas:';
    notasHTML = `<div class="${claseAlerta}">${icono} ${escapeHTML(pedido.notas)}</div>`;
  }

  const estadosLabel = { pendiente: '🔴 Pendiente', confirmado: '🟡 Confirmado', en_preparacion: '🍳 Preparando', entregado: '🟢 Entregado', cancelado: '⚫ Cancelado' };

  let botonesHTML = '';
  switch (pedido.estado) {
    case 'pendiente': botonesHTML = `<button class="pedido-btn btn-confirmar" data-action="confirmar" data-id="${pedido.id}">✅ Confirmar</button><button class="pedido-btn btn-rechazar" data-action="rechazar" data-id="${pedido.id}">❌</button>`; break;
    case 'confirmado': botonesHTML = `<button class="pedido-btn btn-preparar" data-action="preparar" data-id="${pedido.id}">🍳 Enviar a cocina</button><button class="pedido-btn btn-rechazar" data-action="rechazar" data-id="${pedido.id}">❌</button>`; break;
    case 'en_preparacion': botonesHTML = `<button class="pedido-btn btn-entregar" data-action="entregar" data-id="${pedido.id}">✅ Marcar entregado</button>`; break;
    case 'entregado': case 'cancelado': botonesHTML = `<button class="pedido-btn btn-reabrir" data-action="reabrir" data-id="${pedido.id}">🔄 Reabrir</button>`; break;
  }

  return `
    <div class="pedido-card ${pedido.estado}">
      <div class="pedido-head">
        <div class="pedido-mesa-info">
          <div class="mesa-badge"><div class="mesa-num">${escapeHTML(pedido.mesa || '?')}</div><div class="mesa-label">MESA</div></div>
          <div class="pedido-datos"><div class="pedido-hora">🕐 ${horaStr}</div><div class="pedido-tiempo ${urgente ? 'urgente' : ''}">${urgente ? '⚠️ ' : ''}${hace}</div></div>
        </div>
        <div class="estado-pill ${pedido.estado}">${estadosLabel[pedido.estado] || pedido.estado}</div>
      </div>
      <div class="pedido-body">
        <div class="pedido-items-list">${itemsHTML}</div>
        ${notasHTML}
        <div class="pedido-total-row"><span class="label">Total</span><span class="valor">$${Number(pedido.total).toFixed(2)}</span></div>
      </div>
      <div class="pedido-acciones">${botonesHTML}</div>
    </div>
  `;
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((new Date() - fecha) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

async function manejarAccion(accion, id, btn) {
  detenerAlarma();
  const nuevosEstados = { confirmar: 'confirmado', rechazar: 'cancelado', preparar: 'en_preparacion', entregar: 'entregado', reabrir: 'pendiente' };
  const nuevoEstado = nuevosEstados[accion];
  if (!nuevoEstado) return;

  if (accion === 'rechazar' && !confirm('¿Rechazar este pedido?')) return;
  if (btn) { btn.disabled = true; btn.dataset.textoOriginal = btn.innerHTML; btn.innerHTML = '⏳...'; }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const meseroId = session?.user?.id;
    const meseroNombre = session?.user?.user_metadata?.nombre || session?.user?.email.split('@')[0];

    const { error } = await supabase.from('pedidos').update({ 
      estado: nuevoEstado, mesero_id: meseroId, mesero_nombre: meseroNombre
    }).eq('id', id);
    
    if (error) throw error;
    if (navigator.vibrate) navigator.vibrate(50);
    mostrarToast('✅ Actualizado', 'El estado del pedido ha cambiado');

    const pedido = pedidosActuales.find(p => p.id === id);
    if (pedido) pedido.estado = nuevoEstado;
    if (filtroActual === 'activos' && ['entregado', 'cancelado'].includes(nuevoEstado)) {
      pedidosActuales = pedidosActuales.filter(p => p.id !== id);
    }
    renderPedidos(); actualizarStats();
  } catch (err) {
    mostrarToast('❌ Error', err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.textoOriginal; }
  }
}

async function actualizarStats() {
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const { data } = await supabase.from('pedidos').select('estado, total').gte('creado_en', hoy.toISOString());
    const pedidosHoy = data || [];
    const activos = pedidosHoy.filter(p => ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)).length;
    const ventas = pedidosHoy.filter(p => p.estado !== 'cancelado').reduce((sum, p) => sum + Number(p.total), 0);

    statActivos.textContent = activos;
    statVentas.textContent = `$${ventas.toFixed(0)}`;
    statTotal.textContent = pedidosHoy.length;
    if (activos > 0) { badgeActivos.textContent = activos; badgeActivos.classList.remove('hidden'); }
    else badgeActivos.classList.add('hidden');
  } catch (err) { console.error('Error stats:', err); }
}

function suscribirRealtime() {
  if (realtimeActivo && realtimeChannel) return;
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);

  realtimeChannel = supabase.channel('mesero-pedidos-live').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
    if (payload.eventType === 'INSERT') {
      if (!idsConocidos.has(payload.new.id)) {
        idsConocidos.add(payload.new.id);
        if (!pedidosActuales.some(p => p.id === payload.new.id)) pedidosActuales.unshift(payload.new);
        if (filtroActual === 'activos' && ['pendiente', 'confirmado', 'en_preparacion'].includes(payload.new.estado)) renderPedidos();
        actualizarStats();
        if (payload.new.estado === 'pendiente') { activarAlarma(); mostrarToast('🍽️ Nuevo pedido', `Mesa ${payload.new.mesa}`); }
      }
    } else if (payload.eventType === 'UPDATE') {
      const idx = pedidosActuales.findIndex(p => p.id === payload.new.id);
      if (idx > -1) pedidosActuales[idx] = payload.new;
      if (filtroActual === 'activos' && ['entregado', 'cancelado'].includes(payload.new.estado)) pedidosActuales = pedidosActuales.filter(p => p.id !== payload.new.id);
      renderPedidos(); actualizarStats();
    }
  }).subscribe((status) => {
    if (status === 'SUBSCRIBED') { realtimeActivo = true; rtStatus.textContent = '🟢 En vivo'; rtStatus.classList.remove('offline'); }
    else { realtimeActivo = false; rtStatus.textContent = '🟡 Reconectando...'; rtStatus.classList.add('offline'); }
  });
}

// =====================================================
// 🚨 ALARMA SONORA
// =====================================================
function activarAlarma() {
  if (alarmaActiva) return;
  alarmaActiva = true;
  reproducirAlarma();
  intervaloAlarma = setInterval(() => { if (alarmaActiva) reproducirAlarma(); }, 3000);
  setTimeout(() => { if (alarmaActiva) detenerAlarma(); }, 30000);
  const detenerConToque = () => { detenerAlarma(); document.removeEventListener('click', detenerConToque); document.removeEventListener('touchstart', detenerConToque); };
  document.addEventListener('click', detenerConToque, { once: true });
  document.addEventListener('touchstart', detenerConToque, { once: true });
}

function detenerAlarma() {
  if (intervaloAlarma) { clearInterval(intervaloAlarma); intervaloAlarma = null; }
  alarmaActiva = false;
}

function reproducirAlarma() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tonos = [{ freq: 1200, start: 0, dur: 0.15 }, { freq: 1500, start: 0.2, dur: 0.15 }, { freq: 1800, start: 0.4, dur: 0.25 }];
    tonos.forEach(t => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = t.freq;
      gain.gain.setValueAtTime(0.5, ctx.currentTime + t.start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.start + t.dur);
      osc.start(ctx.currentTime + t.start); osc.stop(ctx.currentTime + t.start + t.dur);
    });
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
  } catch (e) { console.warn('Error alarma:', e); }
}

let toastTimer = null;
function mostrarToast(titulo, mensaje, tipo = 'success') {
  toastTitle.textContent = titulo; toastMsg.textContent = mensaje || ''; toastMsg.style.display = mensaje ? 'block' : 'none';
  toast.classList.remove('toast-error', 'toast-warning');
  if (tipo === 'error') toast.classList.add('toast-error');
  if (tipo === 'warning') toast.classList.add('toast-warning');
  toast.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function escapeHTML(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

document.querySelectorAll('.filtro-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); filtroActual = btn.dataset.filtro; cargarPedidos(false);
  };
});

refreshBtn.onclick = () => {
  refreshBtn.classList.add('spinning');
  cargarPedidos(false).then(() => setTimeout(() => refreshBtn.classList.remove('spinning'), 500));
};