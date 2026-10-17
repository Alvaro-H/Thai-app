import { test, expect } from '@playwright/test';
import { importFixture, expectUnlocked, expectLocked, TEST_IMAGE_PATH } from './helpers.mjs';

// El fixture usa autoLockHiddenSec=2 y autoLockIdleSec=3 para que las pruebas sean rápidas.

test('se bloquea tras pasar a segundo plano y no queda texto del viaje en el DOM', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/item/i_vuelo1'; });
  await page.waitForTimeout(150);
  await expect(page.locator('h1')).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // S10: el contenido se oculta al instante, antes de que expire el temporizador.
  await expect(page.locator('#hidden-cover')).toBeVisible();

  await page.waitForTimeout(2600);

  // Simula la vuelta a primer plano (en el móvil real, esto ocurre antes de
  // que la persona llegue a ver nada): la capa de ocultación se retira y
  // debajo debe estar ya la pantalla de bloqueo, no el contenido del viaje.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectLocked(page);

  const leftoverText = await page.evaluate(() => document.body.textContent);
  expect(leftoverText).not.toContain('Vuelo de prueba');
  expect(leftoverText).not.toContain('FF123');
});

test('se bloquea tras un periodo de inactividad', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.waitForTimeout(3600);
  await expectLocked(page);
});

test('la actividad del usuario reinicia el temporizador de inactividad', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.waitForTimeout(2000);
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(2000);
  // Si el temporizador se reinició, a los ~4s desde el desbloqueo todavía no debe estar bloqueado.
  await expectUnlocked(page);
});

test('añadir un documento propio, verlo y comprobar que la URL en memoria deja de funcionar tras bloquear', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/item/i_vuelo1'; });
  await page.waitForTimeout(150);

  await page.setInputFiles('#addDoc', TEST_IMAGE_PATH);
  await page.waitForTimeout(400);
  await expect(page.locator('button:has-text("test-image")')).toBeVisible();

  await page.click('button:has-text("test-image")');
  await page.waitForTimeout(200);
  const blobUrl = await page.locator('.viewer-overlay img').getAttribute('src');
  expect(blobUrl.startsWith('blob:')).toBe(true);

  // Se comprueba cargando la URL en un <img>, no con fetch(): la CSP
  // (connect-src 'self') bloquea deliberadamente fetch() contra blob:, igual
  // que contra cualquier otro origen que no sea el propio.
  const blobUrlLoads = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });

  const worksBeforeLock = await page.evaluate(blobUrlLoads, blobUrl);
  expect(worksBeforeLock).toBe(true);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectLocked(page);

  const worksAfterLock = await page.evaluate(blobUrlLoads, blobUrl);
  expect(worksAfterLock).toBe(false);
});
