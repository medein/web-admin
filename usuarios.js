// ---------------------------------------------------------------------------
// Módulo de Gestión de Usuarios y Administradores
// ---------------------------------------------------------------------------

let modalUsuario = null;
let usuarioEdicionId = null; // null = Creación | número = Edición
let complejosCache = [];

// --- Helper para obtener el JWT guardado en el navegador ---
function obtenerToken() {
    return localStorage.getItem("admin_token") || 
           localStorage.getItem("token") || 
           localStorage.getItem("access_token");
}

// --- 1. Cargar lista de complejos para el select ---
async function cargarComplejosParaUsuarios() {
    const token = obtenerToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/complejos`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            complejosCache = await res.json();
            poblarSelectComplejos();
        } else {
            console.warn("No se pudieron cargar los complejos");
        }
    } catch (err) {
        console.error("Error al obtener complejos:", err);
    }
}

// Configurar opciones del select de Roles según los permisos del usuario logueado
function configurarOpcionesRol() {
    const selectRol = document.getElementById("usuario-rol");
    if (!selectRol) return;

    const rolSesion = (localStorage.getItem("admin_rol") || "").toLowerCase();
    const esSuperadmin = rolSesion === "superadmin";

    // Si NO es superadmin (ej. admin o admin_complejo), solo puede crear clientes
    if (!esSuperadmin) {
        selectRol.innerHTML = `<option value="cliente" selected>Cliente</option>`;
        selectRol.disabled = true; // Bloqueado fijamente en Cliente
    } else {
        selectRol.disabled = false;
        selectRol.innerHTML = `
            <option value="cliente">Cliente</option>
            <option value="admin_complejo">Admin de complejo</option>
            <option value="admin">Administrador General</option>
            <option value="dueño_cancha">Dueño de cancha</option>
        `;
    }
}

// Llenar el combo <select id="usuario-complejo">
function poblarSelectComplejos(selectedId = null) {
    const select = document.getElementById("usuario-complejo");
    if (!select) return;

    if (!complejosCache || complejosCache.length === 0) {
        select.innerHTML = `<option value="">No hay complejos disponibles</option>`;
        return;
    }

    let html = `<option value="">Selecciona un complejo...</option>`;
    complejosCache.forEach(c => {
        const selected = selectedId && Number(selectedId) === Number(c.id) ? "selected" : "";
        html += `<option value="${c.id}" ${selected}>${c.nombre}</option>`;
    });

    select.innerHTML = html;
}

// --- Controlar visibilidad del campo complejo según el rol seleccionado ---
function cambioRolUsuario() {
    const selectRol = document.getElementById("usuario-rol");
    const campoComplejo = document.getElementById("campo-complejo-usuario") || document.getElementById("usuario-complejo")?.parentElement;
    
    if (!selectRol || !campoComplejo) return;

    const rol = selectRol.value;
    // Mostrar selector de complejo solo si es admin_complejo o dueño_cancha
    if (rol === "admin_complejo" || rol === "dueño_cancha") {
        campoComplejo.style.display = "block";
    } else {
        campoComplejo.style.display = "none";
    }
}

// --- 2. Cargar lista de usuarios desde la API ---
async function cargarUsuarios() {
    const token = obtenerToken();

    if (!token) {
        alert("No se encontró sesión activa. Por favor vuelve a ingresar.");
        window.location.href = "login.html";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/users/`, {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (res.status === 401) {
            alert("Tu token de sesión ha expirado. Por favor, vuelve a iniciar sesión.");
            window.location.href = "login.html";
            return;
        }

        if (res.status === 403) {
            const errData = await res.json().catch(() => ({ detail: "Sin permisos" }));
            alert(`Acceso denegado (403): ${errData.detail}`);
            return;
        }

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: "Error desconocido" }));
            throw new Error(errData.detail || `Error HTTP ${res.status}`);
        }

        let usuarios = await res.json();

        // 🔒 Si NO es superadmin, ocultar todo excepto clientes
        const rolSesion = (localStorage.getItem("admin_rol") || "").toLowerCase();
        const esSuperadmin = rolSesion === "superadmin";

        if (!esSuperadmin) {
            usuarios = usuarios.filter(user => {
                const rol = (user.rol || "").toLowerCase();
                return rol !== "admin" 
                    && rol !== "admin_complejo" 
                    && rol !== "superadmin" 
                    && rol !== "dueño_cancha";
            });
        }
        // -------------------------------------------------------------------

        const contador = document.getElementById("contadorUsuarios");
        if (contador) {
            contador.innerText = `${usuarios.length} usuarios registrados`;
        }

        renderizarUsuarios(usuarios);

    } catch (err) {
        console.error("Error al cargar usuarios:", err);
        const contenedor = document.getElementById("listaUsuarios");
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="alert alert-danger shadow-sm">
                    <i class="fa-solid fa-triangle-exclamation me-2"></i>
                    <strong>Error:</strong> ${err.message}
                </div>`;
        }
    }
}

// --- 3. Renderizar la tabla de usuarios ---
function renderizarUsuarios(usuarios) {
    const contenedor = document.getElementById("listaUsuarios");
    if (!contenedor) return;

    if (!usuarios || usuarios.length === 0) {
        contenedor.innerHTML = `<div class="alert alert-info">No hay usuarios registrados.</div>`;
        return;
    }

    // Determinar si el usuario en sesión es superadmin
    const rolSesion = (localStorage.getItem("admin_rol") || "").toLowerCase();
    const esSuperadmin = rolSesion === "superadmin";

    let html = `
        <div class="table-responsive">
            <table class="table table-hover align-middle bg-white shadow-sm rounded">
                <thead class="table-dark">
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Correo</th>
                        <th>Teléfono</th>
                        <th>Rol</th>
                        <th class="text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;

    usuarios.forEach(user => {
        let badgeColor = "bg-secondary";
        if (user.rol === "superadmin") badgeColor = "bg-danger";
        else if (user.rol === "admin" || user.rol === "admin_complejo") badgeColor = "bg-warning text-dark";
        else if (user.rol === "dueño_cancha") badgeColor = "bg-info text-dark";

        // Solo superadmin puede editar a cualquiera.
        // Admin y admin_complejo solo pueden editar a clientes.
        const mostrarBotonEditar = esSuperadmin || user.rol === 'cliente';

        html += `
            <tr>
                <td>${user.id}</td>
                <td class="fw-bold">${user.nombre || 'Sin nombre'}</td>
                <td>${user.email}</td>
                <td>${user.telefono || 'N/A'}</td>
                <td><span class="badge ${badgeColor}">${user.rol}</span></td>
                <td class="text-center">
                    ${mostrarBotonEditar 
                        ? `<button class="btn btn-sm btn-outline-primary" onclick="editarUsuario(${user.id})" title="Editar usuario">
                               <i class="fa-solid fa-pen"></i>
                           </button>`
                        : `<span class="text-muted" title="No puedes editar este rol">
                               <i class="fa-solid fa-lock"></i>
                           </span>`
                    }
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    contenedor.innerHTML = html;
}

// --- 4. Abrir modal para Crear Usuario Nuevo ---
function abrirFormularioUsuario() {
    usuarioEdicionId = null;

    const form = document.getElementById("formUsuario");
    if (form) form.reset();

    const inputPass = document.getElementById("usuario-password");
    if (inputPass) inputPass.required = true;

    const tituloModal = document.querySelector("#modalUsuario .modal-title");
    if (tituloModal) tituloModal.innerText = "Nuevo Usuario / Admin";

    // Configurar roles y llenar combos
    configurarOpcionesRol();
    poblarSelectComplejos();
    cambioRolUsuario();

    if (modalUsuario) {
        modalUsuario.show();
    } else {
        const elemModal = document.getElementById("modalUsuario");
        if (elemModal) {
            modalUsuario = new bootstrap.Modal(elemModal);
            modalUsuario.show();
        }
    }
}

// --- 5. Abrir modal para Editar Usuario Existente ---
async function editarUsuario(id) {
    const token = obtenerToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/users/`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("No se pudieron consultar los datos del usuario.");

        const usuarios = await res.json();
        const user = usuarios.find(u => u.id === id);

        if (!user) {
            alert("Usuario no encontrado.");
            return;
        }

        // --- VALIDACIÓN: solo superadmin puede editar a no-clientes ---
        const rolSesion = (localStorage.getItem("admin_rol") || "").toLowerCase();
        const esSuperadmin = rolSesion === "superadmin";

        if (!esSuperadmin && user.rol !== 'cliente') {
            alert("No tienes permisos para editar a este usuario. Solo puedes gestionar clientes.");
            return;
        }
        // ----------------------------------------------------------------

        usuarioEdicionId = id;

        // Configurar opciones de rol
        configurarOpcionesRol();

        // Cargar campos en el modal
        document.getElementById("usuario-nombre").value = user.nombre || "";
        document.getElementById("usuario-email").value = user.email || "";
        
        const inputPass = document.getElementById("usuario-password");
        if (inputPass) {
            inputPass.value = "";
            inputPass.required = false; // Opcional al editar
        }

        document.getElementById("usuario-telefono").value = user.telefono || "";
        
        const selectRol = document.getElementById("usuario-rol");
        if (selectRol && !selectRol.disabled) {
            selectRol.value = user.rol || "cliente";
        }

        // Cargar complejos y seleccionar el correspondiente
        poblarSelectComplejos(user.complejo_id);
        cambioRolUsuario();

        const tituloModal = document.querySelector("#modalUsuario .modal-title");
        if (tituloModal) tituloModal.innerText = "Editar Usuario / Admin";

        if (modalUsuario) {
            modalUsuario.show();
        } else {
            const elemModal = document.getElementById("modalUsuario");
            if (elemModal) {
                modalUsuario = new bootstrap.Modal(elemModal);
                modalUsuario.show();
            }
        }

    } catch (err) {
        alert(err.message);
    }
}

// --- 6. Manejar el evento submit del Formulario (Crear / Editar) ---
async function guardarUsuario(e) {
    e.preventDefault();

    const token = obtenerToken();
    if (!token) {
        alert("Tu sesión ha expirado. Por favor ingresa de nuevo.");
        window.location.href = "login.html";
        return;
    }

    // Determinar si el usuario en sesión es superadmin
    const rolSesion = (localStorage.getItem("admin_rol") || "").toLowerCase();
    const esSuperadmin = rolSesion === "superadmin";

    // Leer el rol seleccionado en el formulario
    let selectRol = document.getElementById("usuario-rol").value;
    const selectComplejo = document.getElementById("usuario-complejo");

    // Si no es superadmin, forzar el rol a "cliente"
    if (!esSuperadmin) {
        selectRol = "cliente";
    }

    // Asignar complejo solo si el rol lo requiere
    let complejoId = null;
    if ((selectRol === "admin_complejo" || selectRol === "dueño_cancha") && selectComplejo && selectComplejo.value) {
        complejoId = parseInt(selectComplejo.value, 10);
    }

    // Para clientes, el complejo siempre debe ser null
    if (selectRol === "cliente") {
        complejoId = null;
    }

    const payload = {
        nombre: document.getElementById("usuario-nombre").value.trim(),
        email: document.getElementById("usuario-email").value.trim(),
        password: document.getElementById("usuario-password").value || null,
        telefono: document.getElementById("usuario-telefono").value.trim() || null,
        rol: selectRol,
        complejo_id: complejoId
    };

    const url = usuarioEdicionId 
        ? `${API_URL}/users/${usuarioEdicionId}` 
        : `${API_URL}/users/`;

    const metodo = usuarioEdicionId ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 401 || res.status === 403) {
            alert("No tienes permisos suficientes o tu token ha expirado.");
            return;
        }

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Error al procesar la solicitud.");
        }

        // Ocultar modal
        if (modalUsuario) {
            modalUsuario.hide();
        } else {
            const elemModal = document.getElementById("modalUsuario");
            const instance = bootstrap.Modal.getInstance(elemModal);
            if (instance) instance.hide();
        }

        // Recargar lista y avisar al usuario
        cargarUsuarios();
        alert(usuarioEdicionId ? "Usuario actualizado correctamente" : "Usuario creado correctamente");

    } catch (err) {
        console.error("Error al guardar usuario:", err);
        alert(err.message);
    }
}

// --- 7. Inicialización del DOM ---
document.addEventListener("DOMContentLoaded", async () => {
    const elemModal = document.getElementById("modalUsuario");
    if (elemModal) {
        modalUsuario = new bootstrap.Modal(elemModal);
    }

    const form = document.getElementById("formUsuario");
    if (form) {
        form.addEventListener("submit", guardarUsuario);
    }

    const selectRol = document.getElementById("usuario-rol");
    if (selectRol) {
        selectRol.addEventListener("change", cambioRolUsuario);
    }

    await cargarComplejosParaUsuarios();
    cargarUsuarios();
});