import { test, expect } from '@playwright/test';
import {
  gotoFresh, importFixture, goToImportScreen, expectUnlocked, expectLocked,
  FIXTURE_PATH, FIXTURE_TAMPERED_PATH, FIXTURE_HUGEITER_PATH, FIXTURE_PASSPHRASE,
} from './helpers.mjs';

test('los vectores de XSS del fixture no se ejecutan en ninguna pantalla', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);

  // Visita las pantallas donde aparece contenido con intentos de inyección.
  for (const path of ['/item/i_vuelo1', '/notas', '/nota/n1', '/contactos']) {
    await page.evaluate((p) => { location.hash = '#' + p; }, path);
    await page.waitForTimeout(150);
  }

  const pwned = await page.evaluate(() => window.__pwned);
  expect(pwned, 'ningún vector de XSS del fixture debe haberse ejecutado').toBeUndefined();

  // El título con <script> debe verse como texto literal, no interpretarse.
  await page.evaluate(() => { location.hash = '#/item/i_vuelo1'; });
  await page.waitForTimeout(150);
  await expect(page.locator('h1')).toContainText('<script>window.__pwned=2</script>');

  // El teléfono de contacto con javascript: no debe renderizarse como enlace.
  await page.evaluate(() => { location.hash = '#/contactos'; });
  await page.waitForTimeout(150);
  const jsLinks = await page.locator('a[href^="javascript:"]').count();
  expect(jsLinks).toBe(0);
});

test('frase de paso incorrecta se rechaza con un mensaje claro', async ({ page }) => {
  await gotoFresh(page);
  await goToImportScreen(page);
  await page.setInputFiles('#importfile', FIXTURE_PATH);
  await page.fill('#pass', 'esta-frase-no-es-correcta-123');
  await page.click('button[type=submit]');
  await expect(page.locator('.warn-banner')).toBeVisible();
  await expectLocked(page);
});

test('archivo .tvault alterado (1 byte) se rechaza en vez de mostrar datos corruptos', async ({ page }) => {
  await importFixture(page, { filePath: FIXTURE_TAMPERED_PATH });
  await expect(page.locator('.warn-banner')).toBeVisible();
  await expectLocked(page);
});

test('archivo con número de iteraciones fuera de rango se rechaza rápido', async ({ page }) => {
  const start = Date.now();
  await importFixture(page, { filePath: FIXTURE_HUGEITER_PATH });
  await expect(page.locator('.warn-banner')).toBeVisible({ timeout: 5000 });
  expect(Date.now() - start).toBeLessThan(5000);
  await expectLocked(page);
});

test('tras una importación correcta, el archivo sigue sirviendo con la frase real', async ({ page }) => {
  await importFixture(page, { passphrase: FIXTURE_PASSPHRASE });
  await expectUnlocked(page);
});
