// =====================================================
// 🍽️  MENÚ DIGITAL + CARRITO - VILLA PARAÍSO GUARDALAVACA
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// 📦 ESTADO GLOBAL
// =====================================================
let menuData = { categories: [] };
let mesaActual = null;
let carrito = [];

const CARRITO_KEY = 'villa-paraiso-carrito';
const MESA_KEY = 'villa-paraiso-mesa';

// =====================================================
// 🔁 MENÚ DE RESPALDO
// =====================================================
const fallbackMenu = {
  categories: [
    { categoria: "Entrantes", icono: "🥗", items: [
      { nombre: "Croquetas de Jamón", precio: 120, descripcion: "5 unidades." }
    ]}
  ]
};

// =====================================================
// 🎯 ELEMENTOS DEL DOM
// =====================================================
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

// =====================================================
// 🛠️ HELPERS
// =====================================================
const formatPrice = (price) => `$${(Number(price) || 0).toFixed(2)}`;

const escapeHTML = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const estaDisponible = (item) => item.disponible !== false;

// =====================================================
// 🍽️ DETECTAR MESA DESDE LA URL
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
    console.log(`✅ Mesa detectada: ${mesaActual}`);
  } else {
    mesaActual = null;
    localStorage.removeItem(MESA_KEY);
    mesaBanner.classList.add('hidden');
    cartBtn.classList.add('hidden');
    document.body.classList.remove('has-mesa');
    console.log('ℹ️ Sin mesa asignada — modo solo consulta');
  }
}

// =====================================================
// 🛒 CARRITO — Persistencia
// =====================================================
function cargarCarrito() {
  try {
    const saved = localStorage.getItem(CARRITO_KEY);
    carrito = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(carrito)) carrito = [];
  } catch (e) {
    carrito = [];
  }
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

function calcularTotal() {
  return carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
}

function contarItems() {
  return carrito.reduce((sum, item) => sum + item.cantidad, 0);
}

// =====================================================
// 🛒 CARRITO — Operaciones
// =====================================================
function agregarAlCarrito(nombre, precio) {
  const existente = carrito.find(i => i.nombre === nombre);
  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({ nombre, precio: Number(precio) || 0, cantidad: 1 });
  }
  guardarCarrito();
  mostrarToast('✅ Añadido', `${nombre} agregado a tu pedido`, false);
}

function cambiarCantidad(nombre, delta) {
  const item = carrito.find(i => i.nombre === nombre);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(i => i.nombre !== nombre);
  }
  guardarCarrito();
}

function eliminarDelCarrito(nombre) {
  carrito = carrito.filter(i => i.nombre !== nombre);
  guardarCarrito();
}

// =====================================================
// 🎨 CARRITO — Actualizar UI
// =====================================================
function actualizarUI() {
  // Contador del botón
  const total = contarItems();
  if (total > 0) {
    cartCount.textContent = total;
    cartCount.classList.remove('hidden');
  } else {
    cartCount.classList.add('hidden');
  }

  // Items
  if (carrito.length === 0) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <span class="cart-empty-icon">🛒</span>
        Tu pedido está vacío
      </div>
    `;
    cartEnviar.disabled = true;
  } else {
    cartItems.innerHTML = carrito.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-nombre">${escapeHTML(item.nombre)}</div>
          <div class="cart-item-precio">${formatPrice(item.precio)} c/u</div>
        </div>
        <div class="cart-item-qty">
          <button class="cart-qty-btn menos" data-nombre="${escapeHTML(item.nombre)}" data-delta="-1" aria-label="Restar">−</button>
          <span class="cart-item-cantidad">${item.cantidad}</span>
          <button class="cart-qty-btn mas" data-nombre="${escapeHTML(item.nombre)}" data-delta="1" aria-label="Sumar">+</button>
        </div>
        <div class="cart-item-subtotal">${formatPrice(item.precio * item.cantidad)}</div>
        <button class="cart-item-eliminar" data-nombre="${escapeHTML(item.nombre)}" title="Eliminar">🗑️</button>
      </div>
    `).join('');

    // Handlers de cantidad con animación
    cartItems.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.onclick = () => {
        const nombre = btn.dataset.nombre;
        const delta = parseInt(btn.dataset.delta, 10);

        const itemEl = btn.closest('.cart-item');
        const counter = itemEl?.querySelector('.cart-item-cantidad');
        if (counter) {
          counter.classList.add('bump');
          setTimeout(() => counter.classList.remove('bump'), 350);
        }

        cambiarCantidad(nombre, delta);
      };
    });

    // Handlers de eliminar
    cartItems.querySelectorAll('.cart-item-eliminar').forEach(btn => {
      btn.onclick = () => {
        const nombre = btn.dataset.nombre;
        if (confirm(`¿Eliminar "${nombre}" del pedido?`)) {
          eliminarDelCarrito(nombre);
        }
      };
    });

    cartEnviar.disabled = false;
  }

  // Total
  cartTotal.textContent = formatPrice(calcularTotal());

  // Botones "Añadir" del menú
  document.querySelectorAll('.btn-add-item').forEach(btn => {
    const nombre = btn.dataset.nombre;
    const enCarrito = carrito.some(i => i.nombre === nombre);
    if (enCarrito) {
      btn.classList.add('added');
      btn.textContent = '✓ En el pedido';
    } else {
      btn.classList.remove('added');
      btn.textContent = '+ Añadir';
    }
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
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// =====================================================
// 📤 ENVIAR PEDIDO A SUPABASE
// =====================================================
async function enviarPedido() {
  if (!mesaActual) {
    mostrarToast('❌ Error', 'No se detectó la mesa. Escanea el QR de tu mesa.', true);
    return;
  }

  if (carrito.length === 0) {
    mostrarToast('⚠️ Pedido vacío', 'Añade algo antes de enviar', true);
    return;
  }

  cartEnviar.disabled = true;
  cartEnviar.classList.add('enviando');
  cartEnviar.textContent = '⏳ Enviando...';

  try {
    const total = calcularTotal();
    const notas = cartNotas.value.trim();

    const { data, error } = await supabase
      .from('pedidos')
      .insert({
        mesa: mesaActual,
        items: carrito,
        total: total,
        notas: notas,
        estado: 'pendiente'
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Pedido enviado:', data);

    cartEnviar.textContent = '✅ ¡Enviado!';
    mostrarToast('🎉 ¡Pedido enviado!', `Mesa ${mesaActual} · Tu mesero lo recibirá en un momento`, false);

    setTimeout(() => {
      limpiarCarrito();
      cerrarCarrito();
      cartEnviar.classList.remove('enviando');
      cartEnviar.textContent = '🍽️ Enviar pedido al mesero';
      cartEnviar.disabled = false;
    }, 1200);

  } catch (err) {
    console.error('❌ Error al enviar pedido:', err);
    cartEnviar.disabled = false;
    cartEnviar.classList.remove('enviando');
    cartEnviar.textContent = '🍽️ Enviar pedido al mesero';
    mostrarToast('❌ No se pudo enviar', 'Revisa tu conexión e inténtalo de nuevo', true);
  }
}

// =====================================================
// 🎨 RENDERIZAR ICONO
// =====================================================
function renderIconHTML(obj, size = '1.1em') {
  if (obj.iconoImg) {
    return `<img src="${escapeHTML(obj.iconoImg)}" alt="" 
              style="width:${size};height:${size};object-fit:contain;
                     vertical-align:-0.2em;margin-right:6px;display:inline-block;">`;
  }
  if (obj.icono) {
    return `<span style="margin-right:4px;">${escapeHTML(obj.icono)}</span>`;
  }
  return '';
}

// =====================================================
// 🎨 CONFIGURACIÓN DEL SITIO
// =====================================================
function applySiteConfig(site) {
  if (!site) return;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  };

  setText('heroNombre', site.nombre);
  setText('heroSubtitulo', site.subtitulo);
  setText('heroTagline', site.tagline);
  setText('heroHoras', site.horas);
  setText('heroWifi', site.wifi);
  setText('footerSub', site.footerSub);
  setText('footerCopy', site.footerCopy);

  const footerMsg = document.getElementById('footerMensaje');
  if (footerMsg && site.footerMensaje) {
    const textoLimpio = String(site.footerMensaje).replace(/<[^>]*>/g, '').trim();
    const nombre = site.nombre || '';
    if (nombre && textoLimpio.includes(nombre)) {
      const partes = textoLimpio.split(nombre);
      footerMsg.innerHTML = '';
      partes.forEach((parte, i) => {
        footerMsg.appendChild(document.createTextNode(parte));
        if (i < partes.length - 1) {
          const strong = document.createElement('strong');
          strong.textContent = nombre;
          footerMsg.appendChild(strong);
        }
      });
    } else {
      footerMsg.textContent = textoLimpio;
    }
  }

  if (site.logoUrl) {
    const logo = document.getElementById('heroLogo');
    if (logo) logo.src = site.logoUrl;
  }

  if (site.nombre) {
    document.title = `${site.nombre} · Carta`;
  }
}

// =====================================================
// 📥 CARGAR MENÚ
// =====================================================
async function loadFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('menu')
      .select('data')
      .eq('id', 'main')
      .single();

    if (error) throw error;
    if (data?.data?.categories?.length) {
      menuData = data.data;
      console.log('✅ Menú cargado');
    }
    if (data?.data?.site) {
      applySiteConfig(data.data.site);
    }
  } catch (err) {
    console.warn('⚠️ Error Supabase:', err.message);
    menuData = fallbackMenu;
  }
  renderMenu();
  actualizarUI();
}

// =====================================================
// 🎨 RENDERIZAR MENÚ
// =====================================================
function renderMenu() {
  categoriesNav.innerHTML = '';
  menuContainer.innerHTML = '';

  // Botones de categoría
  menuData.categories.forEach((cat, index) => {
    let tieneDisponibles = false;
    if (cat.subgrupos?.length > 0) {
      tieneDisponibles = cat.subgrupos.some(sub => (sub.items || []).some(estaDisponible));
    } else {
      tieneDisponibles = (cat.items || []).some(estaDisponible);
    }
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

  // Secciones
  menuData.categories.forEach((cat, index) => {
    let tieneDisponibles = false;
    if (cat.subgrupos?.length > 0) {
      tieneDisponibles = cat.subgrupos.some(sub => (sub.items || []).some(estaDisponible));
    } else {
      tieneDisponibles = (cat.items || []).some(estaDisponible);
    }
    if (!tieneDisponibles) return;

    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = `cat-${index}`;

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.innerHTML = renderIconHTML(cat, '1.2em') + escapeHTML(cat.categoria || '');
    section.appendChild(title);

    if (cat.subgrupos?.length > 0) {
      cat.subgrupos.forEach(sub => {
        const visibles = (sub.items || []).filter(estaDisponible);
        if (visibles.length === 0) return;

        const subTitle = document.createElement('h3');
        subTitle.className = 'subcategory-title';
        subTitle.textContent = sub.titulo || '';
        section.appendChild(subTitle);

        if (sub.imagen) {
          section.appendChild(renderGallery(sub.imagen, sub.items));
        } else {
          section.appendChild(renderItems(sub.items || []));
        }
      });
    } else {
      if (cat.imagen) {
        section.appendChild(renderGallery(cat.imagen, cat.items));
      } else {
        section.appendChild(renderItems(cat.items || []));
      }
    }

    menuContainer.appendChild(section);
  });

  if (menuContainer.children.length === 0) {
    menuContainer.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#999;"><p style="font-family:Cormorant Garamond,serif;font-size:1.3rem;font-style:italic;">La carta se está actualizando.</p></div>`;
  }
}

// =====================================================
// 🍽️ RENDERIZAR PLATOS
// =====================================================
function renderItems(items) {
  const grid = document.createElement('div');
  grid.className = 'items-grid';

  const visibles = (items || []).filter(estaDisponible);

  if (visibles.length === 0) {
    grid.innerHTML = `<p style="color:#999;font-style:italic;padding:14px;text-align:center;">No hay platos disponibles.</p>`;
    return grid;
  }

  visibles.forEach(item => {
    const el = document.createElement('article');
    el.className = 'menu-item';

    const badgeHTML = item.badge
      ? `<span class="badge ${item.tipo || ''}">${item.tipo === 'premium' ? '⭐' : item.tipo === 'veg' ? '🌱' : '•'} ${escapeHTML(item.badge)}</span>`
      : '';

    const descHTML = item.descripcion ? `<p class="item-desc">${escapeHTML(item.descripcion)}</p>` : '';

    const addBtnHTML = mesaActual
      ? `<button class="btn-add-item" data-nombre="${escapeHTML(item.nombre)}" data-precio="${item.precio}">+ Añadir</button>`
      : '';

    el.innerHTML = `
      <div class="item-info">
        <div class="item-header">
          <span class="item-name">${escapeHTML(item.nombre || 'Sin nombre')}</span>
          <span class="item-price">${formatPrice(item.precio)}</span>
        </div>
        ${descHTML}
        ${badgeHTML}
        ${addBtnHTML}
      </div>
    `;
    grid.appendChild(el);
  });

  grid.querySelectorAll('.btn-add-item').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const nombre = btn.dataset.nombre;
      const precio = parseFloat(btn.dataset.precio) || 0;
      agregarAlCarrito(nombre, precio);
    };
  });

  return grid;
}

// =====================================================
// 📸 GALERÍA
// =====================================================
function renderGallery(imagenUrl, items) {
  const visibles = (items || []).filter(estaDisponible);

  const wrapper = document.createElement('div');
  wrapper.className = 'subgroup-gallery';

  const photo = document.createElement('div');
  photo.className = 'gallery-photo';

  const img = document.createElement('img');
  img.src = imagenUrl;
  img.alt = 'Foto del plato';
  img.loading = 'lazy';
  img.onerror = () => {
    img.style.display = 'none';
    photo.style.background = 'linear-gradient(135deg, #1a1a1a, #2a2a2a)';
    photo.style.aspectRatio = '4 / 3';
  };
  photo.appendChild(img);

  const variants = document.createElement('div');
  variants.className = 'gallery-variants';

  visibles.forEach(item => {
    const card = document.createElement('div');
    card.className = 'variant-card';

    const descHTML = item.descripcion ? `<p class="variant-desc">${escapeHTML(item.descripcion)}</p>` : '';

    const addBtnHTML = mesaActual
      ? `<button class="btn-add-item" data-nombre="${escapeHTML(item.nombre)}" data-precio="${item.precio}">+ Añadir</button>`
      : '';

    card.innerHTML = `
      <div class="variant-header">
        <span class="variant-name">${escapeHTML(item.nombre || '')}</span>
        <span class="variant-price">${formatPrice(item.precio)}</span>
      </div>
      ${descHTML}
      ${addBtnHTML}
    `;
    variants.appendChild(card);
  });

  variants.querySelectorAll('.btn-add-item').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const nombre = btn.dataset.nombre;
      const precio = parseFloat(btn.dataset.precio) || 0;
      agregarAlCarrito(nombre, precio);
    };
  });

  photo.onclick = () => wrapper.classList.toggle('expanded');

  wrapper.append(photo, variants);
  return wrapper;
}

// =====================================================
// 🛒 ABRIR / CERRAR CARRITO
// =====================================================
function abrirCarrito() {
  cartOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarCarrito() {
  cartOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// =====================================================
// 🚀 INICIAR
// =====================================================
function iniciar() {
  detectarMesa();
  cargarCarrito();
  actualizarUI();

  cartBtn.onclick = abrirCarrito;
  cartClose.onclick = cerrarCarrito;
  cartEnviar.onclick = enviarPedido;

  cartOverlay.onclick = (e) => {
    if (e.target === cartOverlay) cerrarCarrito();
  };

  loadFromSupabase();
}

iniciar();