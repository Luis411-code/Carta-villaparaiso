// =====================================================
// 🔐 PANEL DE ADMINISTRACIÓN - VILLA PARAÍSO GUARDALAVACA
// Supabase + disponibilidad + fotos + config del sitio
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let menuData = { categories: [] };
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
    loginError.textContent = '❌ Credenciales incorrectas. Verifica tu email y contraseña.';
  }
});

logoutBtn.addEventListener('click', async () => {
  if (hasUnsavedChanges && !confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) return;
  await supabase.auth.signOut();
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    userEmail.textContent = session.user.email;
    loadMenu();
  } else {
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    userEmail.textContent = session.user.email;
    loadMenu();
  } else {
    loginScreen.classList.remove('hidden');
    adminScreen.classList.add('hidden');
  }
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
// 🏠 CONFIGURACIÓN DEL SITIO (hero + footer)
// Valores por defecto si aún no hay nada guardado
// =====================================================
const SITE_DEFAULTS = {
  nombre: 'Villa Paraíso',
  subtitulo: 'Guardalavaca',
  tagline: 'Cocina del mar & parrilla',
  horas: '🕐 12:00 - 23:00',
  wifi: '📶 WiFi: VillaParaiso',
  footerMensaje: 'Gracias por preferirnos',
  footerSub: 'Será un placer atenderle',
  footerCopy: '© 2025 Villa Paraíso Guardalavaca'
};

const SITE_FIELDS = {
  nombre: 'site-nombre',
  subtitulo: 'site-subtitulo',
  tagline: 'site-tagline',
  horas: 'site-horas',
  wifi: 'site-wifi',
  footerMensaje: 'site-footerMensaje',
  footerSub: 'site-footerSub',
  footerCopy: 'site-footerCopy'
};

function loadSiteConfig(site) {
  // Rellenar valores por defecto si no existen
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
// ➕ AÑADIR CATEGORÍA
// =====================================================
addCategoryBtn.addEventListener('click', () => {
  menuData.categories.push({
    id: uid(),
    categoria: "Nueva Categoría",
    icono: "🍽️",
    items: []
  });
  markDirty();
  render();
});

// =====================================================
// ➕ AÑADIR SUBCATEGORÍA
// =====================================================
function addSubgroup(catId) {
  const cat = menuData.categories.find(c => c.id === catId);
  if (!cat) return;

  if (!cat.subgrupos) {
    const itemsExistentes = cat.items || [];
    cat.subgrupos = [{
      id: uid(),
      titulo: itemsExistentes.length > 0 ? "General" : "Nueva Subcategoría",
      items: itemsExistentes
    }];
    delete cat.items;
  } else {
    cat.subgrupos.push({
      id: uid(),
      titulo: "Nueva Subcategoría",
      items: []
    });
  }

  markDirty();
  render();
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

    // ---------- HEAD ----------
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
    nameInput.placeholder = 'Nombre de la categoría';
    nameInput.oninput = () => { cat.categoria = nameInput.value; markDirty(); };

    const delCat = document.createElement('button');
    delCat.className = 'btn-danger btn-small';
    delCat.textContent = '🗑️ Eliminar';
    delCat.onclick = () => {
      if (confirm(`¿Eliminar la categoría "${cat.categoria}"?`)) {
        menuData.categories = menuData.categories.filter(c => c.id !== cat.id);
        markDirty();
        render();
      }
    };

    head.append(iconInput, nameInput, delCat);
    card.appendChild(head);

    // ---------- BODY ----------
    const body = document.createElement('div');
    body.className = 'category-body';

    if (cat.subgrupos && cat.subgrupos.length > 0) {
      cat.subgrupos.forEach(sub => {
        body.appendChild(renderSubgroup(cat, sub));
      });
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
        cat.items.push({
          id: uid(),
          nombre: "Nuevo plato",
          precio: 0,
          descripcion: "",
          disponible: true
        });
        markDirty();
        render();
      };
      body.appendChild(addBtn);
    }

    // ---------- BOTÓN SUBCATEGORÍAS ----------
    const convertBtn = document.createElement('button');
    convertBtn.className = 'btn-secondary btn-small';
    convertBtn.style.marginTop = '12px';
    convertBtn.style.width = '100%';

    if (!cat.subgrupos || cat.subgrupos.length === 0) {
      convertBtn.textContent = '📂 Convertir en subcategorías (agrupar platos)';
      convertBtn.onclick = () => {
        const tieneItems = (cat.items || []).length > 0;
        const msg = tieneItems
          ? `Esto convertirá los platos actuales de "${cat.categoria}" en un subgrupo llamado "General", ` +
            `y luego podrás añadir más subcategorías como "Pollo", "Cerdo", etc.\n\n¿Continuar?`
          : `Se crearán subcategorías dentro de "${cat.categoria}".\n\n¿Continuar?`;
        if (!confirm(msg)) return;
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
      if (cat.subgrupos.length === 0) {
        cat.items = [];
        delete cat.subgrupos;
      }
      markDirty();
      render();
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
    sub.items.push({
      id: uid(),
      nombre: "Nuevo plato",
      precio: 0,
      descripcion: "",
      disponible: true
    });
    markDirty();
    render();
  };
  block.appendChild(addBtn);

  return block;
}

// =====================================================
// 🎛️ BARRA DE HERRAMIENTAS RÁPIDAS
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
  btnOn.onclick = () => {
    items.forEach(it => it.disponible = true);
    markDirty();
    (onRerender || render)();
  };
  bar.appendChild(btnOn);

  const btnOff = document.createElement('button');
  btnOff.className = 'btn-all-off';
  btnOff.textContent = '🚫 Desmarcar todo';
  btnOff.onclick = () => {
    items.forEach(it => it.disponible = false);
    markDirty();
    (onRerender || render)();
  };
  bar.appendChild(btnOff);

  const disponibles = items.filter(it => it.disponible !== false).length;
  const counter = document.createElement('span');
  counter.className = 'avail-counter';
  counter.textContent = `${disponibles}/${items.length} disponibles`;
  bar.appendChild(counter);

  return bar;
}

// =====================================================
// 🔀 TOGGLE DE DISPONIBILIDAD
// =====================================================
function createAvailToggle(item) {
  const wrap = document.createElement('label');
  wrap.className = 'avail-toggle';
  wrap.title = 'Disponible hoy';

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
        const total = rows.length;
        const ok = Array.from(rows).filter(r => !r.classList.contains('unavailable')).length;
        counter.textContent = `${ok}/${total} disponibles`;
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
      markDirty();
      render();
    }
  };
  actions.appendChild(delBtn);

  const descInput = document.createElement('textarea');
  descInput.placeholder = 'Descripción (opcional)';
  descInput.value = item.descripcion || '';
  descInput.rows = 2;
  descInput.oninput = () => { item.descripcion = descInput.value; markDirty(); };

  row.append(toggle, nameInput, priceInput, actions, descInput);
  return row;
}

// =====================================================
// 🖼️ OPTIMIZACIÓN AUTOMÁTICA DE IMÁGENES
// =====================================================
async function optimizeImage(file, options = {}) {
  const {
    maxDimension = 1200,
    quality = 0.85,
    format = 'image/webp'
  } = options;

  const imageBitmap = await createImageBitmap(file);

  let { width, height } = imageBitmap;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height / width) * maxDimension);
      width = maxDimension;
    } else {
      width = Math.round((width / height) * maxDimension);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))),
      format,
      quality
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
  const optimizedFile = new File(
    [blob],
    `${baseName}.webp`,
    { type: format, lastModified: Date.now() }
  );

  const originalKB = (file.size / 1024).toFixed(0);
  const optimizedKB = (blob.size / 1024).toFixed(0);
  const saving = (100 - (blob.size / file.size) * 100).toFixed(0);
  console.log(
    `🖼️ Optimizado: ${originalKB} KB → ${optimizedKB} KB ` +
    `(-${saving}%) · ${width}×${height}px`
  );

  return optimizedFile;
}

// =====================================================
// 📸 CAMPO DE IMAGEN — Subida directa a Supabase Storage
// =====================================================
function renderImageField(obj, labelText) {
  const wrap = document.createElement('div');
  wrap.className = 'image-field';

  const label = document.createElement('label');
  label.textContent = `📸 ${labelText}`;
  wrap.appendChild(label);

  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';

  const dropIcon = document.createElement('span');
  dropIcon.className = 'drop-icon';
  dropIcon.textContent = '📤';

  const dropText = document.createElement('span');
  dropText.className = 'drop-text';
  dropText.textContent = 'Arrastra una foto aquí';

  const dropSub = document.createElement('span');
  dropSub.className = 'drop-sub';
  dropSub.textContent = 'o tócala para elegir desde el móvil / PC';

  dropZone.append(fileInput, dropIcon, dropText, dropSub);

  const progressWrap = document.createElement('div');
  progressWrap.className = 'upload-progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'bar';
  progressWrap.appendChild(progressBar);

  const previewBox = document.createElement('div');
  previewBox.className = 'image-preview-box';
  previewBox.style.display = 'none';

  const previewImg = document.createElement('img');
  previewImg.alt = 'Preview';

  const previewInfo = document.createElement('div');
  previewInfo.className = 'image-preview-info';

  const filename = document.createElement('span');
  filename.className = 'filename';

  const actionsRow = document.createElement('div');
  actionsRow.className = 'actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'btn-preview';
  openBtn.textContent = '🔍 Ver';
  openBtn.onclick = () => window.open(obj.imagen, '_blank');

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-remove-img';
  removeBtn.textContent = '🗑️ Quitar';
  removeBtn.onclick = async () => {
    if (!confirm('¿Quitar esta foto?')) return;
    if (obj.imagen && obj.imagen.includes('/fotos/')) {
      try {
        const path = obj.imagen.split('/fotos/')[1];
        await supabase.storage.from('fotos').remove([path]);
      } catch (e) { /* silencioso */ }
    }
    obj.imagen = undefined;
    previewBox.style.display = 'none';
    dropZone.style.display = 'block';
    markDirty();
  };

  actionsRow.append(openBtn, removeBtn);
  previewInfo.append(filename, actionsRow);
  previewBox.append(previewImg, previewInfo);

  const urlToggle = document.createElement('span');
  urlToggle.className = 'manual-url-toggle';
  urlToggle.textContent = 'o pegar URL manualmente';

  const urlWrap = document.createElement('div');
  urlWrap.className = 'manual-url-wrap';
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.placeholder = 'https://.../foto.jpg';
  urlInput.oninput = () => {
    const val = urlInput.value.trim();
    obj.imagen = val || undefined;
    if (val) {
      previewImg.src = val;
      filename.textContent = val.split('/').pop();
      previewBox.style.display = 'flex';
      dropZone.style.display = 'none';
    } else {
      previewBox.style.display = 'none';
      dropZone.style.display = 'block';
    }
    markDirty();
  };
  urlWrap.appendChild(urlInput);

  urlToggle.onclick = () => urlWrap.classList.toggle('open');

  async function uploadFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('❌ Solo se permiten imágenes.');
      return;
    }

    const MAX_MB = 20;
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`❌ La imagen pesa más de ${MAX_MB} MB. Es demasiado grande.`);
      return;
    }

    dropZone.classList.add('uploading');
    dropIcon.textContent = '⏳';
    dropText.textContent = 'Optimizando...';
    progressWrap.classList.add('active');
    progressBar.style.width = '15%';

    try {
      let optimized;
      try {
        optimized = await optimizeImage(file);
      } catch (optErr) {
        console.warn('⚠️ Falló la optimización, subiendo original:', optErr);
        optimized = file;
      }

      progressBar.style.width = '40%';
      dropText.textContent = 'Subiendo...';

      const ext = optimized.name.split('.').pop().toLowerCase();
      const safeName = optimized.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 40);
      const path = `${safeName}-${Date.now()}.${ext}`;

      progressBar.style.width = '60%';

      const { error: upErr } = await supabase.storage
        .from('fotos')
        .upload(path, optimized, {
          cacheControl: '31536000',
          upsert: false,
          contentType: optimized.type
        });

      if (upErr) throw upErr;

      progressBar.style.width = '90%';

      const { data: urlData } = supabase.storage
        .from('fotos')
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      obj.imagen = publicUrl;
      markDirty();

      previewImg.src = publicUrl;
      filename.textContent = `${path} · ${(optimized.size / 1024).toFixed(0)} KB`;
      previewBox.style.display = 'flex';
      dropZone.style.display = 'none';

      progressBar.style.width = '100%';
      setTimeout(() => {
        progressWrap.classList.remove('active');
        progressBar.style.width = '0%';
      }, 700);

    } catch (err) {
      alert('❌ Error al subir la imagen: ' + err.message);
    } finally {
      dropZone.classList.remove('uploading');
      dropIcon.textContent = '📤';
      dropText.textContent = 'Arrastra una foto aquí';
      fileInput.value = '';
    }
  }

  dropZone.onclick = (e) => {
    if (e.target !== fileInput) fileInput.click();
  };

  fileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadFile(file);
  });

  if (obj.imagen) {
    previewImg.src = obj.imagen;
    filename.textContent = obj.imagen.split('/').pop();
    previewBox.style.display = 'flex';
    dropZone.style.display = 'none';
    urlInput.value = obj.imagen;
  }

  wrap.append(dropZone, progressWrap, previewBox, urlToggle, urlWrap);
  return wrap;
}