// =====================================================
// 🍽️  MENÚ DIGITAL + COMANDA - VILLA PARAÍSO GUARDALAVACA
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let menuData = { categories: [] };
let mesaActual = null;
let carrito = []; 

const CARRITO_KEY = 'villa-paraiso-carrito';
const MESA_KEY = 'villa-paraiso-mesa';

const fallbackMenu = {
  categories: [
    { categoria: "Entrantes", icono: "🥗", items: [{ nombre: "Croquetas de Jamón", precio: 120, descripcion: "5 unidades.", alergenos: "Gluten, Lácteos" }] }
  ]
};

// ========== ELEMENTOS DEL DOM ==========
const categoriesNav = document.getElementById('categories');
const menuContainer = document.getElementById('menu');
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const cartEnviar = document.getElementById('cartEnviar');
const cartNotas = document.getElementById('cartNotas');
const mesaBanner = document.getElementById('mesaBanner');
const mesaNumero = document.getElementById('mesaNumero');
const toast = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMsg = document.getElementById('toastMsg');

// ========== HELPERS ==========
const formatPrice = (price) => `$${(Number(price) || 0).toFixed(2)}`;
const escapeHTML = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
const estaDisponible = (item) => item.disponible !== false;

// =====================================================
// 🍽️ DETECTAR MESA
// =====================================================
function detectarMesa() {
  const params = new URLSearchParams(window.location.search);
  const mesa = params.get('mesa');

  if (mesa && mesa.trim()) {
    mesaActual = mesa.trim();
    localStorage.setItem(MESA_KEY, mesaActual);
    mesaNumero.textContent = mesaActual;
    mesaBanner.classList.remove('hidden');
    document.body.classList.add('has-mesa');
    cartBtn.classList.remove('hidden');
  } else {
    mesaActual = null;
    localStorage.removeItem(MESA_KEY);
    mesaBanner.classList.add('hidden');
    cartBtn.classList.add('hidden');
    document.body.classList.remove('has-mesa');
  }
}

// =====================================================
// 🛒 COMANDA
// =====================================================
function cargarCarrito() {
  try {
    const saved = localStorage.getItem(CARRITO_KEY);
    carrito = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(carrito)) carrito = [];
  } catch (e) { carrito = []; }
}

function guardarCarrito() {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  actualizarUI();
}

function limpiarCarrito() {
  carrito = [];
  localStorage.removeItem(CARRITO_KEY);
  if (cartNotas) cartNotas.value = '';
  actualizarUI();
}

function calcularTotal() { return carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0); }
function contarItems() { return carrito.reduce((sum, item) => sum + item.cantidad, 0); }

function agregarAlCarrito(nombre, precio) {
  const existente = carrito.find(i => i.nombre === nombre);
  if (existente) existente.cantidad += 1;
  else carrito.push({ nombre, precio: Number(precio) || 0, cantidad: 1 });
  guardarCarrito();
  mostrarToast('✅ Añadido', `${nombre} agregado a tu comanda`, false);
}

function cambiarCantidad(nombre, delta) {
  const item = carrito.find(i => i.nombre === nombre);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) carrito = carrito.filter(i => i.nombre !== nombre);
  guardarCarrito();
}

function eliminarDelCarrito(nombre) {
  carrito = carrito.filter(i => i.nombre !== nombre);
  guardarCarrito();
}

// =====================================================
// 🎨 CABECERA AUTOMÁTICA COMANDA
// =====================================================
function actualizarCabeceraComanda() {
  const comandaMesa = document.getElementById('comandaMesa');
  const comandaFecha = document.getElementById('comandaFecha');
  if (comandaMesa) comandaMesa.textContent = mesaActual ? mesaActual : 'S/N';
  if (comandaFecha) {
    const hoy = new Date();
    comandaFecha.textContent = `${hoy.getDate().toString().padStart(2, '0')}/${(hoy.getMonth()+1).toString().padStart(2, '0')}/${hoy.getFullYear()}`;
  }
}

// =====================================================
// 🎨 UI COMANDA
// =====================================================
function actualizarUI() {
  const total = contarItems();
  if (total > 0) { cartCount.textContent = total; cartCount.classList.remove('hidden'); } 
  else { cartCount.classList.add('hidden'); }

  if (carrito.length === 0) {
    cartItems.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">📋</span>Tu comanda está vacía</div>`;
    cartEnviar.disabled = true;
  } else {
    cartItems.innerHTML = carrito.map(item => `
      <div class="cart-item">
        <div class="cart-item-qty">
          <button class="cart-qty-btn menos" data-nombre="${escapeHTML(item.nombre)}" data-delta="-1">−</button>
          <span class="cart-item-cantidad">${item.cantidad}</span>
          <button class="cart-qty-btn mas" data-nombre="${escapeHTML(item.nombre)}" data-delta="1">+</button>
        </div>
        <div class="cart-item-info">
          <div class="cart-item-nombre">${escapeHTML(item.nombre)}</div>
          <div class="cart-item-precio">${formatPrice(item.precio)} c/u</div>
        </div>
        <div class="cart-item-subtotal">${formatPrice(item.precio * item.cantidad)}</div>
        <button class="cart-item-eliminar" data-nombre="${escapeHTML(item.nombre)}" title="Eliminar">🗑️</button>
      </div>
    `).join('');

    cartItems.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.onclick = () => {
        const nombre = btn.dataset.nombre;
        const delta = parseInt(btn.dataset.delta, 10);
        const itemEl = btn.closest('.cart-item');
        const counter = itemEl?.querySelector('.cart-item-cantidad');
        if (counter) { counter.classList.add('bump'); setTimeout(() => counter.classList.remove('bump'), 350); }
        cambiarCantidad(nombre, delta);
      };
    });

    cartItems.querySelectorAll('.cart-item-eliminar').forEach(btn => {
      btn.onclick = () => {
        if (confirm(`¿Eliminar "${btn.dataset.nombre}" de la comanda?`)) eliminarDelCarrito(btn.dataset.nombre);
      };
    });
    cartEnviar.disabled = false;
  }

  cartTotal.textContent = formatPrice(calcularTotal());

  document.querySelectorAll('.btn-add-item').forEach(btn => {
    const nombre = btn.dataset.nombre;
    const enCarrito = carrito.some(i => i.nombre === nombre);
    if (enCarrito) { btn.classList.add('added'); btn.textContent = '✓ En la comanda'; } 
    else { btn.classList.remove('added'); btn.textContent = '+ Añadir'; }
  });
}

// =====================================================
// 🍞 TOAST
// =====================================================
let toastTimer = null;
function mostrarToast(titulo, mensaje, esError = false) {
  toastTitle.textContent = titulo;
  toastMsg.textContent = mensaje;
  toast.classList.toggle('toast-error', esError);
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// =====================================================
// 📤 ENVIAR COMANDA
// =====================================================
async function enviarPedido() {
  if (!mesaActual) { mostrarToast('❌ Error', 'No se detectó la mesa.', true); return; }
  if (carrito.length === 0) { mostrarToast('⚠️ Vacía', 'Añade platos antes de enviar', true); return; }

  cartEnviar.disabled = true;
  cartEnviar.classList.add('enviando');
  cartEnviar.textContent = '⏳ Enviando...';

  try {
    const { error } = await supabase.from('pedidos').insert({
      mesa: mesaActual, items: carrito, total: calcularTotal(),
      notas: cartNotas.value.trim(), estado: 'pendiente'
    });

    if (error) throw error;

    cartEnviar.textContent = '✅ ¡Enviada!';
    mostrarToast('🎉 ¡Comanda enviada!', `Mesa ${mesaActual} · Tu mesero la recibirá en un momento`, false);

    setTimeout(() => {
      limpiarCarrito(); cerrarCarrito();
      cartEnviar.classList.remove('enviando');
      cartEnviar.textContent = '✅ Enviar comanda al mesero';
      cartEnviar.disabled = false;
    }, 1200);
  } catch (err) {
    console.error(err);
    cartEnviar.disabled = false;
    cartEnviar.classList.remove('enviando');
    cartEnviar.textContent = '✅ Enviar comanda al mesero';
    mostrarToast('❌ Error', 'Revisa tu conexión e inténtalo de nuevo', true);
  }
}

// =====================================================
// 🎨 RENDERIZAR
// =====================================================
function renderIconHTML(obj, size = '1.1em') {
  if (obj.iconoImg) return `<img src="${escapeHTML(obj.iconoImg)}" style="width:${size};height:${size};object-fit:contain;vertical-align:-0.2em;margin-right:6px;display:inline-block;">`;
  if (obj.icono) return `<span style="margin-right:4px;">${escapeHTML(obj.icono)}</span>`;
  return '';
}

function applySiteConfig(site) {
  if (!site) return;
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setText('heroNombre', site.nombre); setText('heroSubtitulo', site.subtitulo);
  setText('heroTagline', site.tagline); setText('heroHoras', site.horas);
  setText('footerSub', site.footerSub); setText('footerCopy', site.footerCopy);

  const footerMsg = document.getElementById('footerMensaje');
  if (footerMsg && site.footerMensaje) {
    const textoLimpio = String(site.footerMensaje).replace(/<[^>]*>/g, '').trim();
    const nombre = site.nombre || '';
    if (nombre && textoLimpio.includes(nombre)) {
      footerMsg.innerHTML = textoLimpio.replace(nombre, `<strong>${nombre}</strong>`);
    } else { footerMsg.textContent = textoLimpio; }
  }
  if (site.logoUrl) { const logo = document.getElementById('heroLogo'); if (logo) logo.src = site.logoUrl; }
  if (site.nombre) document.title = `${site.nombre} · Carta`;
}

async function loadFromSupabase() {
  try {
    const { data, error } = await supabase.from('menu').select('data').eq('id', 'main').single();
    if (error) throw error;
    if (data?.data?.categories?.length) menuData = data.data;
    if (data?.data?.site) applySiteConfig(data.data.site);
  } catch (err) {
    console.warn('⚠️ Usando respaldo:', err.message); menuData = fallbackMenu;
  }
  renderMenu(); actualizarUI();
}

function renderMenu() {
  categoriesNav.innerHTML = ''; menuContainer.innerHTML = '';

  menuData.categories.forEach((cat, index) => {
    let tieneDisponibles = cat.subgrupos?.length > 0 
      ? cat.subgrupos.some(sub => (sub.items || []).some(estaDisponible))
      : (cat.items || []).some(estaDisponible);
    if (!tieneDisponibles) return;

    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.innerHTML = renderIconHTML(cat) + escapeHTML(cat.categoria || '');
    btn.onclick = () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`cat-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    categoriesNav.appendChild(btn);
  });

  const primerBtn = categoriesNav.querySelector('.category-btn');
  if (primerBtn) primerBtn.classList.add('active');

  menuData.categories.forEach((cat, index) => {
    let tieneDisponibles = cat.subgrupos?.length > 0 
      ? cat.subgrupos.some(sub => (sub.items || []).some(estaDisponible))
      : (cat.items || []).some(estaDisponible);
    if (!tieneDisponibles) return;

    const section = document.createElement('section');
    section.className = 'category-section'; section.id = `cat-${index}`;

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.innerHTML = renderIconHTML(cat, '1.2em') + escapeHTML(cat.categoria || '');
    section.appendChild(title);

    if (cat.subgrupos?.length > 0) {
      cat.subgrupos.forEach(sub => {
        const visibles = (sub.items || []).filter(estaDisponible);
        if (visibles.length === 0) return;
        const subTitle = document.createElement('h3');
        subTitle.className = 'subcategory-title'; subTitle.textContent = sub.titulo || '';
        section.appendChild(subTitle);
        section.appendChild(sub.imagen ? renderGallery(sub.imagen, sub.items) : renderItems(sub.items || []));
      });
    } else {
      section.appendChild(cat.imagen ? renderGallery(cat.imagen, cat.items) : renderItems(cat.items || []));
    }
    menuContainer.appendChild(section);
  });
}

function renderItems(items) {
  const grid = document.createElement('div');
  grid.className = 'items-grid';
  const visibles = (items || []).filter(estaDisponible);

  if (visibles.length === 0) { grid.innerHTML = `<p style="color:#999;font-style:italic;padding:14px;text-align:center;">No hay platos disponibles.</p>`; return grid; }

  visibles.forEach(item => {
    const el = document.createElement('article');
    el.className = 'menu-item';

    const badgeHTML = item.badge ? `<span class="badge ${item.tipo || ''}">${item.tipo === 'premium' ? '⭐' : item.tipo === 'veg' ? '🌱' : '•'} ${escapeHTML(item.badge)}</span>` : '';
    const alergenosHTML = item.alergenos ? `<span class="badge alergeno">⚠️ Contiene: ${escapeHTML(item.alergenos)}</span>` : '';
    const descHTML = item.descripcion ? `<p class="item-desc">${escapeHTML(item.descripcion)}</p>` : '';
    const addBtnHTML = mesaActual ? `<button class="btn-add-item" data-nombre="${escapeHTML(item.nombre)}" data-precio="${item.precio}">+ Añadir</button>` : '';

    el.innerHTML = `
      <div class="item-info">
        <div class="item-header">
          <span class="item-name">${escapeHTML(item.nombre || 'Sin nombre')}</span>
          <span class="item-price">${formatPrice(item.precio)}</span>
        </div>
        ${descHTML}
        <div>${alergenosHTML} ${badgeHTML}</div>
        ${addBtnHTML}
      </div>
    `;
    grid.appendChild(el);
  });

  grid.querySelectorAll('.btn-add-item').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      agregarAlCarrito(btn.dataset.nombre, parseFloat(btn.dataset.precio) || 0);
    };
  });
  return grid;
}

// =====================================================
// 📸 FOTO GRANDE + LISTA DE PLATOS
// =====================================================
function renderGallery(imagenUrl, items) {
  const container = document.createElement('div');
  container.className = 'gallery-layout';

  // 1. Foto Grande Arriba (sin textos)
  if (imagenUrl) {
    const photoWrapper = document.createElement('div');
    photoWrapper.className = 'dish-photo-header';
    const img = document.createElement('img');
    img.src = imagenUrl; 
    img.loading = 'lazy';
    img.onerror = () => { photoWrapper.style.display = 'none'; };
    photoWrapper.appendChild(img); 
    container.appendChild(photoWrapper);
  }

  // 2. Lista de platos normal debajo de la foto
  const itemsGrid = renderItems(items);
  container.appendChild(itemsGrid);

  return container;
}

function abrirCarrito() { actualizarCabeceraComanda(); cartOverlay.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function cerrarCarrito() { cartOverlay.classList.add('hidden'); document.body.style.overflow = ''; }

function iniciar() {
  detectarMesa(); cargarCarrito(); actualizarUI();
  cartBtn.onclick = abrirCarrito;
  cartClose.onclick = cerrarCarrito;
  cartEnviar.onclick = enviarPedido;
  cartOverlay.onclick = (e) => { if (e.target === cartOverlay) cerrarCarrito(); };
  loadFromSupabase();
}

iniciar();