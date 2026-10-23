import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let menuData = { categories: [] };
let hasUnsavedChanges = false;

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

const uid = () => Math.random().toString(36).slice(2, 10);
function markDirty() { hasUnsavedChanges = true; statusBar.classList.remove('hidden'); }

window.addEventListener('beforeunload', (e) => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; } });

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) loginError.textContent = '❌ Credenciales incorrectas.';
});

logoutBtn.addEventListener('click', async () => {
  if (hasUnsavedChanges && !confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) return;
  await supabase.auth.signOut();
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    loginScreen.classList.add('hidden'); adminScreen.classList.remove('hidden');
    userEmail.textContent = session.user.email; loadMenu();
  } else {
    loginScreen.classList.remove('hidden'); adminScreen.classList.add('hidden');
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    loginScreen.classList.add('hidden'); adminScreen.classList.remove('hidden');
    userEmail.textContent = session.user.email; loadMenu();
  } else {
    loginScreen.classList.remove('hidden'); adminScreen.classList.add('hidden');
  }
});

async function loadMenu() {
  try {
    const { data, error } = await supabase.from('menu').select('data').eq('id', 'main').single();
    if (error) throw error;
    menuData = data?.data || { categories: [] };
    if (!menuData.categories) menuData.categories = [];
    if (!menuData.site) menuData.site = {};
    
    loadSiteConfig(menuData.site);
    render();
    hasUnsavedChanges = false;
    statusBar.classList.add('hidden');
  } catch (err) { alert('Error al cargar el menú: ' + err.message); }
}

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';
  try {
    const { error } = await supabase.from('menu').update({ data: menuData, updated_at: new Date().toISOString() }).eq('id', 'main');
    if (error) throw error;
    hasUnsavedChanges = false;
    statusBar.classList.add('hidden');
    saveBtn.textContent = '✅ Guardado';
    setTimeout(() => { saveBtn.textContent = '💾 Guardar cambios'; }, 1800);
  } catch (err) {
    alert('Error al guardar: ' + err.message);
    saveBtn.textContent = '💾 Guardar cambios';
  } finally { saveBtn.disabled = false; }
});

reloadBtn.addEventListener('click', () => {
  if (hasUnsavedChanges && !confirm('Perderás los cambios sin guardar. ¿Continuar?')) return;
  loadMenu();
});

addCategoryBtn.addEventListener('click', () => {
  menuData.categories.push({ id: uid(), categoria: "Nueva Categoría", icono: "🍽️", items: [] });
  markDirty(); render();
});

function addSubgroup(catId) {
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;
  if (!cat.subgrupos) {
    cat.subgrupos = [{ id: uid(), titulo: "General", items: cat.items || [] }];
    delete cat.items;
  }
  cat.subgrupos.push({ id: uid(), titulo: "Nueva Subcategoría", items: [] });
  markDirty(); render();
}

const SITE_DEFAULTS = {
  nombre: 'Villa Paraíso', subtitulo: 'Guardalavaca', tagline: 'Cocina del mar & parrilla',
  horas: '🕐 12:00 - 23:00', footerMensaje: 'Gracias por preferirnos', footerSub: 'Será un placer atenderle',
  footerCopy: '© 2025 Villa Paraíso Guardalavaca'
};
const SITE_FIELDS = { nombre: 'site-nombre', subtitulo: 'site-subtitulo', tagline: 'site-tagline', horas: 'site-horas', footerMensaje: 'site-footerMensaje', footerSub: 'site-footerSub', footerCopy: 'site-footerCopy' };

function loadSiteConfig(site) {
  if (!menuData.site) menuData.site = {};
  Object.keys(SITE_DEFAULTS).forEach(key => { if (menuData.site[key] === undefined || menuData.site[key] === '') menuData.site[key] = SITE_DEFAULTS[key]; });
  Object.entries(SITE_FIELDS).forEach(([key, id]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = menuData.site[key] || '';
    input.oninput = () => { menuData.site[key] = input.value; markDirty(); };
  });
}

function render() {
  container.innerHTML = '';
  if (menuData.categories.length === 0) { container.innerHTML = '<p class="empty-msg">No hay categorías. Añade una para empezar.</p>'; return; }

  menuData.categories.forEach((cat) => {
    const card = document.createElement('div'); card.className = 'category-card';
    const head = document.createElement('div'); head.className = 'category-head';
    
    const iconInput = document.createElement('input'); iconInput.className = 'cat-icon-input'; iconInput.value = cat.icono || '🍽️'; iconInput.maxLength = 3; iconInput.oninput = () => { cat.icono = iconInput.value; markDirty(); };
    const nameInput = document.createElement('input'); nameInput.className = 'cat-name-input'; nameInput.value = cat.categoria || ''; nameInput.placeholder = 'Nombre de la categoría'; nameInput.oninput = () => { cat.categoria = nameInput.value; markDirty(); };
    const delCat = document.createElement('button'); delCat.className = 'btn-danger btn-small'; delCat.textContent = '🗑️ Eliminar'; delCat.onclick = () => { if (confirm(`¿Eliminar la categoría "${cat.categoria}"?`)) { menuData.categories = menuData.categories.filter(c => c.id !== cat.id); markDirty(); render(); } };
    
    head.append(iconInput, nameInput, delCat); card.appendChild(head);

    const body = document.createElement('div'); body.className = 'category-body';

    if (cat.subgrupos && cat.subgrupos.length > 0) {
      cat.subgrupos.forEach(sub => { body.appendChild(renderSubgroup(cat, sub)); });
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
      convertBtn.onclick = () => { if (!confirm(`Esto convertirá los platos actuales de "${cat.categoria}" en un subgrupo "General". ¿Continuar?`)) return; addSubgroup(cat.id); };
    } else {
      convertBtn.textContent = '+ Añadir subcategoría';
      convertBtn.onclick = () => addSubgroup(cat.id);
    }
    body.appendChild(convertBtn);
    card.appendChild(body); container.appendChild(card);
  });
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
  const wrap = document.createElement('label'); wrap.className = 'avail-toggle'; wrap.title = 'Disponible hoy';
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = item.disponible !== false;
  input.onchange = () => {
    item.disponible = input.checked; markDirty();
    const row = wrap.closest('.item-row'); if (row) row.classList.toggle('unavailable', !input.checked);
    const parentBlock = wrap.closest('.subgroup-block') || wrap.closest('.category-body');
    if (parentBlock) {
      const counter = parentBlock.querySelector('.avail-counter');
      if (counter) { const rows = parentBlock.querySelectorAll('.item-row'); counter.textContent = `${Array.from(rows).filter(r => !r.classList.contains('unavailable')).length}/${rows.length} disponibles`; }
    }
  };
  const slider = document.createElement('span'); slider.className = 'avail-slider';
  wrap.append(input, slider);
  return wrap;
}

// =====================================================
// 🍽️ RENDER ITEM (Solo Destacados y Alérgenos)
// =====================================================
function renderItem(arr, item) {
  const row = document.createElement('div'); row.className = 'item-row'; if (item.disponible === false) row.classList.add('unavailable');
  const toggle = createAvailToggle(item);
  
  const nameInput = document.createElement('input'); nameInput.placeholder = 'Nombre del plato'; nameInput.value = item.nombre || ''; nameInput.oninput = () => { item.nombre = nameInput.value; markDirty(); };
  const priceInput = document.createElement('input'); priceInput.className = 'item-price-input'; priceInput.type = 'number'; priceInput.step = '0.01'; priceInput.placeholder = 'Precio'; priceInput.value = item.precio ?? 0; priceInput.oninput = () => { item.precio = parseFloat(priceInput.value) || 0; markDirty(); };
  const actions = document.createElement('div'); actions.className = 'item-actions';
  const delBtn = document.createElement('button'); delBtn.className = 'btn-danger btn-small'; delBtn.textContent = '🗑️'; delBtn.onclick = () => { if (confirm(`¿Eliminar "${item.nombre}"?`)) { const idx = arr.indexOf(item); if (idx > -1) arr.splice(idx, 1); markDirty(); render(); } }; actions.appendChild(delBtn);
  
  const descInput = document.createElement('textarea'); descInput.placeholder = 'Descripción (opcional)'; descInput.value = item.descripcion || ''; descInput.rows = 2; descInput.oninput = () => { item.descripcion = descInput.value; markDirty(); };
  
  const checksDiv = document.createElement('div');
  checksDiv.className = 'admin-checks';

  const addCheck = (text, key, isArray = false, value = '') => {
    const lbl = document.createElement('label');
    const chk = document.createElement('input'); chk.type = 'checkbox';
    if (isArray) {
      chk.checked = item[key] && item[key].includes(value);
      chk.onchange = () => {
        if (!item[key]) item[key] = [];
        if (chk.checked) item[key].push(value);
        else item[key] = item[key].filter(v => v !== value);
        markDirty();
      };
    } else {
      chk.checked = !!item[key];
      chk.onchange = () => { item[key] = chk.checked; markDirty(); };
    }
    lbl.appendChild(chk); lbl.appendChild(document.createTextNode(text));
    checksDiv.appendChild(lbl);
  };

  // Solo Destacado y Alérgenos
  addCheck('⭐ Destacado', 'destacado');
  addCheck('🥛 Lácteos', 'alergenos', true, 'lacteos');
  addCheck('🦐 Marisco', 'alergenos', true, 'marisco');
  addCheck('🥜 Frutos Secos', 'alergenos', true, 'frutos-secos');
  addCheck('🥚 Huevo', 'alergenos', true, 'huevo');

  row.append(toggle, nameInput, priceInput, actions, descInput, checksDiv);
  return row;
}

async function optimizeImage(file) {
  const imageBitmap = await createImageBitmap(file);
  let { width, height } = imageBitmap;
  if (width > 1200 || height > 1200) {
    if (width >= height) { height = Math.round((height / width) * 1200); width = 1200; }
    else { width = Math.round((width / height) * 1200); height = 1200; }
  }
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(imageBitmap, 0, 0, width, height); imageBitmap.close?.();
  const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.85));
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

function renderGalleryField(obj, labelText) {
  const wrap = document.createElement('div'); wrap.className = 'image-field';
  const label = document.createElement('label'); label.textContent = `📸 ${labelText} (Carrusel)`; wrap.appendChild(label);

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
  const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; dropZone.appendChild(fileInput);
  
  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    dropZone.classList.add('uploading'); dropZone.querySelector('.drop-text').textContent = 'Subiendo...';
    try {
      const optimized = await optimizeImage(file);
      const path = `gal-${Date.now()}.webp`;
      const { error } = await supabase.storage.from('fotos').upload(path, optimized, { contentType: 'image/webp' });
      if (error) throw error;
      const { data } = supabase.storage.from('fotos').getPublicUrl(path);
      obj.imagenes.push(data.publicUrl);
      markDirty(); renderThumbnails();
    } catch (err) { alert('Error al subir: ' + err.message); }
    finally { dropZone.classList.remove('uploading'); dropZone.querySelector('.drop-text').textContent = 'Añadir foto al carrusel'; fileInput.value = ''; }
  };
  wrap.appendChild(dropZone);
  return wrap;
}