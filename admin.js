// =====================================================
// 🔐 PANEL DE ADMINISTRACIÓN - VILLA PARAÍSO (COMPLETO)
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { lock: async (name, timeout, fn) => await fn(), autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

// ========== ESTADO GLOBAL ==========
let menuData = { categories: [] };
let hasUnsavedChanges = false;
let pedidosActuales = [];
let realtimeChannel = null;
let mostrarHistorial = false;

// ========== ELEMENTOS DOM ==========
const loginScreen = document.getElementById('loginScreen');
const adminScreen = document.getElementById('adminScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const container = document.getElementById('categoriesContainer');
const statusBar = document.getElementById('statusBar');
const saveBtn = document.getElementById('saveBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const reloadBtn = document.getElementById('reloadBtn');

// Tabs
const tabs = document.querySelectorAll('.admin-tab');
const tabCarta = document.getElementById('tabCarta');
const tabPedidos = document.getElementById('tabPedidos');
const tabQrs = document.getElementById('tabQrs');
const pedidosBadge = document.getElementById('pedidosBadge');

// Pedidos
const pedidosContainer = document.getElementById('pedidosContainer');
const refreshPedidosBtn = document.getElementById('refreshPedidosBtn');
const rtStatus = document.getElementById('rtStatus');
const toggleHistorial = document.getElementById('toggleHistorial');

// QRs
const qrMesaInput = document.getElementById('qr-mesa-input');
const qrGenerarBtn = document.getElementById('qr-generar-btn');
const qrResultado = document.getElementById('qr-resultado');

// ========== HELPERS ==========
const uid = () => Math.random().toString(36).slice(2, 10);
const escapeHTML = (text) => { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
const formatPrice = (price) => `$${(Number(price) || 0).toFixed(2)}`;

function markDirty() { hasUnsavedChanges = true; statusBar.classList.remove('hidden'); }
window.addEventListener('beforeunload', (e) => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; } });

// =====================================================
// 🔐 AUTENTICACIÓN
// =====================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault(); loginError.textContent = '';
  const { error } = await supabase.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
  if (error) loginError.textContent = '❌ Credenciales incorrectas.';
});

logoutBtn.addEventListener('click', async () => { if (hasUnsavedChanges && !confirm('Tienes cambios sin guardar. ¿Salir?')) return; await supabase.auth.signOut(); });

async function activarSesion(session) {
  loginScreen.classList.add('hidden'); adminScreen.classList.remove('hidden'); userEmail.textContent = session.user.email;
  await loadMenu();
  cargarPedidos();
  suscribirRealtime();
}

supabase.auth.getSession().then(({ data: { session } }) => { if (session) activarSesion(session); else { loginScreen.classList.remove('hidden'); adminScreen.classList.add('hidden'); } });
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) activarSesion(session);
  else if (event === 'SIGNED_OUT') { loginScreen.classList.remove('hidden'); adminScreen.classList.add('hidden'); if(realtimeChannel) supabase.removeChannel(realtimeChannel); }
});

// =====================================================
// 🗂️ SISTEMA DE PESTAÑAS (TABS)
// =====================================================
tabs.forEach(tab => {
  tab.onclick = () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    
    // Ocultar todos los paneles
    if(tabCarta) tabCarta.classList.add('hidden');
    if(tabPedidos) tabPedidos.classList.add('hidden');
    if(tabQrs) tabQrs.classList.add('hidden');

    // Mostrar el seleccionado
    if (target === 'carta' && tabCarta) tabCarta.classList.remove('hidden');
    if (target === 'pedidos' && tabPedidos) tabPedidos.classList.remove('hidden');
    if (target === 'qrs' && tabQrs) tabQrs.classList.remove('hidden');
  };
});

// =====================================================
// 📥 CARGAR Y GUARDAR MENÚ
// =====================================================
async function loadMenu() {
  try {
    const { data, error } = await supabase.from('menu').select('data').eq('id', 'main').single();
    if (error) throw error;
    menuData = data?.data || { categories: [] };
    if (!menuData.categories) menuData.categories = [];
    if (!menuData.site) menuData.site = {};
    
    loadSiteConfig(menuData.site);
    render();
    hasUnsavedChanges = false; statusBar.classList.add('hidden');
  } catch (err) { alert('Error al cargar: ' + err.message); }
}

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
  try {
    const { error } = await supabase.from('menu').update({ data: menuData, updated_at: new Date().toISOString() }).eq('id', 'main');
    if (error) throw error;
    hasUnsavedChanges = false; statusBar.classList.add('hidden');
    saveBtn.textContent = '✅ Guardado'; setTimeout(() => { saveBtn.textContent = '💾 Guardar cambios'; }, 1800);
  } catch (err) { alert('Error: ' + err.message); saveBtn.textContent = '💾 Guardar cambios'; } 
  finally { saveBtn.disabled = false; }
});

reloadBtn.addEventListener('click', () => { if (hasUnsavedChanges && !confirm('Perderás los cambios. ¿Continuar?')) return; loadMenu(); });
addCategoryBtn.addEventListener('click', () => { menuData.categories.push({ id: uid(), categoria: "Nueva Categoría", icono: "🍽️", items: [] }); markDirty(); render(); });

// =====================================================
// ⚙️ CONFIGURACIÓN DEL SITIO
// =====================================================
const SITE_DEFAULTS = { nombre: 'Villa Paraíso', subtitulo: 'Guardalavaca', tagline: 'Cocina del mar & parrilla', horas: '🕐 12:00 - 23:00', footerMensaje: 'Gracias por preferirnos', footerSub: 'Será un placer atenderle', footerCopy: '© 2025 Villa Paraíso Guardalavaca' };
const SITE_FIELDS = { nombre: 'site-nombre', subtitulo: 'site-subtitulo', tagline: 'site-tagline', horas: 'site-horas', footerMensaje: 'site-footerMensaje', footerSub: 'site-footerSub', footerCopy: 'site-footerCopy' };

function loadSiteConfig(site) {
  if (!menuData.site) menuData.site = {};
  Object.keys(SITE_DEFAULTS).forEach(k => { if (menuData.site[k] === undefined || menuData.site[k] === '') menuData.site[k] = SITE_DEFAULTS[k]; });
  Object.entries(SITE_FIELDS).forEach(([key, id]) => {
    const input = document.getElementById(id);
    if (input) { input.value = menuData.site[key] || ''; input.oninput = () => { menuData.site[key] = input.value; markDirty(); }; }
  });
}

// =====================================================
// 🎨 RENDERIZAR EDITOR DE CARTA
// =====================================================
function render() {
  container.innerHTML = '';
  if (menuData.categories.length === 0) { container.innerHTML = '<p class="empty-msg">No hay categorías.</p>'; return; }

  menuData.categories.forEach((cat) => {
    const card = document.createElement('div'); card.className = 'category-card';
    
    // HEAD
    const head = document.createElement('div'); head.className = 'category-head';
    const iconInput = document.createElement('input'); iconInput.className = 'cat-icon-input'; iconInput.value = cat.icono || '🍽️'; iconInput.maxLength = 3; iconInput.oninput = () => { cat.icono = iconInput.value; markDirty(); };
    const nameInput = document.createElement('input'); nameInput.className = 'cat-name-input'; nameInput.value = cat.categoria || ''; nameInput.oninput = () => { cat.categoria = nameInput.value; markDirty(); };
    const delCat = document.createElement('button'); delCat.className = 'btn-danger btn-small'; delCat.textContent = '🗑️ Eliminar'; delCat.onclick = () => { if (confirm(`¿Eliminar "${cat.categoria}"?`)) { menuData.categories = menuData.categories.filter(c => c.id !== cat.id); markDirty(); render(); } };
    head.append(iconInput, nameInput, delCat); card.appendChild(head);

    // BODY
    const body = document.createElement('div'); body.className = 'category-body';

    if (cat.subgrupos && cat.subgrupos.length > 0) {
      cat.subgrupos.forEach(sub => body.appendChild(renderSubgroup(cat, sub)));
    } else {
      if (!cat.items) cat.items = [];
      body.appendChild(renderGalleryField(cat, `Fotos de "${cat.categoria || 'esta categoría'}"`));
      body.appendChild(renderTools(cat.items, () => render()));
      cat.items.forEach(item => body.appendChild(renderItem(cat.items, item)));
      const addBtn = document.createElement('button'); addBtn.className = 'btn-add btn-small'; addBtn.textContent = '+ Añadir plato'; addBtn.style.marginTop = '8px'; addBtn.onclick = () => { cat.items.push({ id: uid(), nombre: "Nuevo plato", precio: 0, descripcion: "", disponible: true }); markDirty(); render(); }; body.appendChild(addBtn);
    }

    const convertBtn = document.createElement('button'); convertBtn.className = 'btn-secondary btn-small'; convertBtn.style.marginTop = '12px'; convertBtn.style.width = '100%';
    if (!cat.subgrupos || cat.subgrupos.length === 0) {
      convertBtn.textContent = '📂 Convertir en subcategorías (agrupar platos)';
      convertBtn.onclick = () => { if (!confirm(`Convertir platos de "${cat.categoria}" en subgrupo "General". ¿Continuar?`)) return; addSubgroup(cat.id); };
    } else {
      convertBtn.textContent = '+ Añadir subcategoría'; convertBtn.onclick = () => addSubgroup(cat.id);
    }
    body.appendChild(convertBtn);
    card.appendChild(body); container.appendChild(card);
  });
}

function addSubgroup(catId) {
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;
  if (!cat.subgrupos) { cat.subgrupos = [{ id: uid(), titulo: "General", items: cat.items || [] }]; delete cat.items; }
  cat.subgrupos.push({ id: uid(), titulo: "Nueva Subcategoría", items: [] });
  markDirty(); render();
}

function renderSubgroup(cat, sub) {
  const block = document.createElement('div'); block.className = 'subgroup-block';
  const head = document.createElement('div'); head.className = 'subgroup-head';
  const titleInput = document.createElement('input'); titleInput.className = 'subgroup-title-input'; titleInput.value = sub.titulo || ''; titleInput.oninput = () => { sub.titulo = titleInput.value; markDirty(); };
  const delSub = document.createElement('button'); delSub.className = 'btn-danger btn-small'; delSub.textContent = '🗑️'; delSub.onclick = () => { if (confirm(`¿Eliminar subcategoría "${sub.titulo}"?`)) { cat.subgrupos = cat.subgrupos.filter(s => s.id !== sub.id); if (cat.subgrupos.length === 0) { cat.items = []; delete cat.subgrupos; } markDirty(); render(); } };
  head.append(titleInput, delSub); block.appendChild(head);

  block.appendChild(renderGalleryField(sub, `Fotos de "${sub.titulo || 'esta sección'}"`));
  if (!sub.items) sub.items = [];
  block.appendChild(renderTools(sub.items, () => render()));
  sub.items.forEach(item => block.appendChild(renderItem(sub.items, item)));
  const addBtn = document.createElement('button'); addBtn.className = 'btn-add btn-small'; addBtn.textContent = '+ Añadir plato'; addBtn.style.marginTop = '8px'; addBtn.onclick = () => { sub.items.push({ id: uid(), nombre: "Nuevo plato", precio: 0, descripcion: "", disponible: true }); markDirty(); render(); }; block.appendChild(addBtn);
  return block;
}

function renderTools(items, onRerender) {
  const bar = document.createElement('div'); bar.className = 'category-tools';
  const label = document.createElement('span'); label.className = 'tools-label'; label.textContent = 'Día de hoy:'; bar.appendChild(label);
  const btnOn = document.createElement('button'); btnOn.className = 'btn-all-on'; btnOn.textContent = '✅ Marcar todo'; btnOn.onclick = () => { items.forEach(it => it.disponible = true); markDirty(); (onRerender || render)(); }; bar.appendChild(btnOn);
  const btnOff = document.createElement('button'); btnOff.className = 'btn-all-off'; btnOff.textContent = '🚫 Desmarcar todo'; btnOff.onclick = () => { items.forEach(it => it.disponible = false); markDirty(); (onRerender || render)(); }; bar.appendChild(btnOff);
  const disponibles = items.filter(it => it.disponible !== false).length;
  const counter = document.createElement('span'); counter.className = 'avail-counter'; counter.textContent = `${disponibles}/${items.length} disponibles`; bar.appendChild(counter);
  return bar;
}

function createAvailToggle(item) {
  const wrap = document.createElement('label'); wrap.className = 'avail-toggle';
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = item.disponible !== false;
  input.onchange = () => {
    item.disponible = input.checked; markDirty();
    const row = wrap.closest('.item-row'); if (row) row.classList.toggle('unavailable', !input.checked);
    const parentBlock = wrap.closest('.subgroup-block') || wrap.closest('.category-body');
    if (parentBlock) {
      const counter = parentBlock.querySelector('.avail-counter');
      if (counter) {
        const rows = parentBlock.querySelectorAll('.item-row');
        counter.textContent = `${Array.from(rows).filter(r => !r.classList.contains('unavailable')).length}/${rows.length} disponibles`;
      }
    }
  };
  const slider = document.createElement('span'); slider.className = 'avail-slider';
  wrap.append(input, slider); return wrap;
}

function renderItem(arr, item) {
  const row = document.createElement('div'); row.className = 'item-row'; if (item.disponible === false) row.classList.add('unavailable');
  const toggle = createAvailToggle(item);
  const nameInput = document.createElement('input'); nameInput.placeholder = 'Nombre del plato'; nameInput.value = item.nombre || ''; nameInput.oninput = () => { item.nombre = nameInput.value; markDirty(); };
  const priceInput = document.createElement('input'); priceInput.className = 'item-price-input'; priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.placeholder = 'Precio'; priceInput.value = item.precio ?? 0; priceInput.oninput = () => { item.precio = parseFloat(priceInput.value) || 0; markDirty(); };
  const actions = document.createElement('div'); actions.className = 'item-actions';
  const delBtn = document.createElement('button'); delBtn.className = 'btn-danger btn-small'; delBtn.textContent = '🗑️'; delBtn.onclick = () => { if (confirm(`¿Eliminar "${item.nombre}"?`)) { arr.splice(arr.indexOf(item), 1); markDirty(); render(); } }; actions.appendChild(delBtn);
  const descInput = document.createElement('textarea'); descInput.placeholder = 'Descripción'; descInput.value = item.descripcion || ''; descInput.rows = 2; descInput.oninput = () => { item.descripcion = descInput.value; markDirty(); };
  row.append(toggle, nameInput, priceInput, actions, descInput); return row;
}

// =====================================================
// 🖼️ OPTIMIZACIÓN Y SUBIDA DE FOTOS (GALERÍA)
// =====================================================
async function optimizeImage(file) {
  const img = await createImageBitmap(file); let w = img.width, h = img.height; const max = 1200;
  if (w > max || h > max) { if (w >= h) { h = Math.round((h / w) * max); w = max; } else { w = Math.round((w / h) * max); h = max; } }
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h); img.close?.();
  const blob = await new Promise(res => canvas.toBlob(b => res(b), 'image/webp', 0.85));
  return new File([blob], `${file.name.split('.')[0]}.webp`, { type: 'image/webp' });
}

function renderGalleryField(obj, labelText) {
  const wrap = document.createElement('div'); wrap.className = 'image-field';
  const label = document.createElement('label'); label.textContent = `📸 ${labelText}`; wrap.appendChild(label);

  if (!obj.imagenes) { obj.imagenes = obj.imagen ? [obj.imagen] : []; delete obj.imagen; }

  const previewContainer = document.createElement('div'); previewContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;';

  function renderThumbnails() {
    previewContainer.innerHTML = '';
    obj.imagenes.forEach((url, index) => {
      const thumb = document.createElement('div'); thumb.style.cssText = 'position:relative; width:80px; height:80px; border-radius:8px; border:2px solid var(--primary); overflow:hidden;';
      thumb.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;">`;
      const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.style.cssText = 'position:absolute; top:2px; right:2px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:10px; cursor:pointer;'; delBtn.textContent = '✕';
      delBtn.onclick = () => { obj.imagenes.splice(index, 1); markDirty(); renderThumbnails(); };
      thumb.appendChild(delBtn); previewContainer.appendChild(thumb);
    });
  }
  renderThumbnails(); wrap.appendChild(previewContainer);

  const dropZone = document.createElement('div'); dropZone.className = 'drop-zone';
  dropZone.innerHTML = `<span class="drop-icon">📤</span><span class="drop-text">Añadir foto al carrusel</span>`;
  const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none'; dropZone.appendChild(fileInput);
  dropZone.onclick = () => fileInput.click();

  fileInput.onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    dropZone.classList.add('uploading'); dropZone.querySelector('.drop-text').textContent = 'Subiendo...';
    try {
      const optimized = await optimizeImage(file);
      const path = `gal-${Date.now()}.${optimized.name.split('.').pop().toLowerCase()}`;
      const { error } = await supabase.storage.from('fotos').upload(path, optimized, { contentType: optimized.type });
      if (error) throw error;
      const { data } = supabase.storage.from('fotos').getPublicUrl(path);
      obj.imagenes.push(data.publicUrl); markDirty(); renderThumbnails();
    } catch (err) { alert('Error al subir: ' + err.message); } 
    finally { dropZone.classList.remove('uploading'); dropZone.querySelector('.drop-text').textContent = 'Añadir foto al carrusel'; fileInput.value = ''; }
  };

  wrap.appendChild(dropZone); return wrap;
}

// =====================================================
// 📋 PANEL DE PEDIDOS (REALTIME)
// =====================================================
async function cargarPedidos() {
  try {
    let query = supabase.from('pedidos').select('*').order('creado_en', { ascending: false });
    if (!mostrarHistorial) { const hoy = new Date(); hoy.setHours(0,0,0,0); query = query.gte('creado_en', hoy.toISOString()); }
    const { data, error } = await query.limit(100);
    if (error) throw error;
    pedidosActuales = data || [];
    renderPedidos(); actualizarBadge();
  } catch (err) { console.error(err); if(pedidosContainer) pedidosContainer.innerHTML = `<p style="color:red">Error al cargar pedidos</p>`; }
}

function renderPedidos() {
  if (!pedidosContainer) return;
  if (pedidosActuales.length === 0) {
    pedidosContainer.innerHTML = `<div style="text-align:center;padding:40px;color:#999;"><h3>Sin pedidos por ahora</h3><p>Los pedidos aparecerán aquí.</p></div>`;
    return;
  }

  const agrupados = { pendiente: [], confirmado: [], en_preparacion: [], entregado: [], cancelado: [] };
  pedidosActuales.forEach(p => { if (agrupados[p.estado]) agrupados[p.estado].push(p); else agrupados['pendiente'].push(p); });

  const ESTADOS = [
    { key: 'pendiente', titulo: '🔴 Pendientes' }, { key: 'confirmado', titulo: '🟡 Confirmados' },
    { key: 'en_preparacion', titulo: '🍳 En preparación' }, { key: 'entregado', titulo: '🟢 Entregados' }
  ];

  let html = '';
  ESTADOS.forEach(estado => {
    const lista = agrupados[estado.key] || [];
    if (lista.length === 0 && estado.key !== 'pendiente') return;
    
    html += `<div class="pedidos-section"><h3 class="pedidos-section-title estado-${estado.key}">${estado.titulo} <span class="pedidos-count">${lista.length}</span></h3>`;
    if(lista.length === 0) html += `<p style="text-align:center;color:#999;font-size:0.85rem;">Sin pedidos</p>`;
    else lista.forEach(p => html += renderPedidoCard(p));
    html += `</div>`;
  });
  pedidosContainer.innerHTML = html;

  pedidosContainer.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = () => manejarAccionPedido(btn.dataset.action, btn.dataset.id);
  });
}

function renderPedidoCard(pedido) {
  const hora = new Date(pedido.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const itemsHTML = (pedido.items || []).map(item => `<div class="pedido-item"><span class="item-cant">×${item.cantidad}</span><span class="item-nom">${escapeHTML(item.nombre)}</span><span class="item-sub">$${(item.precio * item.cantidad).toFixed(2)}</span></div>`).join('');
  const notasHTML = pedido.notas ? `<div class="pedido-notas">📝 ${escapeHTML(pedido.notas)}</div>` : '';

  let botones = '';
  if (pedido.estado === 'pendiente') botones = `<button class="pedido-btn btn-confirmar" data-action="confirmar" data-id="${pedido.id}">✅ Confirmar</button><button class="pedido-btn btn-rechazar" data-action="rechazar" data-id="${pedido.id}">❌</button>`;
  else if (pedido.estado === 'confirmado') botones = `<button class="pedido-btn btn-preparar" data-action="preparar" data-id="${pedido.id}">🍳 Preparar</button>`;
  else if (pedido.estado === 'en_preparacion') botones = `<button class="pedido-btn btn-entregar" data-action="entregar" data-id="${pedido.id}">✅ Entregar</button>`;

  return `
    <div class="pedido-card ${pedido.estado}">
      <div class="pedido-header">
        <div class="pedido-mesa"><div class="mesa-icon">${pedido.mesa}</div><div class="pedido-mesa-info"><div class="mesa-num">Mesa ${pedido.mesa}</div><div class="mesa-hora">🕐 ${hora}</div></div></div>
      </div>
      <div class="pedido-items">${itemsHTML}</div>
      ${notasHTML}
      <div class="pedido-total"><span>Total</span><strong>$${Number(pedido.total).toFixed(2)}</strong></div>
      <div class="pedido-acciones">${botones}</div>
    </div>`;
}

async function manejarAccionPedido(accion, id) {
  const estados = { confirmar: 'confirmado', rechazar: 'cancelado', preparar: 'en_preparacion', entregar: 'entregado' };
  if (!estados[accion]) return;
  try {
    await supabase.from('pedidos').update({ estado: estados[accion] }).eq('id', id);
    cargarPedidos();
  } catch (err) { alert('Error: ' + err.message); }
}

function actualizarBadge() {
  if (!pedidosBadge) return;
  const pendientes = pedidosActuales.filter(p => p.estado === 'pendiente').length;
  if (pendientes > 0) { pedidosBadge.textContent = pendientes; pedidosBadge.classList.remove('hidden'); } 
  else { pedidosBadge.classList.add('hidden'); }
}

function suscribirRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel('admin-live').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
    cargarPedidos();
  }).subscribe((status) => {
    if (rtStatus) rtStatus.textContent = status === 'SUBSCRIBED' ? '🟢 En vivo' : '🔴 Desconectado';
  });
}

if (refreshPedidosBtn) refreshPedidosBtn.onclick = cargarPedidos;
if (toggleHistorial) toggleHistorial.onclick = () => { mostrarHistorial = !mostrarHistorial; toggleHistorial.textContent = mostrarHistorial ? '📁 Ver solo hoy' : '📁 Ver historial'; cargarPedidos(); };


// =====================================================
// 📱 GENERADOR DE QRs
// =====================================================
const SECRETO = 'VillaParaiso-Secreto-Muy-Dificil-De-Adivinar-2025';

async function generarHash(mesa) {
  const encoder = new TextEncoder();
  const data = encoder.encode(mesa + SECRETO);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}
// 👁️ Botón "Ver Menú" con token de seguridad
const verMenuBtn = document.getElementById('verMenuBtn');
if (verMenuBtn) {
  verMenuBtn.onclick = async () => {
    // Generamos un token para una mesa de prueba llamada "preview"
    const hash = await generarHash('preview');
    const url = `https://villaparaiso.vercel.app/?mesa=preview&t=${hash}`;
    
    // Abrimos el menú en una nueva pestaña
    window.open(url, '_blank');
  };
}

if (qrGenerarBtn) {
  qrGenerarBtn.onclick = async () => {
    const mesa = qrMesaInput.value.trim();
    if (!mesa) return alert('Escribe un número de mesa');
    
    qrGenerarBtn.disabled = true;
    qrGenerarBtn.textContent = 'Generando...';

    try {
      const hash = await generarHash(mesa);
      const url = `https://villaparaiso.vercel.app/?mesa=${mesa}&t=${hash}`;
      
      // Usamos una API pública para generar la imagen del QR y que puedas descargarla
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
      
      qrResultado.innerHTML = `
        <div style="text-align:center; padding: 20px; background: white; border-radius: 12px; border: 2px solid var(--primary);">
          <h3 style="margin-bottom:10px;">QR para Mesa ${mesa}</h3>
          <img src="${qrImgUrl}" alt="QR Mesa ${mesa}" style="border-radius:8px; margin-bottom:15px; width: 250px; height: 250px;">
          <p style="word-break: break-all; font-size: 0.8rem; color: #666; margin-bottom: 15px;">${url}</p>
          <a href="${qrImgUrl}" target="_blank" download="QR-Mesa-${mesa}.png" class="btn-primary" style="text-decoration:none; display:inline-block;">⬇️ Descargar Imagen</a>
        </div>
      `;
    } catch (e) {
      alert('Error al generar QR: ' + e.message);
    } finally {
      qrGenerarBtn.disabled = false;
      qrGenerarBtn.textContent = 'Generar QR';
    }
  };
}