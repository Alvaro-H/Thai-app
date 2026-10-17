import { test, expect } from '@playwright/test';
import { importFixture, expectUnlocked, FIXTURE_PASSPHRASE } from './helpers.mjs';

test('tras la primera carga, la app funciona completamente sin conexión (PWA offline)', async ({ page, context }) => {
  await importFixture(page);
  await expectUnlocked(page);

  // Espera a que el service worker esté activo y haya precacheado el shell.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(500);

  await context.setOffline(true);
  await page.reload();

  // Debe poder desbloquear sin red (la base de datos local ya existe).
  await page.fill('#pass', FIXTURE_PASSPHRASE);
  await page.click('button[type=submit]');
  await expectUnlocked(page);

  // Navegar por varias pantallas sin red debe seguir funcionando.
  for (const path of ['/itinerario', '/reservas/hoteles', '/listas', '/mas']) {
    await page.evaluate((p) => { location.hash = '#' + p; }, path);
    await page.waitForTimeout(150);
    await expect(page.locator('h1')).toBeVisible();
  }

  await context.setOffline(false);
});
