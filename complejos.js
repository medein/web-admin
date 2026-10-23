// ---------------------------------------------------------------------------
// Complejos · CRUD + imagen + coordenadas + reactivar
// Usa helpers de app.js: apiFetch, notificar, escapar, mensajeError, urlAbsoluta
// ---------------------------------------------------------------------------

let modalComplejo;
let complejosCache = [];

/// Placeholder embebido (no depende de servicios externos).
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='140'>" +
    "<rect width='400' height='140' fill='%23eef2f4'/>" +
    "<text x='50%25' y='50%25' font-family='sans-serif' font-size='14' " +
      "fill='%23999' text-anchor='middle' dominant-baseline='middle'>" +
      "Sin imagen" +
    "</text>" +
  "</svg>";

// --- Carga ------------------------------------------------------------------

async function cargarComplejos() {
  const contador = document.getElementById('contadorComplejos');
  const lista = document.getElementById('listaComplejos');
  if (!lista) return;

  try {
    // Pedimos también los inactivos para poder reactivarlos.
    const res = await apiFetch('/complejos?incluir_inactivos=true');
    if (!res.ok) {
      lista.innerHTML = `<div class="col-12"><div class="alert alert-danger">${await mensajeError(res, 'No se pudieron cargar los complejos')}</div></div>`;
      return;
    }
    complejosCache = await res.json();
    if (contador) contador.textContent = `${complejosCache.length} complejo(s)`;
    renderComplejos();
  } catch (e) {
    console.error('Error al cargar complejos:', e);
  }
}

function renderComplejos() {
  const lista = document.getElementById('listaComplejos');
  if (!lista) return;

  if (complejosCache.length === 0) {
    lista.innerHTML = `<div class="col-12"><div class="alert alert-info">No hay complejos todavía. Crea el primero.</div></div>`;
    return;
  }

  lista.innerHTML = complejosCache.map(c => {
    const tieneCoords = c.latitud != null && c.longitud != null;
    const fotoUrl = c.imagen_url ? urlAbsoluta(c.imagen_url) : null;
    const inactivo = c.activo === false;

    return `
    <div class="col-md-6 col-lg-4">
      <div class="card border-0 shadow-sm h-100 overflow-hidden card-complejo ${inactivo ? 'opacity-75' : ''}">
        <div style="height:140px;background:#eef2f4;position:relative;">
          <img src="${fotoUrl || PLACEHOLDER_IMG}"
               style="width:100%;height:100%;object-fit:cover;${inactivo ? 'filter:grayscale(1);' : ''}"
               onerror="this.onerror=null;this.src=PLACEHOLDER_IMG;">
          ${inactivo ? `<span class="badge bg-danger position-absolute top-0 end-0 m-2">Inactivo</span>` : ''}
        </div>
        <div class="card-body d-flex flex-column">
          <h5 class="card-title fw-bold mb-1">${escapar(c.nombre)}</h5>
          <p class="text-muted mb-2 small">${escapar(c.direccion || 'Sin dirección')}</p>
          <div class="mb-3 d-flex flex-wrap gap-2">
            <span class="badge bg-light text-dark">${c.total_canchas ?? 0} canchas</span>
            ${c.horario_apertura && c.horario_cierre
              ? `<span class="badge bg-light text-dark">${c.horario_apertura} - ${c.horario_cierre}</span>` : ''}
            ${c.telefono ? `<span class="badge bg-light text-dark">${escapar(c.telefono)}</span>` : ''}
            ${tieneCoords
              ? `<span class="badge bg-success-subtle text-success border border-success-subtle">
                   <i class="fa-solid fa-location-dot me-1"></i>Con ubicación
                 </span>`
              : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle">
                   <i class="fa-solid fa-location-dot me-1"></i>Sin ubicación
                 </span>`}
          </div>
          <div class="mt-auto d-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary flex-fill"
                    onclick="abrirFormularioComplejo(${c.id})">
              <i class="fa-solid fa-pen"></i> Editar
            </button>
            ${inactivo
              ? `<button class="btn btn-sm btn-outline-success flex-fill"
                         onclick="reactivarComplejo(${c.id})">
                   <i class="fa-solid fa-rotate-right"></i> Reactivar
                 </button>`
              : `<button class="btn btn-sm btn-outline-danger flex-fill"
                         onclick="desactivarComplejo(${c.id}, '${escapar(c.nombre).replace(/'/g, "&#39;")}')">
                   <i class="fa-solid fa-trash"></i> Desactivar
                 </button>`}
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// --- Modal ------------------------------------------------------------------

function abrirFormularioComplejo(id = null) {
  const c = id ? complejosCache.find(x => x.id === id) : null;

  document.getElementById('modal-titulo-complejo').textContent =
    c ? 'Editar Complejo' : 'Nuevo Complejo';
  document.getElementById('complejo-id').value = c?.id ?? '';
  document.getElementById('complejo-nombre').value = c?.nombre ?? '';
  document.getElementById('complejo-direccion').value = c?.direccion ?? '';
  document.getElementById('complejo-telefono').value = c?.telefono ?? '';
  document.getElementById('complejo-latitud').value = c?.latitud ?? '';
  document.getElementById('complejo-longitud').value = c?.longitud ?? '';
  document.getElementById('complejo-apertura').value = c?.horario_apertura ?? '07:00';
  document.getElementById('complejo-cierre').value = c?.horario_cierre ?? '23:00';
  document.getElementById('complejo-activo').checked = c?.activo !== false;

  const estadoUbi = document.getElementById('estadoUbicacion');
  if (estadoUbi) estadoUbi.innerHTML = '';
  const estadoImg = document.getElementById('estado-imagen');
  if (estadoImg) estadoImg.innerHTML = '';

  actualizarPreviewImagenComplejo(c);

  modalComplejo.show();
}

function actualizarPreviewImagenComplejo(complejo) {
  const img = document.getElementById('preview-imagen-complejo');
  if (!img) return;

  if (complejo?.imagen_url) {
    img.src = urlAbsoluta(complejo.imagen_url);
  } else {
    img.src = PLACEHOLDER_IMG;
  }
}

// --- Subir imagen -----------------------------------------------------------

async function subirImagenComplejo(input) {
  const archivo = input.files[0];
  if (!archivo) return;

  const id = document.getElementById('complejo-id').value;
  if (!id) {
    notificar('Guarda primero el complejo para poder subir una imagen.', 'warning');
    input.value = '';
    return;
  }

  const estado = document.getElementById('estado-imagen');
  if (estado) {
    estado.innerHTML = '<span class="text-muted"><i class="fa-solid fa-spinner fa-spin me-1"></i>Subiendo imagen…</span>';
  }

  const formData = new FormData();
  formData.append('archivo', archivo);

  try {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_URL}/complejos/${id}/imagen`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (res.status === 401) {
      cerrarSesion();
      return;
    }
    if (!res.ok) {
      const msg = await mensajeError(res, 'No se pudo subir la imagen');
      if (estado) estado.innerHTML = `<span class="text-danger">${msg}</span>`;
      notificar(msg, 'danger');
      return;
    }

    const data = await res.json();
    document.getElementById('preview-imagen-complejo').src =
      urlAbsoluta(data.imagen_url) + '?t=' + Date.now();
    if (estado) {
      estado.innerHTML = '<span class="text-success"><i class="fa-solid fa-check me-1"></i>Imagen actualizada</span>';
    }
    notificar('Imagen del complejo actualizada.');
    cargarComplejos();
  } catch (e) {
    console.error('Error al subir imagen del complejo:', e);
    if (estado) estado.innerHTML = '<span class="text-danger">Error de red</span>';
    notificar('No se pudo conectar con el servidor.', 'danger');
  } finally {
    input.value = '';
  }
}

// --- Guardar complejo -------------------------------------------------------

async function guardarComplejo(e) {
  e.preventDefault();
  const id = document.getElementById('complejo-id').value;

  const latRaw = document.getElementById('complejo-latitud').value.trim();
  const lngRaw = document.getElementById('complejo-longitud').value.trim();

  const body = {
    nombre: document.getElementById('complejo-nombre').value.trim(),
    direccion: document.getElementById('complejo-direccion').value.trim(),
    telefono: document.getElementById('complejo-telefono').value.trim() || null,
    latitud: latRaw === '' ? null : parseFloat(latRaw),
    longitud: lngRaw === '' ? null : parseFloat(lngRaw),
    horario_apertura: document.getElementById('complejo-apertura').value || '07:00',
    horario_cierre: document.getElementById('complejo-cierre').value || '23:00',
    activo: document.getElementById('complejo-activo').checked,
  };

  if ((body.latitud === null) !== (body.longitud === null)) {
    return notificar('Completa latitud y longitud, o deja ambas vacías.', 'warning');
  }
  if (body.latitud !== null && (body.latitud < -90 || body.latitud > 90)) {
    return notificar('La latitud debe estar entre -90 y 90.', 'warning');
  }
  if (body.longitud !== null && (body.longitud < -180 || body.longitud > 180)) {
    return notificar('La longitud debe estar entre -180 y 180.', 'warning');
  }

  try {
    const res = await apiFetch(id ? `/complejos/${id}` : '/complejos', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      notificar(await mensajeError(res, 'No se pudo guardar el complejo'), 'danger');
      return;
    }

    const guardado = await res.json();

    if (!id && guardado?.id) {
      document.getElementById('complejo-id').value = guardado.id;
      document.getElementById('modal-titulo-complejo').textContent = 'Editar Complejo';
      notificar('Complejo creado. Ya puedes subir la imagen.');
      cargarComplejos();
      return;
    }

    notificar('Complejo actualizado');
    modalComplejo.hide();
    cargarComplejos();
  } catch (e) {
    console.error('Error al guardar complejo:', e);
  }
}

// --- Desactivar / Reactivar -------------------------------------------------

async function desactivarComplejo(id, nombre) {
  if (!confirm(`¿Desactivar "${nombre}"? Dejará de aparecer en la app de clientes, pero podrás reactivarlo después.`)) return;

  try {
    const res = await apiFetch(`/complejos/${id}`, { method: 'DELETE' });
    if (res.status !== 204 && !res.ok) {
      notificar(await mensajeError(res, 'No se pudo desactivar'), 'danger');
      return;
    }
    notificar('Complejo desactivado');
    cargarComplejos();
  } catch (e) {
    console.error('Error al desactivar:', e);
  }
}

async function reactivarComplejo(id) {
  try {
    const res = await apiFetch(`/complejos/${id}/reactivar`, { method: 'PUT' });
    if (!res.ok) {
      notificar(await mensajeError(res, 'No se pudo reactivar'), 'danger');
      return;
    }
    notificar('Complejo reactivado');
    cargarComplejos();
  } catch (e) {
    console.error('Error al reactivar:', e);
  }
}

// --- Geolocalización + reverse geocoding ------------------------------------

function usarMiUbicacion() {
  const estado = document.getElementById('estadoUbicacion');

  if (!navigator.geolocation) {
    if (estado) estado.innerHTML = '<span class="text-danger">Tu navegador no soporta geolocalización.</span>';
    return;
  }

  if (estado) {
    estado.innerHTML = '<span class="text-muted"><i class="fa-solid fa-spinner fa-spin me-1"></i>Obteniendo ubicación…</span>';
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      document.getElementById('complejo-latitud').value = lat.toFixed(6);
      document.getElementById('complejo-longitud').value = lng.toFixed(6);

      if (estado) {
        estado.innerHTML = '<span class="text-muted"><i class="fa-solid fa-spinner fa-spin me-1"></i>Buscando dirección…</span>';
      }

      try {
        const direccion = await obtenerDireccionDesdeCoords(lat, lng);

        if (direccion) {
          document.getElementById('complejo-direccion').value = direccion;
          if (estado) {
            estado.innerHTML = `<span class="text-success">
              <i class="fa-solid fa-check me-1"></i>Ubicación y dirección capturadas
              (±${Math.round(pos.coords.accuracy)} m)
            </span>`;
          }
        } else {
          if (estado) {
            estado.innerHTML = `<span class="text-warning">
              <i class="fa-solid fa-triangle-exclamation me-1"></i>
              Coordenadas capturadas, pero no se encontró la dirección.
            </span>`;
          }
        }
      } catch (err) {
        console.warn('Reverse geocoding falló:', err);
        if (estado) {
          estado.innerHTML = `<span class="text-warning">
            <i class="fa-solid fa-triangle-exclamation me-1"></i>
            Coordenadas capturadas. Escribe la dirección manualmente.
          </span>`;
        }
      }
    },
    (err) => {
      let msg = 'No se pudo obtener la ubicación.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Permiso de ubicación denegado. Actívalo en el navegador.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Ubicación no disponible. Verifica tu GPS.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'La ubicación tardó demasiado. Intenta de nuevo.';
      }
      if (estado) estado.innerHTML = `<span class="text-danger">${msg}</span>`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

async function obtenerDireccionDesdeCoords(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Nominatim respondió ' + res.status);

  const data = await res.json();
  const a = data.address || {};

  const esZona = (v) => typeof v === 'string' && /^zona\s+\d+$/i.test(v.trim());

  const camposZona = [
    a.suburb, a.neighbourhood, a.quarter, a.residential,
    a.city_district, a.district, a.borough,
  ];
  const zonaReal = camposZona.find(esZona) || null;

  const partes = [];

  if (a.road) {
    partes.push(a.house_number ? `${a.house_number} ${a.road}` : a.road);
  }

  const barrio = a.neighbourhood || a.suburb || a.quarter || a.residential;
  if (barrio && !esZona(barrio) && !partes.includes(barrio)) {
    partes.push(barrio);
  }

  if (zonaReal && !partes.includes(zonaReal)) {
    partes.push(zonaReal);
  }

  const ciudad = a.city || a.town || a.village || a.municipality;
  if (ciudad && !partes.includes(ciudad)) {
    partes.push(ciudad);
  }

  if (a.state && partes.length < 4 && !partes.includes(a.state)) {
    partes.push(a.state);
  }

  if (partes.length === 0) {
    let fallback = (data.display_name || '').split(',').map(p => p.trim());
    fallback = fallback.filter(p => !/^\d{4,6}$/.test(p));
    if (fallback.length > 1) fallback = fallback.slice(0, -1);
    return fallback.join(', ') || null;
  }

  return partes.join(', ');
}

// --- Init -------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('modalComplejo');
  if (el) modalComplejo = new bootstrap.Modal(el);
  const form = document.getElementById('formComplejo');
  if (form) form.addEventListener('submit', guardarComplejo);
  cargarComplejos();
});