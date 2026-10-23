// Única definición de la dirección del backend.
//
// Si abres el panel desde la misma PC donde corre la API, déjalo así.
// Si lo abres desde otra máquina de la red, cambia 127.0.0.1 por la IP de la
// PC donde corre uvicorn (la misma que usa la app Flutter: 192.168.1.7).
const API_HOST = 'http://127.0.0.1:8000';

// Endpoints de la API.
const API_URL = `${API_HOST}/api`;

// Convierte una ruta relativa que devuelve el backend ("/static/comprobantes/x.jpg")
// en una URL absoluta que el navegador pueda cargar. Sin esto, las imágenes de
// los comprobantes nunca se ven, porque el panel se abre desde otro origen.
function urlAbsoluta(ruta) {
    if (!ruta) return null;
    if (ruta.startsWith('http://') || ruta.startsWith('https://')) return ruta;
    return `${API_HOST}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
}
