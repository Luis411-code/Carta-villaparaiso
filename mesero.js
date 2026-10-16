// =====================================================
// 🧑‍🍳 PANEL DEL MESERO - VILLA PARAÍSO GUARDALAVACA
// Arquitectura de 3 capas de notificación:
//   1. WebSocket robusto (realtime + watchdog)
//   2. Notificaciones push (respaldo)
//   3. Auto-refresh (garantía)
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// 🔧 Cliente con lock deshabilitado (evita errores en móvil)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    lock: async (name, acquireTimeout, fn) => await fn(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// ========== ESTADO ==========
let pedidosActuales = [];
let filtroActual = 'activos';
let realtimeChannel = null;
let realtimeActivo = false;
let timerActualizar = null;
let timerWatchdog = null;
let timerAutoRefresh = null;
let sesionActiva = false;

// 🔔 Estado de notificaciones (evita re-registro)
let registrandoNotif = false;
let yaRegistrado = false;

// ========== ELEMENTOS DEL DOM ==========
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

const VAPID_PUBLIC_KEY = 'BLLIxos7rCGcjiaikjTgzvPR-JfvaD43tj3hDDjZ-zKDMLhSsV1lea9s9bT3ipW1QYi5FhKF-_zaq_SPMBK11tI';

// =====================================================
// 🔐 AUTENTICACIÓN (con protección anti-bucle)
// =====================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = '❌ Credenciales incorrectas.';
  }
});

logoutBtn.addEventListener('click', async () => {
  if (confirm('¿Cerrar sesión?')) {
    await supabase.auth.signOut();
  }
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) activarSesion(session);
  else mostrarLogin();
});

supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);

  if (event === 'SIGNED_IN' && session) {
    if (!sesionActiva) activarSesion(session);
  } else if (event === 'SIGNED_OUT') {
    sesionActiva = false;
    mostrarLogin();
  }
  // Ignorar TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION, etc.
});

function mostrarLogin() {
  sesionActiva = false;
  loginScreen.classList.remove('hidden');
  meseroScreen.classList.add('hidden');

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeActivo = false;
  }

  // Detener timers
  if (timerActualizar) { clearInterval(timerActualizar); timerActualizar = null; }
  if (timerWatchdog) { clearInterval(timerWatchdog); timerWatchdog = null; }
  if (timerAutoRefresh) { clearInterval(timerAutoRefresh); timerAutoRefresh = null; }
}

async function activarSesion(session) {
  if (sesionActiva) {
    console.log('ℹ️ Sesión ya activa, ignorando duplicado');
    return;
  }
  sesionActiva = true;

  loginScreen.classList.add('hidden');
  meseroScreen.classList.remove('hidden');
  userEmail.textContent = session.user.email;

  await cargarPedidos();
  suscribirRealtime();

  // =================================================
  // 🕐 TIMER 1: Actualizar "hace X min" cada 60 seg
  // =================================================
  if (timerActualizar) clearInterval(timerActualizar);
  timerActualizar = setInterval(() => {
    renderPedidos();
    actualizarStats();
  }, 60000);

  // =================================================
  // 🛡️ TIMER 2: Watchdog — Reconectar WebSocket si se cayó
  // =================================================
  if (timerWatchdog) clearInterval(timerWatchdog);
  timerWatchdog = setInterval(() => {
    if (sesionActiva && !realtimeActivo) {
      console.log('🔄 Watchdog: canal inactivo, reconectando...');
      suscribirRealtime();
    }
  }, 20000); // cada 20 segundos

  // =================================================
  // 🔄 TIMER 3: Auto-refresh — Garantía absoluta
  // =================================================
  if (timerAutoRefresh) clearInterval(timerAutoRefresh);
  timerAutoRefresh = setInterval(() => {
    if (document.visibilityState === 'visible' && sesionActiva) {
      console.log('🔄 Auto-refresh periódico...');
      cargarPedidos();
      actualizarStats();
    }
  }, 15000); // cada 15 segundos

  // Verificar notificaciones
  setTimeout(() => {
    if (!yaRegistrado) verificarNotificaciones();
  }, 1000);
}

// =====================================================
// 👁️ VISIBILITY CHANGE — Reconectar al volver a la pestaña
// =====================================================
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sesionActiva) {
    console.log('👁️ Pestaña visible, verificando conexión...');
    if (!realtimeActivo) {
      suscribirRealtime();
    }
    cargarPedidos();
    actualizarStats();
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
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function verificarNotificaciones() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('⚠️ Navegador sin soporte para notificaciones');
    return;
  }

  const permission = Notification.permission;

  if (permission === 'granted') {
    await registrarNotificaciones();
    notifBar.classList.add('hidden');
  } else if (permission === 'default') {
    notifBar.classList.remove('hidden');
  } else {
    notifBar.classList.add('hidden');
  }
}

activarNotifBtn.onclick = async () => {
  await registrarNotificaciones();
  notifBar.classList.add('hidden');
};

async function registrarNotificaciones() {
  if (registrandoNotif || yaRegistrado) {
    console.log('ℹ️ Notificaciones ya registradas o en proceso');
    return;
  }
  registrandoNotif = true;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.warn('⚠️ Permiso denegado');
      registrandoNotif = false;
      return;
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const subJson = subscription.toJSON();

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth
        },
        { onConflict: 'endpoint' }
      );

    if (error) throw error;

    console.log('✅ Notificaciones activas');
    yaRegistrado = true;
    mostrarToast('🔔 Notificaciones activas', 'Recibirás los pedidos al instante', 'success');

  } catch (err) {
    console.error('❌ Error notificaciones:', err);
  } finally {
    registrandoNotif = false;
  }
}

// =====================================================
// 📥 CARGAR PEDIDOS
// =====================================================
async function cargarPedidos() {
  try {
    let query = supabase
      .from('pedidos')
      .select('*')
      .order('creado_en', { ascending: false });

    if (filtroActual === 'activos') {
      query = query.in('estado', ['pendiente', 'confirmado', 'en_preparacion']);
    } else if (filtroActual === 'hoy') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      query = query.gte('creado_en', hoy.toISOString());
    }

    const { data, error } = await query.limit(200);

    if (error) throw error;

    pedidosActuales = data || [];
    renderPedidos();
    actualizarStats();

  } catch (err) {
    console.error('Error al cargar pedidos:', err);
  }
}

// =====================================================
// 🎨 RENDERIZAR PEDIDOS
// =====================================================
function renderPedidos() {
  if (pedidosActuales.length === 0) {
    const mensaje = filtroActual === 'activos'
      ? 'No hay pedidos activos. Todo está al día ✨'
      : filtroActual === 'hoy'
        ? 'Aún no hay pedidos hoy'
        : 'Sin historial de pedidos';

    pedidosContainer.innerHTML = `
      <div class="pedidos-empty">
        <span class="pedidos-empty-icon">📭</span>
        <p class="pedidos-empty-title">Todo en orden</p>
        <p class="pedidos-empty-msg">${mensaje}</p>
      </div>
    `;
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

  const notasHTML = pedido.notas
    ? `<div class="pedido-notas">📝 ${escapeHTML(pedido.notas)}</div>`
    : '';

  const estadosLabel = {
    pendiente: '🔴 Pendiente',
    confirmado: '🟡 Confirmado',
    en_preparacion: '🍳 Preparando',
    entregado: '🟢 Entregado',
    cancelado: '⚫ Cancelado'
  };

  let botonesHTML = '';
  switch (pedido.estado) {
    case 'pendiente':
      botonesHTML = `
        <button class="pedido-btn btn-confirmar" data-action="confirmar" data-id="${pedido.id}">
          ✅ Confirmar
        </button>
        <button class="pedido-btn btn-rechazar" data-action="rechazar" data-id="${pedido.id}">
          ❌
        </button>
      `;
      break;
    case 'confirmado':
      botonesHTML = `
        <button class="pedido-btn btn-preparar" data-action="preparar" data-id="${pedido.id}">
          🍳 Enviar a cocina
        </button>
        <button class="pedido-btn btn-rechazar" data-action="rechazar" data-id="${pedido.id}">
          ❌
        </button>
      `;
      break;
    case 'en_preparacion':
      botonesHTML = `
        <button class="pedido-btn btn-entregar" data-action="entregar" data-id="${pedido.id}">
          ✅ Marcar entregado
        </button>
      `;
      break;
    case 'entregado':
    case 'cancelado':
      botonesHTML = `
        <button class="pedido-btn btn-reabrir" data-action="reabrir" data-id="${pedido.id}">
          🔄 Reabrir
        </button>
      `;
      break;
  }

  return `
    <div class="pedido-card ${pedido.estado}">
      <div class="pedido-head">
        <div class="pedido-mesa-info">
          <div class="mesa-badge">
            <div class="mesa-num">${escapeHTML(pedido.mesa || '?')}</div>
            <div class="mesa-label">MESA</div>
          </div>
          <div class="pedido-datos">
            <div class="pedido-hora">🕐 ${horaStr}</div>
            <div class="pedido-tiempo ${urgente ? 'urgente' : ''}">
              ${urgente ? '⚠️ ' : ''}${hace}
            </div>
          </div>
        </div>
        <div class="estado-pill ${pedido.estado}">${estadosLabel[pedido.estado] || pedido.estado}</div>
      </div>

      <div class="pedido-body">
        <div class="pedido-items-list">
          ${itemsHTML}
        </div>
        ${notasHTML}
        <div class="pedido-total-row">
          <span class="label">Total</span>
          <span class="valor">$${Number(pedido.total).toFixed(2)}</span>
        </div>
      </div>

      <div class="pedido-acciones">
        ${botonesHTML}
      </div>
    </div>
  `;
}

// =====================================================
// ⏱️ TIEMPO RELATIVO
// =====================================================
function tiempoRelativo(fecha) {
  const ahora = new Date();
  const diff = Math.floor((ahora - fecha) / 1000);

  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

// =====================================================
// 🎬 ACCIONES
// =====================================================
async function manejarAccion(accion, id, btn) {
  const nuevosEstados = {
    confirmar: 'confirmado',
    rechazar: 'cancelado',
    preparar: 'en_preparacion',
    entregar: 'entregado',
    reabrir: 'pendiente'
  };

  const nuevoEstado = nuevosEstados[accion];
  if (!nuevoEstado) return;

  if (accion === 'rechazar') {
    if (!confirm('¿Rechazar este pedido? Se marcará como cancelado.')) return;
  }

  if (btn) {
    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳...';
    btn.dataset.textoOriginal = textoOriginal;
  }

  try {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (error) throw error;

    console.log(`✅ Pedido ${id} → ${nuevoEstado}`);

    if (navigator.vibrate) navigator.vibrate(50);

    const mensajes = {
      confirmar: '✅ Pedido confirmado',
      rechazar: '❌ Pedido rechazado',
      preparar: '🍳 Enviado a cocina',
      entregar: '🟢 Pedido entregado',
      reabrir: '🔄 Pedido reabierto'
    };

    mostrarToast(mensajes[accion], '', 'success');

    const pedido = pedidosActuales.find(p => p.id === id);
    if (pedido) pedido.estado = nuevoEstado;

    if (filtroActual === 'activos' && ['entregado', 'cancelado'].includes(nuevoEstado)) {
      pedidosActuales = pedidosActuales.filter(p => p.id !== id);
    }

    renderPedidos();
    actualizarStats();

  } catch (err) {
    console.error('Error:', err);
    mostrarToast('❌ Error', err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.textoOriginal || 'Reintentar';
    }
  }
}

// =====================================================
// 📊 ESTADÍSTICAS
// =====================================================
async function actualizarStats() {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('pedidos')
      .select('estado, total, creado_en')
      .gte('creado_en', hoy.toISOString());

    if (error) throw error;

    const pedidosHoy = data || [];
    const activos = pedidosHoy.filter(p =>
      ['pendiente', 'confirmado', 'en_preparacion'].includes(p.estado)
    ).length;

    const ventas = pedidosHoy
      .filter(p => p.estado !== 'cancelado')
      .reduce((sum, p) => sum + Number(p.total), 0);

    statActivos.textContent = activos;
    statVentas.textContent = `$${ventas.toFixed(0)}`;
    statTotal.textContent = pedidosHoy.length;

    if (activos > 0) {
      badgeActivos.textContent = activos;
      badgeActivos.classList.remove('hidden');
    } else {
      badgeActivos.classList.add('hidden');
    }

  } catch (err) {
    console.error('Error stats:', err);
  }
}

// =====================================================
// 🔄 REALTIME (con protección contra duplicados)
// =====================================================
function suscribirRealtime() {
  // 🛡️ Si ya está activo, no hacer nada
  if (realtimeActivo && realtimeChannel) {
    console.log('ℹ️ Realtime ya activo');
    return;
  }

  // Limpiar canal viejo si existe
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel('mesero-pedidos-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pedidos' },
      (payload) => {
        console.log('🔔 Cambio:', payload.eventType, payload);

        if (payload.eventType === 'INSERT') {
          if (!pedidosActuales.some(p => p.id === payload.new.id)) {
            pedidosActuales.unshift(payload.new);
          }

          if (filtroActual === 'activos' && ['pendiente', 'confirmado', 'en_preparacion'].includes(payload.new.estado)) {
            renderPedidos();
          } else if (filtroActual === 'hoy' || filtroActual === 'historial') {
            renderPedidos();
          }

          actualizarStats();

          mostrarToast(
            '🍽️ Nuevo pedido',
            `Mesa ${payload.new.mesa} — $${Number(payload.new.total).toFixed(2)}`,
            'success'
          );

          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }

          reproducirSonido();

        } else if (payload.eventType === 'UPDATE') {
          const idx = pedidosActuales.findIndex(p => p.id === payload.new.id);
          if (idx > -1) pedidosActuales[idx] = payload.new;

          if (filtroActual === 'activos' && ['entregado', 'cancelado'].includes(payload.new.estado)) {
            pedidosActuales = pedidosActuales.filter(p => p.id !== payload.new.id);
          }

          renderPedidos();
          actualizarStats();

        } else if (payload.eventType === 'DELETE') {
          pedidosActuales = pedidosActuales.filter(p => p.id !== payload.old.id);
          renderPedidos();
          actualizarStats();
        }
      }
    )
    .subscribe((status) => {
      console.log('Realtime:', status);

      if (status === 'SUBSCRIBED') {
        realtimeActivo = true;
        rtStatus.textContent = '🟢 En vivo';
        rtStatus.classList.remove('offline');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        realtimeActivo = false;
        rtStatus.textContent = '🟡 Reconectando...';
        rtStatus.classList.add('offline');
      }
    });
}

// =====================================================
// 🔊 SONIDO DE NUEVO PEDIDO
// =====================================================
function reproducirSonido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silencioso */ }
}

// =====================================================
// 🍞 TOAST
// =====================================================
let toastTimer = null;
function mostrarToast(titulo, mensaje, tipo = 'success') {
  toastTitle.textContent = titulo;
  toastMsg.textContent = mensaje || '';
  toastMsg.style.display = mensaje ? 'block' : 'none';

  toast.classList.remove('toast-error', 'toast-warning');
  if (tipo === 'error') toast.classList.add('toast-error');
  if (tipo === 'warning') toast.classList.add('toast-warning');

  toast.classList.remove('hidden');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// =====================================================
// 🛠️ HELPERS
// =====================================================
function escapeHTML(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// =====================================================
// 🎛️ FILTROS Y CONTROLES
// =====================================================
document.querySelectorAll('.filtro-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroActual = btn.dataset.filtro;
    cargarPedidos();
  };
});

refreshBtn.onclick = () => {
  refreshBtn.classList.add('spinning');
  cargarPedidos().then(() => {
    setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
  });
};