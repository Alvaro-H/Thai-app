# Viaje — app de itinerario cifrada y sin conexión

PWA (aplicación web instalable) para llevar el itinerario de Tailandia en el
móvil: funciona sin conexión, todo se guarda cifrado en el propio dispositivo,
y cualquier persona del grupo puede editar, añadir notas y subir sus propios
documentos desde su móvil.

Este repositorio solo contiene **código**. Ningún dato del viaje vive aquí.

## Qué hay dentro

- `index.html`, `js/`, `css/` — la app.
- `seal.html` — herramienta que se usa **una sola vez**, en el PC, para cifrar
  los datos reales del viaje en un archivo `viaje.tvault`.
- `sw.js`, `manifest.webmanifest` — lo que convierte la página en una PWA
  instalable y con funcionamiento offline.
- `tools/` — scripts de desarrollo (lint de seguridad, comprobación de que no
  se han filtrado datos reales, generación de la lista de caché).
- `tests/` — pruebas unitarias (`node --test`) y end-to-end (Playwright), con
  datos ficticios.

Cero dependencias en tiempo de ejecución: todo es JavaScript/HTML/CSS nativo.

## Desplegar

1. Sube el contenido de esta carpeta a un repositorio de GitHub (puede ser
   público: no contiene ningún dato personal) y activa **GitHub Pages**
   (rama `main`, carpeta raíz).
2. En el **Chrome del ordenador**, abre
   `https://<tu-usuario>.github.io/<tu-repo>/seal.html`, elige el archivo
   `trip-bundle.json` (lo genera la extracción de datos, ver más abajo),
   escribe una frase de paso y descarga `viaje.tvault`.
3. Pasa `viaje.tvault` al móvil por el medio que prefieras (va cifrado, así
   que no importa el canal).
4. En el **Chrome del móvil**, abre la URL de GitHub Pages → menú ⋮ →
   "Instalar aplicación" / "Añadir a pantalla de inicio".
5. Abre la app → "Importar viaje" → elige `viaje.tvault` → escribe la frase
   de paso.
6. Comprueba que funciona en modo avión.
7. Desde Ajustes, exporta una copia de seguridad cifrada y guárdala en algún
   sitio fuera del móvil (otra frase de paso, puede ser distinta).

Cada persona del grupo repite los pasos 3-7 en su propio móvil, con su propia
copia de `viaje.tvault`.

## Desarrollo

```sh
npm install        # solo Playwright como dependencia de desarrollo
npm test           # lint de seguridad + pruebas unitarias + build del manifest de caché
npm run test:e2e   # pruebas end-to-end con Playwright (usa tests/fixtures, datos ficticios)
node tools/dev-server.mjs   # servidor local en http://localhost:4173
```

El hook de `git commit` (`.githooks/pre-commit`) ejecuta automáticamente el
lint de seguridad y la comprobación de fugas de datos reales
(`app/private/denylist.txt`, que vive FUERA de este repositorio).

## Seguridad (resumen, ver PLAN.md para el detalle completo)

- Cifrado AES-256-GCM con clave derivada por PBKDF2-SHA256 (600 000
  iteraciones) de la frase de paso. Sin esa frase, los datos no se pueden
  recuperar: no hay "recuperar contraseña".
- Todo el contenido del viaje vive solo en el `IndexedDB` del propio
  dispositivo, cifrado. El servidor nunca ve nada.
- Bloqueo automático al pasar a segundo plano o tras inactividad; al
  bloquear se borra de memoria la clave y el contenido descifrado.
- Content-Security-Policy estricta y Trusted Types: nada de `innerHTML`,
  nada de scripts ni estilos externos, nada de orígenes de terceros.
- `tools/check-no-secrets.mjs` compara este repositorio contra una lista de
  patrones reales (apellidos, localizadores...) que vive fuera del repo, para
  que un commit con datos reales filtrados quede bloqueado automáticamente.

## Pendientes conocidos del viaje

Ver `app/private/extraction-report.md` (en el ordenador donde se generaron
los datos) y la lista "Pendientes" dentro de la propia app.
