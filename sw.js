/* GENERADO en parte — la lista de precarga la escribe `scripts/build-sw.mjs`.
 *
 * El service worker de FestRoute (§15, FR-04 · ADR 0014).
 *
 * **En un recinto con veinte mil personas no hay cobertura**, y para este
 * público eso no es un caso raro: es el momento de mayor uso. Lo que el §15.1
 * exige que siga funcionando es concreto y no es «el sitio entero»: lo que la
 * persona ha guardado.
 *
 * Dos estrategias y ninguna más, porque no hay servidor detrás:
 *
 *   · **Los activos con hash en el nombre** (`/_next/static/…`, tipografías,
 *     iconos) son inmutables por definición: si el contenido cambia, cambia el
 *     nombre. Se sirven de la caché sin preguntar, y si no están se piden una
 *     vez y se quedan.
 *   · **El HTML** se sirve de la caché y se refresca por detrás. Así la página
 *     abre instantánea con cobertura o sin ella, y la siguiente visita ya trae
 *     lo nuevo. Lo contrario —pedir siempre y caer a la caché— hace esperar al
 *     tiempo de espera de la red justo cuando no hay red.
 *
 * **Las fichas guardadas se guardan de verdad al guardarlas.** No basta con
 * cachear lo visitado: alguien marca diez festivales desde el índice, llega al
 * recinto y no ha abierto ninguna ficha. La página avisa por `postMessage` y
 * aquí se descargan sus tres pantallas y su cartel.
 */

/* eslint-env serviceworker */

/** Lo escribe `scripts/build-sw.mjs` tras la construcción. */
const PRECARGA = ["/festroute-site/","/festroute-site/mi-ruta/","/festroute-site/buscar/","/festroute-site/cuenta/","/festroute-site/_next/static/chunks/08ttfj81-47mu.js","/festroute-site/_next/static/chunks/0cz1d0mv5g_q7.js","/festroute-site/_next/static/chunks/0js77un3_xoch.js","/festroute-site/_next/static/chunks/0lkuu9su4eymc.js","/festroute-site/_next/static/chunks/0n637t1h45flj.js","/festroute-site/_next/static/chunks/0v18ogw_b1_ue.css","/festroute-site/_next/static/chunks/0yqead_swgvn6.js","/festroute-site/_next/static/chunks/19mx3mg6lkumu.js","/festroute-site/_next/static/chunks/1pmgpz46_vo6l.js","/festroute-site/_next/static/chunks/310vm2bl3xxpt.js","/festroute-site/_next/static/chunks/3lidke9dj8211.js","/festroute-site/_next/static/chunks/3vt_u_rk8874n.js","/festroute-site/_next/static/chunks/3zmwp3hiydat0.js","/festroute-site/_next/static/chunks/41dp0iq7f55gn.js","/festroute-site/_next/static/chunks/turbopack-0g8nmkjqs58t0.js","/festroute-site/fonts/geist-1.woff2","/festroute-site/fonts/geist-mono-1.woff2","/festroute-site/fonts/grenze-gotisch-variable-1.woff2","/festroute-site/fonts/grenze-gotisch-variable-2.woff2","/festroute-site/fonts/pirata-one-1.woff2","/festroute-site/fonts/pirata-one-2.woff2"];
const VERSION = "0.58.0";

const CACHE = `festroute-${VERSION}`;

/** Un activo cuyo nombre lleva su huella: cambia de nombre al cambiar. */
const inmutable = (url) => url.pathname.includes('/_next/static/') || /\.(woff2|svg|png|jpg|webp)$/.test(url.pathname);

self.addEventListener('install', (evento) => {
  // `skipWaiting` para que una versión nueva mande desde el primer momento: la
  // alternativa —esperar a que se cierren todas las pestañas— deja a alguien
  // con la web de hace tres despliegues y sin saberlo.
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECARGA))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

async function deLaCacheYRefresca(peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion);
  const red = fetch(peticion)
    .then((respuesta) => {
      if (respuesta.ok) void cache.put(peticion, respuesta.clone());
      return respuesta;
    })
    // Sin cobertura no es un error: es el caso para el que existe esto.
    .catch(() => guardada);
  return guardada ?? (await red);
}

async function primeroLaCache(peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (respuesta.ok) void cache.put(peticion, respuesta.clone());
  return respuesta;
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  // **Solo lo nuestro.** Un cartel vive en la web del festival y una llamada de
  // cuentas va a Supabase: cachear eso sería guardar copias de cosas ajenas y,
  // en el segundo caso, servir una respuesta de sesión vieja.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(inmutable(url) ? primeroLaCache(peticion) : deLaCacheYRefresca(peticion));
});

/**
 * «Guarda este festival para el recinto.»
 *
 * Llega de `lib/offline.ts` cuando alguien guarda una ficha. Se piden sus tres
 * pantallas —ficha, cartel y recinto— para que estén cuando no haya red. Si
 * alguna falla no se aborta el resto: media ficha guardada vale más que ninguna.
 */
self.addEventListener('message', (evento) => {
  const datos = evento.data;
  if (datos?.tipo !== 'guardar-festival' || typeof datos.rutas !== 'object') return;
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        datos.rutas.map((ruta) =>
          fetch(ruta)
            .then((r) => (r.ok ? cache.put(ruta, r) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});
