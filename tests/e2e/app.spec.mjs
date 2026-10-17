import { test, expect } from '@playwright/test';
import { importFixture, expectUnlocked, FIXTURE_PASSPHRASE } from './helpers.mjs';

const SCREENS = ['/hoy', '/itinerario', '/reservas/vuelos', '/reservas/hoteles', '/listas', '/mas', '/notas', '/contactos', '/consejos', '/apps-utiles', '/conversor', '/ajustes'];

test('primer uso: importar fixture, desbloquear y navegar por todas las pantallas sin violar la CSP ni salir del origen', async ({ page }) => {
  const cspViolations = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations = window.__cspViolations || [];
      window.__cspViolations.push(e.violatedDirective + ': ' + e.blockedURI);
    });
  });

  const offOriginRequests = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.origin !== 'http://localhost:4173') offOriginRequests.push(req.url());
  });

  await importFixture(page);
  await expectUnlocked(page);

  for (const path of SCREENS) {
    await page.evaluate((p) => { location.hash = '#' + p; }, path);
    await page.waitForTimeout(150);
  }

  const violations = await page.evaluate(() => window.__cspViolations || []);
  expect(violations, 'no debe haber violaciones de CSP: ' + JSON.stringify(violations)).toEqual([]);
  expect(offOriginRequests, 'ninguna petición debe salir del propio origen: ' + JSON.stringify(offOriginRequests)).toEqual([]);
});

test('ninguna pantalla produce desbordamiento horizontal a 360px de ancho', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await importFixture(page);
  await expectUnlocked(page);

  for (const path of SCREENS) {
    await page.evaluate((p) => { location.hash = '#' + p; }, path);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `desbordamiento horizontal en ${path}`).toBeLessThanOrEqual(1);
  }
});

test('el itinerario muestra los días y permite abrir el detalle de un día', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/itinerario'; });
  await page.waitForTimeout(150);
  await page.click('.card:has-text("Llegada")');
  await expect(page.locator('h1')).toContainText('de enero');
});

test('el check-in de un vuelo se puede marcar como hecho', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/item/i_vuelo1'; });
  await page.waitForTimeout(150);
  await page.click('button:has-text("Marcar check-in como hecho")');
  await page.waitForTimeout(150);
  await expect(page.locator('button:has-text("Check-in hecho")')).toBeVisible();
});

test('reload tras marcar check-in conserva el cambio (persistencia cifrada real)', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/item/i_vuelo1'; });
  await page.waitForTimeout(150);
  await page.click('button:has-text("Marcar check-in como hecho")');
  await page.waitForTimeout(150);

  await page.reload();
  await page.fill('#pass', FIXTURE_PASSPHRASE);
  await page.click('button[type=submit]');
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/item/i_vuelo1'; });
  await page.waitForTimeout(150);
  await expect(page.locator('button:has-text("Check-in hecho")')).toBeVisible();
});
