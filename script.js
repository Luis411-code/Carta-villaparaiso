import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let menuData = { categories: [] };
let mesaActual = null;
let carrito = [];

const CARRITO_KEY = 'villa-paraiso-carrito';
const MESA_KEY = 'villa-paraiso-mesa';

// Elementos del DOM
const categoriesNav = document.getElementById('categories');
const menuContainer = document.getElementById('menu');
const destacadosContainer = document.getElementById('destacadosContainer');
const seccionDestacados = document.getElementById('destacados');
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const cartEnviar = document.getElementById('cartEnviar');
const cartNotas = document.getElementById('cartNotas');
const toast = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMsg = document.getElementById('toastMsg');

const formatPrice = (price) => `$${(Number(price) || 0).toFixed(2)}`;
const escapeHTML = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
const estaDisponible = (item) => item.disponible !== false;

// ==================== LÓGICA DE MESA Y COMANDA ====================
function detectarMesa() {
  const params = new URLSearchParams(window.location.search);
  const mesa = params.get('mesa');
  if (mesa && mesa.trim()) {
    mesaActual = mesa.trim();
    localStorage.setItem(MESA_KEY, mesaActual);
    if (cartBtn) cartBtn.classList.remove('hidden');
  } else {
    mesaActual = null;
    localStorage.removeItem(MESA_KEY);
    if (cartBtn) cartBtn.classList.add('hidden');
  }
}

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
  if (existente) { existente.cantidad += 1; } 
  else { carrito.push({ nombre, precio: Number(precio) || 0, cantidad: 1 }); }
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
        <div class="cart-item-info">
          <div class="cart-item-nombre">${escapeHTML(item.nombre)}</div>
          <div class="cart-item-precio">${formatPrice(item.precio)} c/u</div>
        </div>
        <div class="cart-item-qty">
          <button class="cart-qty-btn menos" data-nombre="${escapeHTML(item.nombre)}" data-delta="-1">−</button>
          <span class="cart-item-cantidad">${item.cantidad}</span>
          <button class="cart-qty-btn mas" data-nombre="${escapeHTML(item.nombre)}" data-delta="1">+</button>
        </div>
        <div class="cart-item-subtotal">${formatPrice(item.precio * item.cantidad)}</div>
        <button class="cart-item-eliminar" data-nombre="${escapeHTML(item.nombre)}">🗑️</button>
      </div>
    `).join('');

    cartItems.querySelectorAll('.cart-qty-btn').forEach(btn => {
      btn.onclick = () => {
        const itemEl = btn.closest('.cart-item');
        const counter = itemEl?.querySelector('.cart-item-cantidad');
        if (counter) { counter.classList.add('bump'); setTimeout(() => counter.classList.remove('bump'), 350); }
        cambiarCantidad(btn.dataset.nombre, parseInt(btn.dataset.delta, 10));
      };
    });

    cartItems.querySelectorAll('.cart-item-eliminar').forEach(btn => {
      btn.onclick = () => { if (confirm(`¿Eliminar "${btn.dataset.nombre}"?`)) eliminarDelCarrito(btn.dataset.nombre); };
    });
    cartEnviar.disabled = false;
  }
  cartTotal.textContent = formatPrice(calcularTotal());
}

// ==================== TOAST Y ENVÍO ====================
let toastTimer = null;
function mostrarToast(titulo, mensaje, esError = false) {
  toastTitle.textContent = titulo;
  toastMsg.textContent = mensaje;
  toast.classList.toggle('toast-error', esError);
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

async function enviarPedido() {
  if (!mesaActual) return mostrarToast('❌ Error', 'Escanea el QR de tu mesa.', true);
  if (carrito.length === 0) return mostrarToast('⚠️ Comanda vacía', 'Añade platos antes de enviar', true);

  cartEnviar.disabled = true;
  cartEnviar.textContent = '⏳ Enviando...';

  try {
    const { error } = await supabase.from('pedidos').insert({
      mesa: mesaActual, items: carrito, total: calcularTotal(), notas: cartNotas.value.trim(), estado: 'pendiente'
    }).select().single();

    if (error) throw error;

    cartEnviar.textContent = '✅ ¡Enviada!';
    mostrarToast('🎉 ¡Comanda enviada!', `Mesa ${mesaActual} · Tu mesero la recibirá en un momento`, false);

    setTimeout(() => {
      limpiarCarrito();
      cerrarCarrito();
      cartEnviar.textContent = '✅ Enviar comanda al mesero';
      cartEnviar.disabled = false;
    }, 1200);

  } catch (err) {
    console.error(err);
    cartEnviar.disabled = false;
    cartEnviar.textContent = '✅ Enviar comanda al mesero';
    mostrarToast('❌ No se pudo enviar', 'Revisa tu conexión', true);
  }
}

// ==================== RENDERIZADO DE LA CARTA ====================
function renderIconHTML(obj, size = '1.1em') {
  if (obj.iconoImg) return `<img src="${escapeHTML(obj.iconoImg)}" style="width:${size};height:${size};object-fit:contain;vertical-align:-0.2em;margin-right:6px;display:inline-block;">`;
  if (obj.icono) return `<span style="margin-right:4px;">${escapeHTML(obj.icono)}</span>`;
  return '';
}

// Genera solo los iconos de alérgenos (se eliminaron los de características)
function renderItemIcons(item) {
  let html = '<div class="item-icons">';
  if (item.alergenos && Array.isArray(item.alergenos)) {
    if (item.alergenos.includes('lacteos')) html += '<span title="Contiene Lácteos">🥛</span>';
    if (item.alergenos.includes('marisco')) html += '<span title="Contiene Marisco">🦐</span>';
    if (item.alergenos.includes('frutos-secos')) html += '<span title="Contiene Frutos Secos">🥜</span>';
    if (item.alergenos.includes('huevo')) html += '<span title="Contiene Huevo">🥚</span>';
  }
  html += '</div>';
  return html;
}

function renderMenu() {
  categoriesNav.innerHTML = '';
  menuContainer.innerHTML = '';
  destacadosContainer.innerHTML = '';
  let hayDestacados = false;

  // 1. Renderizar Destacados
  menuData.categories.forEach(cat => {
    const allItems = cat.subgrupos ? cat.subgrupos.flatMap(s => s.items || []) : (cat.items || []);
    allItems.forEach(item => {
      if (item.destacado && estaDisponible(item)) {
        hayDestacados = true;
        destacadosContainer.appendChild(renderItemCard(item));
      }
    });
  });
  seccionDestacados.style.display = hayDestacados ? 'block' : 'none';

  // 2. Crear botones de categoría y secciones normales
  menuData.categories.forEach((cat, index) => {
    let tiene = cat.subgrupos?.length > 0 ? cat.subgrupos.some(sub => (sub.items || []).some(estaDisponible)) : (cat.items || []).some(estaDisponible);
    if (!tiene) return;

    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.dataset.target = `cat-${index}`;
    btn.innerHTML = renderIconHTML(cat) + escapeHTML(cat.categoria || '');
    btn.onclick = () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`cat-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    categoriesNav.appendChild(btn);

    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = `cat-${index}`;

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.innerHTML = renderIconHTML(cat, '1.2em') + escapeHTML(cat.categoria || '');
    section.appendChild(title);

    if (cat.subgrupos) {
      cat.subgrupos.forEach(sub => {
        if ((sub.items || []).filter(estaDisponible).length === 0) return;
        const subTitle = document.createElement('h3');
        subTitle.className = 'subcategory-title';
        subTitle.textContent = sub.titulo || '';
        section.appendChild(subTitle);
        
        if (sub.imagenes?.length || sub.imagen) {
          section.appendChild(renderGallery(sub, sub.items));
        } else {
          const grid = document.createElement('div'); grid.className = 'items-grid';
          (sub.items || []).filter(estaDisponible).forEach(item => grid.appendChild(renderItemCard(item)));
          section.appendChild(grid);
        }
      });
    } else {
      if (cat.imagenes?.length || cat.imagen) {
        section.appendChild(renderGallery(cat, cat.items));
      } else {
        const grid = document.createElement('div'); grid.className = 'items-grid';
        (cat.items || []).filter(estaDisponible).forEach(item => grid.appendChild(renderItemCard(item)));
        section.appendChild(grid);
      }
    }
    menuContainer.appendChild(section);
  });

  if (categoriesNav.firstChild) categoriesNav.firstChild.classList.add('active');

  // 3. SCROLL SPY
  if (window.scrollSpy) window.scrollSpy.disconnect();
  window.scrollSpy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        const activeBtn = document.querySelector(`.category-btn[data-target="${id}"]`);
        if (activeBtn && !activeBtn.classList.contains('active')) {
          document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
          activeBtn.classList.add('active');
          activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    });
  }, { rootMargin: '-100px 0px -60% 0px', threshold: 0 });

  document.querySelectorAll('.category-section').forEach(sec => window.scrollSpy.observe(sec));
}

function renderItemCard(item) {
  const el = document.createElement('article');
  el.className = 'menu-item';
  const addBtnHTML = mesaActual ? `<button class="btn-add-item" data-nombre="${escapeHTML(item.nombre)}" data-precio="${item.precio}">+ Añadir</button>` : '';
  
  el.innerHTML = `
    <div class="item-info">
      <div class="item-header">
        <span class="item-name">${escapeHTML(item.nombre || 'Sin nombre')}</span>
        <span class="item-price">${formatPrice(item.precio)}</span>
      </div>
      ${item.descripcion ? `<p class="item-desc">${escapeHTML(item.descripcion)}</p>` : ''}
      ${renderItemIcons(item)}
      ${addBtnHTML}
    </div>`;
    
  el.querySelector('.btn-add-item')?.addEventListener('click', (e) => {
    e.stopPropagation(); 
    agregarAlCarrito(item.nombre, parseFloat(item.precio) || 0);
  });
  return el;
}

function renderGallery(obj, items) {
  let urls = obj.imagenes?.length ? obj.imagenes : (obj.imagen ? [obj.imagen] : []);
  const wrapper = document.createElement('div');
  wrapper.className = 'simple-gallery';

  if (urls.length > 0) {
    const carousel = document.createElement('div');
    carousel.className = 'gallery-carousel';
    urls.forEach((url, index) => {
      const img = document.createElement('img');
      img.src = url;
      img.loading = 'lazy';
      if (index === 0) img.classList.add('active');
      carousel.appendChild(img);
    });
    wrapper.appendChild(carousel);

    if (urls.length > 1) {
      let currentIndex = 0;
      const images = carousel.querySelectorAll('img');
      setInterval(() => {
        images[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % images.length;
        images[currentIndex].classList.add('active');
      }, 5000);
    }
  }

  const list = document.createElement('div');
  list.className = 'items-grid';
  (items || []).filter(estaDisponible).forEach(item => list.appendChild(renderItemCard(item)));
  wrapper.appendChild(list);
  return wrapper;
}

function abrirCarrito() {
  if (cartOverlay) {
    cartOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}
function cerrarCarrito() {
  if (cartOverlay) {
    cartOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// ==================== INICIALIZACIÓN ====================
async function iniciar() {
  detectarMesa();
  cargarCarrito();
  actualizarUI();

  if (cartBtn) cartBtn.onclick = abrirCarrito;
  if (cartClose) cartClose.onclick = cerrarCarrito;
  if (cartEnviar) cartEnviar.onclick = enviarPedido;
  if (cartOverlay) cartOverlay.onclick = (e) => { if (e.target === cartOverlay) cerrarCarrito(); };

  try {
    const { data, error } = await supabase.from('menu').select('data').eq('id', 'main').single();
    if (!error && data?.data?.categories?.length) menuData = data.data;
  } catch (err) { console.warn('Error cargando menú'); }
  
  renderMenu();
}

iniciar();