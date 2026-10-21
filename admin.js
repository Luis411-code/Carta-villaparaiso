// =====================================================
// 🔐 PANEL DE ADMINISTRACIÓN - VILLA PARAÍSO GUARDALAVACA
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    lock: async (name, acquireTimeout, fn) => await fn(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

let menuData = { categories: [], site: {} };
let hasUnsavedChanges = false;

// ========== ELEMENTOS DEL DOM ==========
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

// ========== HELPERS ==========
const uid = () => Math.random().toString(36).slice(2, 10);

function markDirty() {
  hasUnsavedChanges = true;
  statusBar.classList.remove('hidden');
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// =====================================================
// 🔐 AUTENTICACIÓN
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
  if (hasUnsavedChanges && !confirm('Tienes cambios sin guardar. ¿Salir?')) return;
  await supabase.auth.signOut();
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    userEmail.textContent = session.user.email;
    loadMenu();
    suscribirRealtime();
  } else {
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    userEmail.textContent = session.user.email;
    if (!hasUnsavedChanges) loadMenu();
    suscribirRealtime();
  } else if (event === 'SIGNED_OUT') {
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
  }
});

// =====================================================
// 🗂️ SISTEMA DE PESTAÑAS (TABS)
// =====================================================
const tabs = document.querySelectorAll('.admin-tab');
const tabCarta = document.getElementById('tabCarta');
const tabPedidos = document.getElementById('tabPedidos');
const tabQrs = document.getElementById('tabQrs');
const pedidosBadge = document.getElementById('pedidosBadge');

let tabActual = 'carta';

tabs.forEach(tab => {
  tab.onclick = () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tabActual = tab.dataset.tab;

    tabCarta.classList.add('hidden');
    tabPedidos.classList.add('hidden');
    tabQrs.classList.add('hidden');

    if (tabActual === 'carta') {
      tabCarta.classList.remove('hidden');
    } else if (tabActual === 'pedidos') {
      tabPedidos.classList.remove('hidden');
      cargarPedidos();
    } else if (tabActual === 'qrs') {
      tabQrs.classList.remove('hidden');
    }
  };
});

// =====================================================
// 📥 CARGAR MENÚ
// =====================================================
async function loadMenu() {
  try {
    const { data, error } = await supabase
      .from('menu')
      .select('data')
      .eq('id', 'main')
      .single();

    if (error) throw error;
    menuData = data?.data || { categories: [] };
    if (!menuData.categories) menuData.categories = [];
    if (!menuData.site) menuData.site = {};
    
    loadSiteConfig(menuData.site);
    render();
    hasUnsavedChanges = false;
    statusBar.classList.add('hidden');
  } catch (err) {
    alert('Error al cargar el menú: ' + err.message);
  }
}

// =====================================================
// 💾 GUARDAR CAMBIOS
// =====================================================
saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';
  try {
    const { error } = await supabase
      .from('menu')
      .update({ data: menuData, updated_at: new Date().toISOString() })
      .eq('id', 'main');

    if (error) throw error;

    hasUnsavedChanges = false;
    statusBar.classList.add('hidden');
    saveBtn.textContent = '✅ Guardado';
    setTimeout(() => { saveBtn.textContent = '💾 Guardar cambios'; }, 1800);
  } catch (err) {
    alert('Error al guardar: ' + err.message);
    saveBtn.textContent = '💾 Guardar cambios';
  } finally {
    saveBtn.disabled = false;
  }
});

reloadBtn.addEventListener('click', () => {
  if (hasUnsavedChanges && !confirm('Perderás los cambios sin guardar. ¿Continuar?')) return;
  loadMenu();
});

// =====================================================
// 🏠 CONFIGURACIÓN DEL SITIO
// =====================================================
const SITE_DEFAULTS = {
  nombre: 'Villa Paraíso', subtitulo: 'Guardalavaca', tagline: 'Cocina del mar & parrilla',
  horas: '🕐 12:00 - 23:00', footerMensaje: 'Gracias por preferirnos',
  footerSub: 'Será un placer atenderle', footerCopy: '© 2025 Villa Paraíso Guardalavaca'
};

const SITE_FIELDS = {
  nombre: 'site-nombre', subtitulo: 'site-subtitulo', tagline: 'site-tagline',
  horas: 'site-horas', footerMensaje: 'site-footerMensaje', footerSub: 'site-footerSub', footerCopy: 'site-footerCopy'
};

function loadSiteConfig(site) {
  if (!menuData.site) menuData.site = {};
  Object.keys(SITE_DEFAULTS).forEach(key => {
    if (menuData.site[key] === undefined || menuData.site[key] === '') {
      menuData.site[key] = SITE_DEFAULTS[key];
    }
  });

  Object.entries(SITE_FIELDS).forEach(([key, id]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = menuData.site[key] || '';
    input.oninput = () => {
      menuData.site[key] = input.value;
      markDirty();
    };
  });
}

// =====================================================
// ➕ AÑADIR CATEGORÍA Y SUBCATEGORÍA
// =====================================================
addCategoryBtn.addEventListener('click', () => {
  menuData.categories.push({ id: uid(), categoria: "Nueva Categoría", icono: "🍽️", items: [] });
  markDirty(); render();
});

function addSubgroup(catId) {
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;

  if (!cat.subgrupos) {
    const itemsExistentes = cat.items || [];
    cat.subgrupos = [{ id: uid(), titulo: itemsExistentes.length > 0 ? "General" : "Nueva Subcategoría", items: itemsExistentes }];
    delete cat.items;
  } else {
    cat.subgrupos.push({ id: uid(), titulo: "Nueva Subcategoría", items: [] });
  }
  markDirty(); render();
}

// =====================================================
// 🎨 RENDERIZAR PANEL
// =====================================================
function render() {
  container.innerHTML = '';

  if (menuData.categories.length === 0) {
    container.innerHTML = '<p class="empty-msg">No hay categorías. Añade una para empezar.</p>';
    return;
  }

  menuData.categories.forEach((cat) => {
    const card = document.createElement('div');
    card.className = 'category-card';

    const head = document.createElement('div');
    head.className = 'category-head';

    const iconInput = document.createElement('input');
    iconInput.className = 'cat-icon-input';
    iconInput.value = cat.icono || '🍽️';
    iconInput.maxLength = 3;
    iconInput.oninput = () => { cat.icono = iconInput.value; markDirty(); };

    const nameInput = document.createElement('input');
    nameInput.className = 'cat-name-input';
    nameInput.value = cat.categoria || '';
    nameInput.oninput = () => { cat.categoria = nameInput.value; markDirty(); };

    const delCat = document.createElement('button');
    delCat.className = 'btn-danger btn-small';
    delCat.textContent = '🗑️ Eliminar';
    delCat.onclick = () => {
      if (confirm(`¿Eliminar la categoría "${cat.categoria}"?`)) {
        menuData.categories = menuData.categories.filter(c => c.id !== cat.id);
        markDirty(); render();
      }
    };
    head.append(iconInput, nameInput, delCat);
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'category-body';

    if (cat.subgrupos && cat.subgrupos.length > 0) {
      cat.subgrupos.forEach(sub => body.appendChild(renderSubgroup(cat, sub)));
    } else {
      if (!cat.items) cat.items = [];
      body.appendChild(renderImageField(cat, `Foto de "${cat.categoria || 'esta categoría'}"`));
      body.appendChild(renderTools(cat.items, () => render()));
      cat.items.forEach(item => body.appendChild(renderItem(cat.items, item)));

      const addBtn = document.createElement('button');
      addBtn.className = 'btn-add btn-small';
      addBtn.textContent = '+ Añadir plato';
      addBtn.style.marginTop = '8px';
      addBtn.onclick = () => {
        cat.items.push({ id: uid(), nombre: "Nuevo plato", precio: 0, descripcion: "", alergenos: "", disponible: true });
        markDirty(); render();
      };
      body.appendChild(addBtn);
    }

    const convertBtn = document.createElement('button');
    convertBtn.className = 'btn-secondary btn-small';
    convertBtn.style.marginTop = '12px';
    convertBtn.style.width = '100%';

    if (!cat.subgrupos || cat.subgrupos.length === 0) {
      convertBtn.textContent = '📂 Convertir en subcategorías';
      convertBtn.onclick = () => {
        if (!confirm(`Se agruparán los platos en un subgrupo. ¿Continuar?`)) return;
        addSubgroup(cat.id);
      };
    } else {
      convertBtn.textContent = '+ Añadir subcategoría';
      convertBtn.onclick = () => addSubgroup(cat.id);
    }
    body.appendChild(convertBtn);
    card.appendChild(body);
    container.appendChild(card);
  });
}

// =====================================================
// 📂 RENDER SUBGRUPO
// =====================================================
function renderSubgroup(cat, sub) {
  const block = document.createElement('div');
  block.className = 'subgroup-block';

  const head = document.createElement('div');
  head.className = 'subgroup-head';

  const titleInput = document.createElement('input');
  titleInput.className = 'subgroup-title-input';
  titleInput.value = sub.titulo || '';
  titleInput.oninput = () => { sub.titulo = titleInput.value; markDirty(); };

  const delSub = document.createElement('button');
  delSub.className = 'btn-danger btn-small';
  delSub.textContent = '🗑️';
  delSub.onclick = () => {
    if (confirm(`¿Eliminar subcategoría "${sub.titulo}"?`)) {
      cat.subgrupos = cat.subgrupos.filter(s => s.id !== sub.id);
      if (cat.subgrupos.length === 0) { cat.items = []; delete cat.subgrupos; }
      markDirty(); render();
    }
  };

  head.append(titleInput, delSub);
  block.appendChild(head);

  block.appendChild(renderImageField(sub, `Foto de "${sub.titulo || 'esta sección'}"`));
  if (!sub.items) sub.items = [];
  block.appendChild(renderTools(sub.items, () => render()));

  sub.items.forEach(item => block.appendChild(renderItem(sub.items, item)));

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add btn-small';
  addBtn.textContent = '+ Añadir plato';
  addBtn.style.marginTop = '8px';
  addBtn.onclick = () => {
    sub.items.push({ id: uid(), nombre: "Nuevo plato", precio: 0, descripcion: "", alergenos: "", disponible: true });
    markDirty(); render();
  };
  block.appendChild(addBtn);

  return block;
}

// =====================================================
// 🎛️ BARRA DE HERRAMIENTAS
// =====================================================
function renderTools(items, onRerender) {
  const bar = document.createElement('div');
  bar.className = 'category-tools';
  const label = document.createElement('span');
  label.className = 'tools-label';
  label.textContent = 'Día de hoy:';
  bar.appendChild(label);

  const btnOn = document.createElement('button');
  btnOn.className = 'btn-all-on';
  btnOn.textContent = '✅ Marcar todo';
  btnOn.onclick = () => { items.forEach(it => it.disponible = true); markDirty(); (onRerender || render)(); };
  bar.appendChild(btnOn);

  const btnOff = document.createElement('button');
  btnOff.className = 'btn-all-off';
  btnOff.textContent = '🚫 Desmarcar todo';
  btnOff.onclick = () => { items.forEach(it => it.disponible = false); markDirty(); (onRerender || render)(); };
  bar.appendChild(btnOff);

  const disponibles = items.filter(it => it.disponible !== false).length;
  const counter = document.createElement('span');
  counter.className = 'avail-counter';
  counter.textContent = `${disponibles}/${items.length} disponibles`;
  bar.appendChild(counter);

  return bar;
}

// =====================================================
// 🔀 TOGGLE
// =====================================================
function createAvailToggle(item) {
  const wrap = document.createElement('label');
  wrap.className = 'avail-toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = item.disponible !== false;
  input.onchange = () => {
    item.disponible = input.checked;
    markDirty();
    const row = wrap.closest('.item-row');
    if (row) row.classList.toggle('unavailable', !input.checked);
    const parentBlock = wrap.closest('.subgroup-block') || wrap.closest('.category-body');
    if (parentBlock) {
      const counter = parentBlock.querySelector('.avail-counter');
      if (counter) {
        const rows = parentBlock.querySelectorAll('.item-row');
        const ok = Array.from(rows).filter(r => !r.classList.contains('unavailable')).length;
        counter.textContent = `${ok}/${rows.length} disponibles`;
      }
    }
  };
  const slider = document.createElement('span');
  slider.className = 'avail-slider';
  wrap.append(input, slider);
  return wrap;
}

// =====================================================
// 🍽️ RENDER ITEM INDIVIDUAL
// =====================================================
function renderItem(arr, item) {
  const row = document.createElement('div');
  row.className = 'item-row';
  if (item.disponible === false) row.classList.add('unavailable');

  const toggle = createAvailToggle(item);

  const nameInput = document.createElement('input');
  nameInput.placeholder = 'Nombre del plato';
  nameInput.value = item.nombre || '';
  nameInput.oninput = () => { item.nombre = nameInput.value; markDirty(); };

  const priceInput = document.createElement('input');
  priceInput.className = 'item-price-input';
  priceInput.type = 'number';
  priceInput.step = '0.01';
  priceInput.placeholder = 'Precio';
  priceInput.value = item.precio ?? 0;
  priceInput.oninput = () => { item.precio = parseFloat(priceInput.value) || 0; markDirty(); };

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger btn-small';
  delBtn.textContent = '🗑️';
  delBtn.onclick = () => {
    if (confirm(`¿Eliminar "${item.nombre}"?`)) {
      const idx = arr.indexOf(item);
      if (idx > -1) arr.splice(idx, 1);
      markDirty(); render();
    }
  };
  actions.appendChild(delBtn);

  const descInput = document.createElement('textarea');
  descInput.placeholder = 'Descripción (opcional)';
  descInput.value = item.descripcion || '';
  descInput.rows = 2;
  descInput.oninput = () => { item.descripcion = descInput.value; markDirty(); };

  const alergenosInput = document.createElement('input');
  alergenosInput.placeholder = '⚠️ Alérgenos (ej: Gluten, Lácteos, Mariscos)';
  alergenosInput.value = item.alergenos || '';
  alergenosInput.style.borderColor = '#C62828'; 
  alergenosInput.style.gridColumn = '1 / -1';
  alergenosInput.style.marginTop = '5px';
  alergenosInput.oninput = () => { item.alergenos = alergenosInput.value; markDirty(); };

  row.append(toggle, nameInput, priceInput, actions, descInput, alergenosInput);
  return row;
}

// =====================================================
// 🖼️ OPTIMIZACIÓN Y SUBIDA DE IMÁGENES
// =====================================================
async function optimizeImage(file) {
  const maxDimension = 1200;
  const quality = 0.85;
  const imageBitmap = await createImageBitmap(file);
  let { width, height } = imageBitmap;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) { height = Math.round((height / width) * maxDimension); width = maxDimension; }
    else { width = Math.round((width / height) * maxDimension); height = maxDimension; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close?.();
  const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
  const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
  return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
}

function renderImageField(obj, labelText) {
  const wrap = document.createElement('div');
  wrap.className = 'image-field';
  const label = document.createElement('label');
  label.textContent = `📸 ${labelText}`;
  wrap.appendChild(label);

  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone';
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'image/*';
  const dropIcon = document.createElement('span'); dropIcon.className = 'drop-icon'; dropIcon.textContent = '📤';
  const dropText = document.createElement('span'); dropText.className = 'drop-text'; dropText.textContent = 'Arrastra una foto aquí';
  const dropSub = document.createElement('span'); dropSub.className = 'drop-sub'; dropSub.textContent = 'o tócala para elegir';
  dropZone.append(fileInput, dropIcon, dropText, dropSub);

  const progressWrap = document.createElement('div'); progressWrap.className = 'upload-progress';
  const progressBar = document.createElement('div'); progressBar.className = 'bar'; progressWrap.appendChild(progressBar);

  const previewBox = document.createElement('div'); previewBox.className = 'image-preview-box'; previewBox.style.display = 'none';
  const previewImg = document.createElement('img');
  const previewInfo = document.createElement('div'); previewInfo.className = 'image-preview-info';
  const filename = document.createElement('span'); filename.className = 'filename';
  const actionsRow = document.createElement('div'); actionsRow.className = 'actions';
  const removeBtn = document.createElement('button'); removeBtn.className = 'btn-remove-img'; removeBtn.textContent = '🗑️ Quitar';
  
  removeBtn.onclick = async () => {
    if (!confirm('¿Quitar esta foto?')) return;
    if (obj.imagen && obj.imagen.includes('/fotos/')) {
      try { await supabase.storage.from('fotos').remove([obj.imagen.split('/fotos/')[1]]); } catch (e) {}
    }
    obj.imagen = undefined; previewBox.style.display = 'none'; dropZone.style.display = 'block'; markDirty();
  };
  actionsRow.appendChild(removeBtn);
  previewInfo.append(filename, actionsRow);
  previewBox.append(previewImg, previewInfo);

  async function uploadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    dropZone.classList.add('uploading'); dropIcon.textContent = '⏳'; dropText.textContent = 'Optimizando...';
    progressWrap.classList.add('active'); progressBar.style.width = '30%';

    try {
      const optimized = await optimizeImage(file);
      progressBar.style.width = '60%';
      const path = `fotos/${optimized.name.replace(/[^a-z0-9.]/g, '-')}-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from('fotos').upload(path, optimized, { contentType: 'image/webp' });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(path);
      obj.imagen = urlData.publicUrl; markDirty();
      previewImg.src = obj.imagen; filename.textContent = path;
      previewBox.style.display = 'flex'; dropZone.style.display = 'none';
      progressBar.style.width = '100%';
    } catch (err) {
      alert('Error al subir: ' + err.message);
    } finally {
      dropZone.classList.remove('uploading'); dropIcon.textContent = '📤'; dropText.textContent = 'Arrastra una foto aquí';
      setTimeout(() => { progressWrap.classList.remove('active'); progressBar.style.width = '0%'; }, 500);
    }
  }

  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => uploadFile(e.target.files?.[0]);
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
  dropZone.ondragleave = () => dropZone.classList.remove('dragover');
  dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); uploadFile(e.dataTransfer?.files?.[0]); };

  if (obj.imagen) {
    previewImg.src = obj.imagen; filename.textContent = obj.imagen.split('/').pop();
    previewBox.style.display = 'flex'; dropZone.style.display = 'none';
  }

  wrap.append(dropZone, progressWrap, previewBox);
  return wrap;
}

// =====================================================
// 📋 PEDIDOS EN TIEMPO REAL
// =====================================================
const pedidosContainer = document.getElementById('pedidosContainer');
const refreshPedidosBtn = document.getElementById('refreshPedidosBtn');
const rtStatus = document.getElementById('rtStatus');
const toggleHistorial = document.getElementById('toggleHistorial');

let mostrarHistorial = false;
let pedidosActuales = [];
let realtimeChannel = null;

const ESTADOS = [
  { key: 'pendiente', titulo: '🔴 Pendientes', orden: 1 },
  { key: 'confirmado', titulo: '🟡 Confirmados', orden: 2 },
  { key: 'en_preparacion', titulo: '🍳 En preparación', orden: 3 },
  { key: 'entregado', titulo: '🟢 Entregados', orden: 4 },
  { key: 'cancelado', titulo: '⚫ Cancelados', orden: 5 }
];

async function cargarPedidos() {
  try {
    let query = supabase.from('pedidos').select('*').order('creado_en', { ascending: false });
    if (!mostrarHistorial) {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      query = query.gte('creado_en', hoy.toISOString());
    }
    const { data, error } = await query.limit(100);
    if (error) throw error;
    pedidosActuales = data || [];
    renderPedidos();
    actualizarBadge();
  } catch (err) {
    console.error('Error al cargar pedidos:', err);
  }
}

function renderPedidos() {
  const pendientes = pedidosActuales.filter(p => p.estado === 'pendiente').length;
  if (pendientes > 0) { pedidosBadge.textContent = pendientes; pedidosBadge.classList.remove('hidden'); } 
  else { pedidosBadge.classList.add('hidden'); }

  if (pedidosActuales.length === 0) {
    pedidosContainer.innerHTML = `<div class="pedidos-empty" style="text-align:center;padding:40px;"><p style="color:#999;font-style:italic;">Sin pedidos por ahora.</p></div>`;
    return;
  }

  const agrupados = {};
  ESTADOS.forEach(e => agrupados[e.key] = []);
  pedidosActuales.forEach(p => { if (agrupados[p.estado]) agrupados[p.estado].push(p); else agrupados['pendiente'].push(p); });

  const html = ESTADOS.map(estado => {
    const lista = agrupados[estado.key] || [];
    if (lista.length === 0 && estado.key !== 'pendiente') return '';
    if (!mostrarHistorial && ['entregado', 'cancelado'].includes(estado.key) && lista.length === 0) return '';

    return `
      <div class="pedidos-section">
        <h3 class="pedidos-section-title estado-${estado.key}">${estado.titulo} <span class="pedidos-count">${lista.length}</span></h3>
        ${lista.length > 0 ? lista.map(p => renderPedidoCard(p)).join('') : '<p style="text-align:center;padding:12px;color:#999;font-size:0.85rem;">Sin pedidos</p>'}
      </div>
    `;
  }).join('');

  pedidosContainer.innerHTML = html;
  pedidosContainer.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = () => manejarAccion(btn.dataset.action, btn.dataset.id);
  });
}

function renderPedidoCard(pedido) {
  const hora = new Date(pedido.creado_en);
  const horaStr = hora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hace = tiempoRelativo(hora);
  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const itemsHTML = items.map(item => `<div class="pedido-item"><span class="item-cant">×${item.cantidad}</span><span class="item-nom">${escapeHTML(item.nombre)}</span><span class="item-sub">$${(item.precio * item.cantidad).toFixed(2)}</span></div>`).join('');
  const notasHTML = pedido.notas ? `<div class="pedido-notas">📝 ${escapeHTML(pedido.notas)}</div>` : '';

  let botonesHTML = '';
  switch (pedido.estado) {
    case 'pendiente': botonesHTML = `<button class="pedido-btn btn-confirmar" data-action="confirmar" data-id="${pedido.id}">✅ Confirmar</button><button class="pedido-btn btn-rechazar" data-action="rechazar" data-id="${pedido.id}">❌</button>`; break;
    case 'confirmado': botonesHTML = `<button class="pedido-btn btn-preparar" data-action="preparar" data-id="${pedido.id}">🍳 A Cocina</button><button class="pedido-btn btn-rechazar" data-action="rechazar" data-id="${pedido.id}">❌</button>`; break;
    case 'en_preparacion': botonesHTML = `<button class="pedido-btn btn-entregar" data-action="entregar" data-id="${pedido.id}">✅ Entregado</button>`; break;
    case 'entregado': case 'cancelado': botonesHTML = `<button class="pedido-btn btn-reabrir" data-action="reabrir" data-id="${pedido.id}">🔄 Reabrir</button>`; break;
  }

  return `
    <div class="pedido-card ${pedido.estado}">
      <div class="pedido-header">
        <div class="pedido-mesa">
          <div class="mesa-icon">${escapeHTML(pedido.mesa || '?')}</div>
          <div class="pedido-mesa-info">
            <div class="mesa-num">Mesa ${escapeHTML(pedido.mesa || '?')}</div>
            <div class="mesa-hora">🕐 ${horaStr} · <strong>${hace}</strong></div>
          </div>
        </div>
      </div>
      <div class="pedido-items">${itemsHTML}</div>
      ${notasHTML}
      <div class="pedido-total"><span>Total</span><strong>$${Number(pedido.total).toFixed(2)}</strong></div>
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

async function manejarAccion(accion, id) {
  const nuevosEstados = { confirmar: 'confirmado', rechazar: 'cancelado', preparar: 'en_preparacion', entregar: 'entregado', reabrir: 'pendiente' };
  const nuevoEstado = nuevosEstados[accion];
  if (!nuevoEstado) return;
  if (accion === 'rechazar' && !confirm('¿Rechazar este pedido?')) return;

  const btn = document.querySelector(`[data-action="${accion}"][data-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', id);
    if (error) throw error;
    const pedido = pedidosActuales.find(p => p.id === id);
    if (pedido) pedido.estado = nuevoEstado;
    renderPedidos(); actualizarBadge();
  } catch (err) {
    alert('Error: ' + err.message);
    if (btn) btn.disabled = false;
    cargarPedidos();
  }
}

function actualizarBadge() {
  const pendientes = pedidosActuales.filter(p => p.estado === 'pendiente').length;
  if (pendientes > 0) { pedidosBadge.textContent = pendientes; pedidosBadge.classList.remove('hidden'); } 
  else { pedidosBadge.classList.add('hidden'); }
}

function suscribirRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel('admin-pedidos-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        pedidosActuales.unshift(payload.new);
        if (tabActual === 'pedidos') renderPedidos();
        actualizarBadge();
      } else if (payload.eventType === 'UPDATE') {
        const idx = pedidosActuales.findIndex(p => p.id === payload.new.id);
        if (idx > -1) pedidosActuales[idx] = payload.new;
        if (tabActual === 'pedidos') renderPedidos();
      } else if (payload.eventType === 'DELETE') {
        pedidosActuales = pedidosActuales.filter(p => p.id !== payload.old.id);
        if (tabActual === 'pedidos') renderPedidos();
        actualizarBadge();
      }
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') { rtStatus.textContent = '🟢 En vivo'; rtStatus.classList.remove('offline'); }
      else { rtStatus.textContent = '🔴 Desconectado'; rtStatus.classList.add('offline'); }
    });
}

if (refreshPedidosBtn) refreshPedidosBtn.onclick = cargarPedidos;
if (toggleHistorial) toggleHistorial.onclick = () => {
  mostrarHistorial = !mostrarHistorial;
  toggleHistorial.textContent = mostrarHistorial ? '📁 Ver solo hoy' : '📁 Ver historial';
  cargarPedidos();
};

function escapeHTML(text) {
  if (!text) return '';
  const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
}

// =====================================================
// 📱 GENERADOR DE QRs
// =====================================================
const SECRETO_QR = 'VillaParaiso-Secreto-Muy-Dificil-De-Adivinar-2025';
const URL_BASE = 'https://villaparaiso.vercel.app';

async function generarHashQR(mesa) {
  const encoder = new TextEncoder();
  const data = encoder.encode(mesa + SECRETO_QR);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

async function generarQRConLogo(mesa, token) {
  const url = `${URL_BASE}/?mesa=${encodeURIComponent(mesa)}&t=${token}`;
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, {
    width: 800, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' }
  });

  const ctx = canvas.getContext('2d');
  const logo = new Image();
  logo.src = 'img/logo.png';

  return new Promise((resolve) => {
    logo.onload = () => {
      const logoSize = 160;
      const x = (canvas.width - logoSize) / 2;
      const y = (canvas.height - logoSize) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 10, y - 10, logoSize + 20, logoSize + 20);
      ctx.drawImage(logo, x, y, logoSize, logoSize);
      resolve(canvas.toDataURL('image/png'));
    };
    logo.onerror = () => resolve(canvas.toDataURL('image/png'));
  });
}

const btnGenerar = document.getElementById('btnGenerarQrs');
if (btnGenerar) {
  btnGenerar.addEventListener('click', async () => {
    const inputVal = document.getElementById('inputMesas').value;
    const container = document.getElementById('qrContainer');
    const btnZip = document.getElementById('btnDescargarZip');
    
    if (!inputVal.trim()) return alert('Escribe al menos una mesa.');

    container.innerHTML = '';
    btnZip.style.display = 'none';
    btnZip.dataset.images = JSON.stringify([]);

    const mesas = inputVal.split(',').map(m => m.trim()).filter(m => m !== '');
    btnGenerar.textContent = 'Generando...';

    const imagenesParaZip = [];

    for (const mesa of mesas) {
      const hash = await generarHashQR(mesa);
      const dataUrl = await generarQRConLogo(mesa, hash);

      const card = document.createElement('div');
      card.className = 'qr-card';
      card.innerHTML = `
        <img src="${dataUrl}" alt="QR Mesa ${mesa}">
        <h4>Mesa: ${mesa}</h4>
        <button class="btn-download" data-mesa="${mesa}">⬇️ Descargar PNG</button>
      `;

      card.querySelector('.btn-download').onclick = () => {
        const a = document.createElement('a'); a.href = dataUrl; a.download = `qr-mesa-${mesa}.png`; a.click();
      };

      container.appendChild(card);
      imagenesParaZip.push({ mesa, dataUrl });
    }

    btnGenerar.textContent = '✨ Generar QRs';
    btnZip.style.display = 'block';
    btnZip.dataset.images = JSON.stringify(imagenesParaZip);
  });
}

const btnZip = document.getElementById('btnDescargarZip');
if (btnZip) {
  btnZip.addEventListener('click', async () => {
    const imagenes = JSON.parse(btnZip.dataset.images);
    if (!imagenes || imagenes.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("Qrs-VillaParaiso");

    imagenes.forEach(img => {
      const base64Data = img.dataUrl.replace(/^data:image\/png;base64,/, "");
      folder.file(`qr-mesa-${img.mesa}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = "Qrs-VillaParaiso.zip";
    a.click();
  });
}

// =====================================================
// 👁️ VER MENÚ (Bypass del Middleware para el Admin)
// =====================================================
const btnVerMenu = document.getElementById('btnVerMenu');
if (btnVerMenu) {
  btnVerMenu.addEventListener('click', async () => {
    // Generamos un token para la mesa ficticia 'admin' para que el middleware deje pasar
    const mesaPrueba = 'admin'; 
    const hash = await generarHashQR(mesaPrueba);
    const url = `https://villaparaiso.vercel.app/?mesa=${mesaPrueba}&t=${hash}`;
    window.open(url, '_blank');
  });
}