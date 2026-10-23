// Panel de administración. Requiere config.js cargado antes que este archivo.

// ---------------------------------------------------------------------------
// Sesión y utilidades
// ---------------------------------------------------------------------------

function getHeaders() {
    const token = localStorage.getItem('admin_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function cerrarSesion(event) {
    if (event) event.preventDefault();
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_nombre');
    localStorage.removeItem('admin_rol');
    localStorage.removeItem('admin_complejo_id');
    localStorage.removeItem('admin_complejo_nombre');
    localStorage.removeItem('admin_complejo_fijo');
    window.location.href = 'login.html';
}

/// Aviso flotante que se cierra solo.
function notificar(mensaje, tipo = 'success') {
    let zona = document.getElementById('zonaAvisos');
    if (!zona) {
        zona = document.createElement('div');
        zona.id = 'zonaAvisos';
        zona.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:1080;max-width:420px;';
        document.body.appendChild(zona);
    }

    const aviso = document.createElement('div');
    aviso.className = `alert alert-${tipo} alert-dismissible shadow-sm`;
    aviso.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    zona.appendChild(aviso);

    setTimeout(() => aviso.remove(), 5000);
}

async function mensajeError(res, porDefecto) {
    try {
        const data = await res.json();
        const detail = data.detail ?? data.message ?? data.mensaje;
        if (typeof detail === 'string' && detail) return detail;
        if (Array.isArray(detail) && detail.length) {
            const primero = detail[0];
            if (primero && primero.msg) {
                const campo = Array.isArray(primero.loc) ? primero.loc.slice(-1)[0] : '';
                return campo ? `${campo}: ${primero.msg}` : primero.msg;
            }
        }
    } catch (_) {}
    return `${porDefecto} (código ${res.status})`;
}

async function apiFetch(ruta, opciones = {}) {
    const res = await fetch(`${API_URL}${ruta}`, {
        ...opciones,
        headers: { ...getHeaders(), ...(opciones.headers || {}) }
    });

    if (res.status === 401) {
        cerrarSesion();
        throw new Error('Sesión expirada');
    }
    if (res.status === 403) {
        notificar('Tu usuario no tiene permisos de administrador.', 'danger');
        throw new Error('Sin permisos');
    }
    return res;
}

function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function configurarFondoCover() {
    const toggle = document.getElementById('toggleBackgroundCover');
    if (!toggle) return;

    const activarFondo = (activo) => {
        document.body.classList.toggle('background-cover', activo);
        toggle.checked = activo;
    };

    activarFondo(localStorage.getItem('background_cover') === 'true');
    toggle.addEventListener('change', () => {
        localStorage.setItem('background_cover', String(toggle.checked));
        activarFondo(toggle.checked);
    });
}

function mostrarUsuarioSesion() {
    const zona = document.getElementById('usuarioSesion');
    if (!zona) return;
    const nombre = localStorage.getItem('admin_nombre') || 'Administrador';
    zona.innerText = nombre;
}

function mostrarComplejoActual() {
    const el = document.getElementById('complejoActual');
    if (!el) return;
    el.innerText = localStorage.getItem('admin_complejo_nombre') || 'Sin complejo';
}

function cambiarComplejo(e) {
    if (e) e.preventDefault();
    if (esAdminDeComplejo()) {
        notificar('No puedes cambiar de complejo. Contacta a la gerencia.', 'warning');
        return;
    }
    localStorage.removeItem('admin_complejo_id');
    localStorage.removeItem('admin_complejo_nombre');
    window.location.href = 'seleccionar_complejo.html';
}

/// true si el usuario tiene un complejo FIJO asignado por el backend.
/// Se marca en login.html cuando el backend devuelve usuario.complejo_id.
function esAdminDeComplejo() {
    return localStorage.getItem('admin_complejo_fijo') === 'true';
}

/// Para admin de complejo: si no tenemos el nombre guardado,
/// lo pedimos al backend y lo cacheamos en localStorage.
async function resolverNombreComplejo() {
    if (!esAdminDeComplejo()) return;
    const id = localStorage.getItem('admin_complejo_id');
    if (!id) return;

    if (localStorage.getItem('admin_complejo_nombre')) {
        mostrarComplejoActual();
        return;
    }

    try {
        const res = await apiFetch('/complejos');
        if (!res.ok) return;
        const lista = await res.json();
        const c = lista.find(x => String(x.id) === String(id));
        if (c) {
            localStorage.setItem('admin_complejo_nombre', c.nombre);
            mostrarComplejoActual();
        }
    } catch (e) {
        console.warn('No se pudo resolver el nombre del complejo:', e);
    }
}

/// Oculta del menú lateral las opciones que solo puede ver el superadmin.
/// Se llama desde el DOMContentLoaded en cada página.
function ocultarMenuSuperadmin() {
    if (!esAdminDeComplejo()) return;

    const menuComplejos = document.getElementById('menuComplejos');
    if (menuComplejos) menuComplejos.style.display = 'none';

}

/// Añade `?complejo_id=X` (o `&`) a las rutas del dashboard para que el
/// backend filtre. Si no hay complejo elegido, devuelve la ruta tal cual.
function conComplejo(ruta) {
    const id = localStorage.getItem('admin_complejo_id');
    if (!id) return ruta;
    const sep = ruta.includes('?') ? '&' : '?';
    return `${ruta}${sep}complejo_id=${id}`;
}

// ---------------------------------------------------------------------------
// Estados de una reserva
// ---------------------------------------------------------------------------

const ESTADOS = {
    pendiente:  { etiqueta: 'Pendiente',  badge: 'bg-warning text-dark' },
    confirmada: { etiqueta: 'Confirmada', badge: 'bg-success' },
    rechazada:  { etiqueta: 'Rechazada',  badge: 'bg-danger' },
    completada: { etiqueta: 'Completada', badge: 'bg-primary' },
    cancelada:  { etiqueta: 'Cancelada',  badge: 'bg-secondary' }
};

function estiloEstado(estado) {
    return ESTADOS[String(estado || 'pendiente').toLowerCase()]
        || { etiqueta: estado, badge: 'bg-secondary' };
}

function hhmm(hora) {
    const partes = String(hora || '').split(':');
    if (partes.length < 2) return hora || '--:--';
    return `${partes[0].padStart(2, '0')}:${partes[1].padStart(2, '0')}`;
}

function nombreCancha(r) {
    if (r.cancha && r.cancha.nombre) return r.cancha.nombre;
    if (r.cancha_nombre) return r.cancha_nombre;
    return `Cancha #${r.cancha_id ?? '?'}`;
}

function datosUsuario(r) {
    if (r.usuario && (r.usuario.nombre || r.usuario.email)) {
        return { nombre: r.usuario.nombre || '—', email: r.usuario.email || '' };
    }
    return { nombre: r.usuario_nombre || '—', email: r.usuario_email || '' };
}

function urlAbsoluta(ruta) {
    if (!ruta) return null;
    if (ruta.startsWith('http://') || ruta.startsWith('https://')) return ruta;

    if (!ruta.startsWith('/')) {
        ruta = '/static/canchas/' + ruta;
    }

    const base = API_URL.replace(/\/api\/?$/, '');
    return `${base}${ruta}`;
}

// ---------------------------------------------------------------------------
// Dashboard (index.html)
// ---------------------------------------------------------------------------

async function cargarKpis() {
    if (!document.getElementById('statReservasHoy')) return;

    try {
        const res = await apiFetch(conComplejo('/dashboard/kpis'));
        if (!res.ok) return;

        const k = await res.json();
        const poner = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.innerText = valor;
        };

        poner('statReservasHoy', k.reservas_hoy ?? 0);
        poner('statIngresosMes', `Q${Number(k.ingresos_mes ?? 0).toFixed(2)}`);
        poner('statCanchasActivas', k.total_canchas ?? 0);
        poner('statPendientes', k.reservas_pendientes ?? 0);
    } catch (error) {
        console.error('Error al cargar los KPIs:', error);
    }
}

async function cargarReservasRecientes() {
    const tbody = document.getElementById('tablaReservasRecientes');
    if (!tbody) return;

    try {
        const res = await apiFetch(conComplejo('/dashboard/reservas-recientes?limit=5'));
        if (!res.ok) return;

        const reservas = await res.json();
        tbody.innerHTML = '';

        if (!Array.isArray(reservas) || reservas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Todavía no hay reservas</td></tr>`;
            return;
        }

        reservas.forEach(r => {
            const est = estiloEstado(r.estado);
            tbody.innerHTML += `
                <tr>
                    <td>#${r.id}</td>
                    <td>${escapar(nombreCancha(r))}</td>
                    <td>${escapar(r.fecha_reserva || '')}</td>
                    <td>${hhmm(r.hora_inicio)} - ${hhmm(r.hora_fin)}</td>
                    <td><span class="badge ${est.badge}">${est.etiqueta}</span></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error al cargar reservas recientes:', error);
    }
}

// ---------------------------------------------------------------------------
// Canchas
// ---------------------------------------------------------------------------

let canchasCache = [];

async function cargarCanchas() {
    const tbody = document.getElementById('tablaCanchas');
    if (!tbody) return;

    try {
        const complejoId = localStorage.getItem('admin_complejo_id');
        let ruta = '/canchas/?incluir_inactivas=true';
        if (complejoId) ruta += `&complejo_id=${complejoId}`;

        const res = await apiFetch(ruta);
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">${await mensajeError(res, 'No se pudieron cargar las canchas')}</td></tr>`;
            return;
        }

        const data = await res.json();
        canchasCache = Array.isArray(data) ? data : [];
        tbody.innerHTML = '';

        if (canchasCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">No hay canchas registradas</td></tr>`;
            return;
        }

        canchasCache.forEach(cancha => {
            const estaActiva = cancha.activa == 1 || cancha.activa === true;
            const fotoUrl = cancha.imagen_url ? urlAbsoluta(cancha.imagen_url) : null;

            tbody.innerHTML += `
                <tr>
                    <td>#${cancha.id}</td>
                    <td>
                        <img src="${fotoUrl || 'https://via.placeholder.com/56x56?text=Sin+foto'}"
                             class="rounded" style="width:56px;height:56px;object-fit:cover;cursor:pointer;"
                             title="Clic para cambiar la foto"
                             onclick="document.getElementById('inputImagen-${cancha.id}').click()">
                        <input type="file" id="inputImagen-${cancha.id}" accept="image/*" class="d-none"
                               onchange="subirImagenCancha(${cancha.id}, this)">
                    </td>
                    <td class="fw-bold">${escapar(cancha.nombre)}</td>
                    <td>
                        <small class="text-muted">${cancha.descripcion ? escapar(cancha.descripcion) : '<em>Sin descripción</em>'}</small>
                    </td>
                    <td><span class="badge bg-secondary">${escapar(cancha.tipo_superficie || cancha.tipo_deporte || 'Sintética')}</span></td>
                    <td>
                        <div class="input-group input-group-sm" style="width: 150px;">
                            <span class="input-group-text">Q</span>
                            <input type="number" step="0.01" min="0" class="form-control"
                                   value="${cancha.precio_hora ?? 0}" id="precio-${cancha.id}">
                            <button class="btn btn-outline-success" title="Guardar precio"
                                    onclick="actualizarPrecio(${cancha.id})">
                                <i class="fa-solid fa-floppy-disk"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <span class="badge ${estaActiva ? 'bg-success' : 'bg-danger'}">
                            ${estaActiva ? 'Disponible' : 'Mantenimiento'}
                        </span>
                    </td>
                    <td class="text-center text-nowrap">
                        <button class="btn btn-sm btn-outline-primary me-1" title="Editar nombre, capacidad y descripción"
                                onclick="abrirModalEditarCancha(${cancha.id})">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-sm ${estaActiva ? 'btn-outline-danger' : 'btn-outline-success'}"
                                onclick="cambiarEstado(${cancha.id}, ${estaActiva ? 0 : 1})">
                            <i class="fa-solid fa-power-off"></i>
                            ${estaActiva ? 'Mantenimiento' : 'Reactivar'}
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error al cargar canchas:', error);
    }
}

/// Llena el <select id="complejoCancha"> del modal de Nueva Cancha.
async function cargarSelectComplejos() {
    const select = document.getElementById('complejoCancha');
    if (!select) return;

    try {
        const res = await apiFetch('/complejos');
        if (!res.ok) return;

        const complejos = await res.json();

        // Si el usuario tiene complejo fijo, solo mostramos ese.
        const fijo = esAdminDeComplejo();
        const idFijo = localStorage.getItem('admin_complejo_id');

        const lista = fijo && idFijo
            ? complejos.filter(c => String(c.id) === String(idFijo))
            : complejos;

        select.innerHTML = '<option value="">Elige un complejo…</option>';
        lista.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${escapar(c.nombre)}</option>`;
        });

        const actual = localStorage.getItem('admin_complejo_id');
        if (actual) select.value = actual;

        if (fijo) select.disabled = true;
    } catch (e) {
        console.error('Error al cargar el select de complejos:', e);
    }
}

async function guardarCancha(e) {
    e.preventDefault();

    // -------------------------------------------------------------------
    // Determinar el complejo:
    //   - Si el usuario tiene complejo fijo → se usa ese (no se le pide).
    //   - Si es superadmin → se lee del select del modal.
    // -------------------------------------------------------------------
    let complejoId;
    if (esAdminDeComplejo()) {
        complejoId = parseInt(localStorage.getItem('admin_complejo_id'), 10);
    } else {
        const complejoSelect = document.getElementById('complejoCancha');
        complejoId = parseInt(complejoSelect?.value, 10);
    }

    if (!Number.isInteger(complejoId)) {
        return notificar('Elige un complejo.', 'warning');
    }

    const nombre = document.getElementById('nombreCancha').value.trim();
    const precio = parseFloat(document.getElementById('precioCancha').value);
    const tipoSelect = document.getElementById('tipoCancha');

    if (!nombre) return notificar('Escribe el nombre de la cancha.', 'warning');
    if (!Number.isFinite(precio) || precio <= 0) {
        return notificar('El precio por hora debe ser mayor que cero.', 'warning');
    }

    const tipoTexto = tipoSelect ? tipoSelect.value : 'Sintética 5vs5';
    const esSintetica = tipoTexto.toLowerCase().includes('sint');

    const payload = {
        complejo_id: complejoId,
        nombre: nombre,
        tipo_deporte: tipoTexto.includes('7') ? 'futbol7' : 'futbol5',
        tipo_superficie: esSintetica ? 'sintetica' : 'grama',
        capacidad_jugadores: tipoTexto.includes('7') ? 14 : 10,
        tiene_techo: tipoTexto.toLowerCase().includes('techada') ? 1 : 0,
        tiene_iluminacion: 1,
        descripcion: document.getElementById('descripcionCancha')?.value.trim() || null,
        precio_hora: precio,
        precio_hora_pico: precio + 30.00,
        activa: 1
    };

    try {
        const res = await apiFetch('/canchas/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            notificar(await mensajeError(res, 'No se pudo crear la cancha'), 'danger');
            return;
        }

        cerrarModal('modalNuevaCancha');
        document.getElementById('formNuevaCancha').reset();
        notificar(`Cancha "${escapar(nombre)}" creada.`);
        cargarCanchas();
        cargarKpis();
    } catch (error) {
        console.error('Error de red:', error);
        notificar('No se pudo conectar con el servidor.', 'danger');
    }
}

async function actualizarPrecio(id) {
    const inputPrecio = document.getElementById(`precio-${id}`);
    if (!inputPrecio) return;

    const nuevoPrecio = parseFloat(inputPrecio.value);
    if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
        return notificar('El precio debe ser un número mayor que cero.', 'warning');
    }

    try {
        const res = await apiFetch(`/canchas/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ precio_hora: nuevoPrecio })
        });

        if (!res.ok) {
            notificar(await mensajeError(res, 'No se pudo actualizar el precio'), 'danger');
            return;
        }

        notificar(`Precio de la cancha #${id} actualizado a Q${nuevoPrecio.toFixed(2)}.`);
        cargarCanchas();
    } catch (error) {
        console.error('Error al actualizar precio:', error);
    }
}

async function cambiarEstado(id, nuevoEstado) {
    // Convertimos 0/1 a booleano real. Pydantic 2 rechaza enteros
    // cuando el campo está tipado estrictamente como bool.
    const activa = Boolean(nuevoEstado);

    try {
        const res = await apiFetch(`/canchas/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ activa })
        });

        if (!res.ok) {
            notificar(await mensajeError(res, 'No se pudo cambiar el estado'), 'danger');
            return;
        }

        notificar(activa
            ? `Cancha #${id} reactivada.`
            : `Cancha #${id} puesta en mantenimiento.`);
        cargarCanchas();
        cargarKpis();
    } catch (error) {
        console.error('Error al cambiar estado:', error);
    }
}

async function subirImagenCancha(id, input) {
    const archivo = input.files[0];
    if (!archivo) return;

    const formData = new FormData();
    formData.append('archivo', archivo);

    try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch(`${API_URL}/canchas/${id}/imagen`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.status === 401) {
            cerrarSesion();
            return;
        }
        if (!res.ok) {
            notificar(await mensajeError(res, 'No se pudo subir la imagen'), 'danger');
            return;
        }

        notificar(`Foto de la cancha #${id} actualizada.`);
        cargarCanchas();
    } catch (error) {
        console.error('Error al subir imagen:', error);
        notificar('No se pudo conectar con el servidor.', 'danger');
    } finally {
        input.value = '';
    }
}

function abrirModalEditarCancha(id) {
    const cancha = canchasCache.find(c => c.id === id);
    if (!cancha) return;

    document.getElementById('editarCanchaId').value = cancha.id;
    document.getElementById('editarNombreCancha').value = cancha.nombre || '';
    document.getElementById('editarCapacidadCancha').value = cancha.capacidad_jugadores ?? '';
    document.getElementById('editarDescripcionCancha').value = cancha.descripcion || '';

    const modalElement = document.getElementById('modalEditarCancha');
    if (modalElement) bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

async function guardarEdicionCancha(e) {
    e.preventDefault();

    const id = document.getElementById('editarCanchaId').value;
    const nombre = document.getElementById('editarNombreCancha').value.trim();
    const capacidadValor = document.getElementById('editarCapacidadCancha').value;
    const descripcion = document.getElementById('editarDescripcionCancha').value.trim();

    if (!nombre) return notificar('El nombre no puede quedar vacío.', 'warning');

    const payload = { nombre, descripcion: descripcion || null };
    if (capacidadValor !== '') payload.capacidad_jugadores = parseInt(capacidadValor, 10);

    try {
        const res = await apiFetch(`/canchas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            notificar(await mensajeError(res, 'No se pudo actualizar la cancha'), 'danger');
            return;
        }

        cerrarModal('modalEditarCancha');
        notificar(`Cancha #${id} actualizada.`);
        cargarCanchas();
    } catch (error) {
        console.error('Error de red:', error);
        notificar('No se pudo conectar con el servidor.', 'danger');
    }
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

let filtroEstado = 'todas';

async function cargarMisReservas() {
    const tbody = document.getElementById('tablaMisReservas');
    if (!tbody) return;

    try {
        const res = await apiFetch(conComplejo('/reservas/'));
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">${await mensajeError(res, 'No se pudieron cargar las reservas')}</td></tr>`;
            return;
        }

        const reservas = await res.json();
        renderizarTablaReservas(Array.isArray(reservas) ? reservas : []);
    } catch (error) {
        console.error('Error al cargar reservas:', error);
    }
}

function aplicarFiltro(estado) {
    filtroEstado = estado;
    document.querySelectorAll('[data-filtro]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filtro === estado);
    });
    cargarMisReservas();
}

function renderizarTablaReservas(reservas) {
    const tbody = document.getElementById('tablaMisReservas');
    if (!tbody) return;

    const visibles = filtroEstado === 'todas'
        ? reservas
        : reservas.filter(r => String(r.estado || '').toLowerCase() === filtroEstado);

    const contador = document.getElementById('contadorReservas');
    if (contador) contador.innerText = `${visibles.length} de ${reservas.length}`;

    tbody.innerHTML = '';

    if (visibles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">No hay reservas que coincidan</td></tr>`;
        return;
    }

    visibles.forEach(r => {
        const est = estiloEstado(r.estado);
        const total = Number(r.precio_total ?? 0).toFixed(2);
        const comprobante = urlAbsoluta(r.comprobante_url);
        const usuario = datosUsuario(r);
        const esPendiente = String(r.estado || '').toLowerCase() === 'pendiente';
        const metodo = r.metodo_pago ? escapar(r.metodo_pago) : '—';

        tbody.innerHTML += `
            <tr>
                <td>#${r.id}</td>
                <td>
                    <div class="fw-semibold">${escapar(usuario.nombre)}</div>
                    <small class="text-muted">${escapar(usuario.email)}</small>
                </td>
                <td>
                    <div>${escapar(nombreCancha(r))}</div>
                    <small class="text-muted">${escapar(r.fecha_reserva || '')} · ${hhmm(r.hora_inicio)}-${hhmm(r.hora_fin)}</small>
                </td>
                <td>Q${total}</td>
                <td><small class="text-capitalize">${metodo}</small></td>
                <td>
                    <span class="badge ${est.badge}">${est.etiqueta}</span>
                    ${r.motivo_cancelacion ? `<div><small class="text-muted">${escapar(r.motivo_cancelacion)}</small></div>` : ''}
                </td>
                <td>
                    ${comprobante ? `
                        <button class="btn btn-sm btn-outline-info" onclick="verComprobante('${comprobante}')">
                            <i class="fa-solid fa-image"></i> Ver
                        </button>
                    ` : '<span class="text-muted small">Sin comprobante</span>'}
                </td>
                <td class="text-nowrap">
                    ${esPendiente ? `
                        <button class="btn btn-sm btn-success me-1" title="Aprobar el depósito"
                                onclick="cambiarEstadoReserva(${r.id}, 'confirmada')">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" title="Rechazar el depósito"
                                onclick="cambiarEstadoReserva(${r.id}, 'rechazada')">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    ` : '<i class="fa-solid fa-lock text-muted" title="Ya resuelta"></i>'}
                </td>
            </tr>
        `;
    });
}

function verComprobante(url) {
    const img = document.getElementById('imgComprobanteModal');
    const enlace = document.getElementById('enlaceComprobante');
    const esPdf = url.toLowerCase().endsWith('.pdf');

    if (img) {
        img.style.display = esPdf ? 'none' : 'block';
        if (!esPdf) img.src = url;
    }
    if (enlace) enlace.href = url;

    const aviso = document.getElementById('avisoPdfComprobante');
    if (aviso) aviso.style.display = esPdf ? 'block' : 'none';

    const modalElement = document.getElementById('modalVerComprobante');
    if (modalElement) bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

async function cambiarEstadoReserva(id, nuevoEstado) {
    let motivo = null;
    if (nuevoEstado === 'rechazada') {
        motivo = prompt('¿Por qué se rechaza el comprobante?', 'El comprobante no es legible');
        if (motivo === null) return;
    }

    try {
        const res = await apiFetch(`/reservas/${id}/estado`, {
            method: 'PUT',
            body: JSON.stringify({
                estado: nuevoEstado,
                ...(motivo ? { motivo } : {})
            })
        });

        if (!res.ok) {
            notificar(await mensajeError(res, 'No se pudo actualizar el estado'), 'danger');
            return;
        }

        notificar(nuevoEstado === 'confirmada'
            ? `Reserva #${id} confirmada.`
            : `Reserva #${id} rechazada.`);
        cargarMisReservas();
        cargarKpis();
    } catch (error) {
        console.error('Error de red:', error);
    }
}

async function cargarSelectCanchas() {
    const select = document.getElementById('reservaCanchaId');
    if (!select || select.tagName !== 'SELECT') return;

    try {
        const complejoId = localStorage.getItem('admin_complejo_id');
        let ruta = '/canchas/';
        if (complejoId) ruta += `?complejo_id=${complejoId}`;

        const res = await apiFetch(ruta);
        if (!res.ok) return;

        const canchas = await res.json();
        select.innerHTML = '<option value="">Elige una cancha…</option>';
        canchas.forEach(c => {
            select.innerHTML += `<option value="${c.id}" data-precio="${c.precio_hora ?? 0}">${escapar(c.nombre)} — Q${Number(c.precio_hora ?? 0).toFixed(2)}/hr</option>`;
        });
    } catch (error) {
        console.error('Error al cargar el select de canchas:', error);
    }
}

async function guardarReserva(e) {
    e.preventDefault();

    const canchaId = parseInt(document.getElementById('reservaCanchaId').value, 10);
    const fecha = document.getElementById('reservaFecha').value;
    const horaInicio = document.getElementById('reservaHoraInicio').value;
    const horaFin = document.getElementById('reservaHoraFin').value;
    const metodoSelect = document.getElementById('reservaMetodoPago');

    if (!Number.isInteger(canchaId)) return notificar('Elige una cancha.', 'warning');
    if (!fecha) return notificar('Elige la fecha.', 'warning');
    if (!horaInicio || !horaFin) return notificar('Indica la hora de inicio y de fin.', 'warning');
    if (horaFin <= horaInicio) {
        return notificar('La hora de fin debe ser posterior a la de inicio.', 'warning');
    }

    const payload = {
        cancha_id: canchaId,
        fecha_reserva: fecha,
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
        notas: 'Registrada desde el panel de administración',
        metodo_pago: metodoSelect ? metodoSelect.value : 'efectivo'
    };

    try {
        const res = await apiFetch('/reservas/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            notificar(await mensajeError(res, 'No se pudo crear la reserva'), 'danger');
            return;
        }

        const creada = await res.json();
        cerrarModal('modalNuevaReserva');
        document.getElementById('formNuevaReserva').reset();
        notificar(`Reserva #${creada.id} creada por Q${Number(creada.precio_total).toFixed(2)} (${estiloEstado(creada.estado).etiqueta}).`);
        cargarMisReservas();
        cargarKpis();
    } catch (error) {
        console.error('Error de red:', error);
        notificar('No se pudo conectar con el servidor.', 'danger');
    }
}

function cerrarModal(id) {
    const el = document.getElementById(id);
    if (el) bootstrap.Modal.getOrCreateInstance(el).hide();
}

// ---------------------------------------------------------------------------
// Recaudo y clientes (index.html)
// ---------------------------------------------------------------------------

function poblarFiltroRecaudo() {
    const selectMes = document.getElementById('filtroMesRecaudo');
    const selectAnio = document.getElementById('filtroAnioRecaudo');
    if (!selectMes || !selectAnio) return;

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const hoy = new Date();

    selectMes.innerHTML = `<option value="todos">Todos los meses</option>` + meses.map((m, i) =>
        `<option value="${i + 1}" ${i + 1 === hoy.getMonth() + 1 ? 'selected' : ''}>${m}</option>`
    ).join('');

    const anioActual = hoy.getFullYear();
    let opcionesAnio = '';
    for (let a = anioActual; a >= anioActual - 3; a--) {
        opcionesAnio += `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`;
    }
    selectAnio.innerHTML = opcionesAnio;

    const actualizarFiltro = () => {
        selectAnio.disabled = selectMes.value === 'todos';
        cargarRecaudoMes();
        cargarClientes(selectMes.value, selectAnio.value);
    };

    selectMes.addEventListener('change', actualizarFiltro);
    selectAnio.addEventListener('change', actualizarFiltro);
}

async function cargarRecaudoMes() {
    const selectMes = document.getElementById('filtroMesRecaudo');
    const selectAnio = document.getElementById('filtroAnioRecaudo');
    const zona = document.getElementById('recaudoMes');
    if (!selectMes || !selectAnio || !zona) return;

    try {
        if (selectMes.value === 'todos') {
            const res = await apiFetch(conComplejo('/dashboard/recaudo-total'));
            if (!res.ok) return;
            const data = await res.json();
            zona.innerText = `Q${Number(data.total ?? 0).toFixed(2)}`;
            return;
        }

        const res = await apiFetch(conComplejo(`/dashboard/recaudo?mes=${selectMes.value}&anio=${selectAnio.value}`));
        if (!res.ok) return;
        const data = await res.json();
        zona.innerText = `Q${Number(data.total ?? 0).toFixed(2)}`;
    } catch (error) {
        console.error('Error al cargar el recaudo del mes:', error);
    }
}

async function cargarRecaudoTotal() {
    const zona = document.getElementById('recaudoTotal');
    if (!zona) return;

    try {
        const res = await apiFetch(conComplejo('/dashboard/recaudo-total'));
        if (!res.ok) return;
        const data = await res.json();
        zona.innerText = `Q${Number(data.total ?? 0).toFixed(2)}`;
    } catch (error) {
        console.error('Error al cargar el recaudo total:', error);
    }
}

async function cargarClientes(mes = null, anio = null) {
    const tbody = document.getElementById('tablaClientes');
    if (!tbody) return;

    const query = (mes && mes !== 'todos' && anio) ? `?mes=${mes}&anio=${anio}` : '';

    try {
        const res = await apiFetch(conComplejo(`/dashboard/clientes${query}`));
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">${await mensajeError(res, 'No se pudieron cargar los clientes')}</td></tr>`;
            return;
        }

        const clientes = await res.json();
        tbody.innerHTML = '';

        if (!Array.isArray(clientes) || clientes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Sin reservas en el período seleccionado</td></tr>`;
            return;
        }

        clientes.forEach(c => {
            tbody.innerHTML += `
                <tr>
                    <td class="fw-semibold">${escapar(c.nombre)}</td>
                    <td><small class="text-muted">${escapar(c.email)}</small></td>
                    <td class="text-center"><span class="badge bg-secondary">${c.total_reservas}</span></td>
                    <td class="text-end fw-semibold">Q${Number(c.total_gastado ?? 0).toFixed(2)}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error al cargar clientes:', error);
    }
}

function abrirModalReserva(canchaId) {
    const select = document.getElementById('reservaCanchaId');
    if (select && canchaId) select.value = String(canchaId);

    const modalElement = document.getElementById('modalNuevaReserva');
    if (modalElement) bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // El login no necesita token ni complejo.
    if (path.endsWith('login.html')) return;

    if (!localStorage.getItem('admin_token')) {
        window.location.href = 'login.html';
        return;
    }

    // 🔒 Bloquear páginas exclusivas de superadmin.
   if (esAdminDeComplejo() && path.endsWith('complejos.html')) {
    window.location.href = 'index.html';
    return;
}

    // Si tiene complejo FIJO y entra al selector → devolverlo al dashboard.
    if (esAdminDeComplejo() && path.endsWith('seleccionar_complejo.html')) {
        window.location.href = 'index.html';
        return;
    }

    // Si no tiene complejo (ni fijo ni elegido) → forzar selección.
    if (!path.endsWith('seleccionar_complejo.html')
        && !localStorage.getItem('admin_complejo_id')) {
        window.location.href = 'seleccionar_complejo.html';
        return;
    }

    configurarFondoCover();
    mostrarUsuarioSesion();
    mostrarComplejoActual();
    resolverNombreComplejo();
    ocultarMenuSuperadmin();

    if (esAdminDeComplejo()) {
        const btn = document.getElementById('btnCambiarComplejo');
        if (btn) btn.style.display = 'none';
    }

    cargarKpis();
    cargarReservasRecientes();
    if (document.getElementById('tablaCanchas')) cargarCanchas();
    if (document.getElementById('tablaMisReservas')) cargarMisReservas();

    cargarSelectCanchas();
    cargarSelectComplejos();

    if (document.getElementById('filtroMesRecaudo')) {
        poblarFiltroRecaudo();
        cargarRecaudoMes();
        cargarRecaudoTotal();
    }

    if (document.getElementById('tablaClientes') && document.getElementById('filtroMesRecaudo')) {
        const selectMes = document.getElementById('filtroMesRecaudo');
        const selectAnio = document.getElementById('filtroAnioRecaudo');
        cargarClientes(selectMes.value, selectAnio.value);
    }

    const formEditarCancha = document.getElementById('formEditarCancha');
    if (formEditarCancha) formEditarCancha.addEventListener('submit', guardarEdicionCancha);

    const formNuevaCancha = document.getElementById('formNuevaCancha');
    if (formNuevaCancha) formNuevaCancha.addEventListener('submit', guardarCancha);

    const formReserva = document.getElementById('formNuevaReserva');
    if (formReserva) formReserva.addEventListener('submit', guardarReserva);

    document.querySelectorAll('[data-filtro]').forEach(btn => {
        btn.addEventListener('click', () => aplicarFiltro(btn.dataset.filtro));
    });
});