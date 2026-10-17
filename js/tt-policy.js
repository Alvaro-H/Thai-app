// S2: una única política de Trusted Types, llamada "sw", que solo permite
// crear la URL del propio service worker. Cualquier otro valor lanza un error.
// Esto es obligatorio porque la CSP del documento exige
// `require-trusted-types-for 'script'` y `trusted-types sw`.

const ALLOWED_SW_URL = './sw.js';

let policy = null;

export function getSwPolicy() {
  if (policy) return policy;
  if (typeof trustedTypes === 'undefined') {
    // Navegador sin soporte de Trusted Types: degradar a una cadena normal.
    policy = { createScriptURL: (url) => url };
    return policy;
  }
  policy = trustedTypes.createPolicy('sw', {
    createScriptURL(url) {
      if (url !== ALLOWED_SW_URL) {
        throw new Error('tt-policy: URL de service worker no permitida: ' + url);
      }
      return url;
    },
  });
  return policy;
}
