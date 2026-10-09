// =====================================================
// 🍽️  MENÚ DIGITAL - VILLA PARAÍSO GUARDALAVACA
// Supabase + filtro de disponibilidad + galería expandible
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// 🔁 MENÚ DE RESPALDO
// =====================================================
const fallbackMenu = {
  categories: [
    { categoria: "Entrantes", icono: "🥗", items: [
      { nombre: "Croquetas de Jamón", precio: 120, descripcion: "5 unidades." }
    ]},
    { categoria: "Platos Principales", icono: "🍽️", subgrupos: [
      { titulo: "Cerdo", items: [
        { nombre: "Lechón Asado", precio: 280, descripcion: "Con mojo criollo." }
      ]}
    ]}
  ]
};

// =====================================================
// 🎯 ELEMENTOS DEL DOM
// =====================================================
const categoriesNav = document.getElementById('categories');
const menuContainer = document.getElementById('menu');

// =====================================================
// 🛠️ HELPERS
// =====================================================
const formatPrice = (price) => {
  const num = Number(price) || 0;
  return `$${num.toFixed(2)}`;
};

const escapeHTML = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const estaDisponible = (item) => item.disponible !== false;

// =====================================================
// 🎨 RENDERIZAR ICONO (emoji o imagen/GIF)
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
// 🎨 APLICAR CONFIGURACIÓN DEL SITIO (hero + footer)
// =====================================================
function applySiteConfig(site) {
  if (!site) return;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null && val !== '') {
      el.textContent = val;
    }
  };

  setText('heroNombre', site.nombre);
  setText('heroSubtitulo', site.subtitulo);
  setText('heroTagline', site.tagline);
  setText('heroHoras', site.horas);
  setText('heroWifi', site.wifi);
  setText('footerSub', site.footerSub);
  setText('footerCopy', site.footerCopy);

  // ✅ Mensaje del footer: texto plano + nombre en negrita dorada automática
  const footerMsg = document.getElementById('footerMensaje');
  if (footerMsg && site.footerMensaje) {
    // Limpiamos cualquier HTML que haya quedado guardado por error
    const textoLimpio = String(site.footerMensaje).replace(/<[^>]*>/g, '').trim();

    // Si el nombre del restaurante aparece en el mensaje, lo ponemos en negrita dorada
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
// 📥 CARGAR MENÚ DESDE SUPABASE
// =====================================================
let menuData = fallbackMenu;

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
      console.log('✅ Menú cargado desde Supabase');
    } else {
      console.log('ℹ️ Usando menú de respaldo.');
    }
    if (data?.data?.site) {
      applySiteConfig(data.data.site);
    }
  } catch (err) {
    console.warn('⚠️ Error Supabase, usando respaldo:', err.message);
  }
  renderMenu();
}

// =====================================================
// 🎨 RENDERIZAR MENÚ COMPLETO
// =====================================================
function renderMenu() {
  categoriesNav.innerHTML = '';
  menuContainer.innerHTML = '';

  // ---- BOTONES DE CATEGORÍA ----
  menuData.categories.forEach((cat, index) => {
    let tieneDisponibles = false;
    if (cat.subgrupos && cat.subgrupos.length > 0) {
      tieneDisponibles = cat.subgrupos.some(sub =>
        (sub.items || []).some(estaDisponible)
      );
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

  // ---- SECCIONES ----
  menuData.categories.forEach((cat, index) => {
    let tieneDisponibles = false;
    if (cat.subgrupos && cat.subgrupos.length > 0) {
      tieneDisponibles = cat.subgrupos.some(sub =>
        (sub.items || []).some(estaDisponible)
      );
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

    if (cat.subgrupos && cat.subgrupos.length > 0) {
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
    menuContainer.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#999;">
        <p style="font-family:Cormorant Garamond,serif;font-size:1.3rem;font-style:italic;">
          La carta se está actualizando.
        </p>
        <p style="font-family:Poppins,sans-serif;font-size:0.85rem;margin-top:10px;">
          Por favor, consulte con su mesero.
        </p>
      </div>
    `;
  }
}

// =====================================================
// 🍽️ RENDERIZAR LISTA DE PLATOS
// =====================================================
function renderItems(items) {
  const grid = document.createElement('div');
  grid.className = 'items-grid';

  const visibles = (items || []).filter(estaDisponible);

  if (visibles.length === 0) {
    grid.innerHTML = `
      <p style="color:#999;font-style:italic;padding:14px;text-align:center;
                font-family:Cormorant Garamond,serif;font-size:1.05rem;">
        No hay platos disponibles por ahora.
      </p>
    `;
    return grid;
  }

  visibles.forEach(item => {
    const el = document.createElement('article');
    el.className = 'menu-item';

    const badgeHTML = item.badge
      ? `<span class="badge ${item.tipo || ''}">
           ${item.tipo === 'premium' ? '⭐' : item.tipo === 'veg' ? '🌱' : '•'}
           ${escapeHTML(item.badge)}
         </span>`
      : '';

    const descHTML = item.descripcion
      ? `<p class="item-desc">${escapeHTML(item.descripcion)}</p>`
      : '';

    el.innerHTML = `
      <div class="item-info">
        <div class="item-header">
          <span class="item-name">${escapeHTML(item.nombre || 'Sin nombre')}</span>
          <span class="item-price">${formatPrice(item.precio)}</span>
        </div>
        ${descHTML}
        ${badgeHTML}
      </div>
    `;
    grid.appendChild(el);
  });

  return grid;
}

// =====================================================
// 📸 GALERÍA EXPANDIBLE — Foto + variantes
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

    const descHTML = item.descripcion
      ? `<p class="variant-desc">${escapeHTML(item.descripcion)}</p>`
      : '';

    card.innerHTML = `
      <div class="variant-header">
        <span class="variant-name">${escapeHTML(item.nombre || '')}</span>
        <span class="variant-price">${formatPrice(item.precio)}</span>
      </div>
      ${descHTML}
    `;
    variants.appendChild(card);
  });

  photo.onclick = () => {
    wrapper.classList.toggle('expanded');
  };

  wrapper.append(photo, variants);
  return wrapper;
}

// =====================================================
// 🚀 INICIAR
// =====================================================
loadFromSupabase();