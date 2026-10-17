import { test, expect } from '@playwright/test';
import { importFixture, goToImportScreen, expectUnlocked, expectLocked, FIXTURE_PASSPHRASE } from './helpers.mjs';

test('exportar genera un .tvault cifrado que no contiene texto en claro, y se puede reimportar en un contexto nuevo', async ({ page, browser }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/ajustes'; });
  await page.waitForTimeout(150);

  const EXPORT_PASS = 'frase-de-exportacion-distinta-999';
  page.once('dialog', (dialog) => dialog.accept(EXPORT_PASS));

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Exportar copia cifrada")'),
  ]);

  expect(download.suggestedFilename()).toBe('viaje.tvault');
  const path = await download.path();
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(path, 'utf8');

  // El archivo exportado no debe contener ningún dato en claro del fixture.
  expect(content).not.toContain('Hotel Ficticio');
  expect(content).not.toContain('Vuelo de prueba');
  expect(content).not.toContain('ABC123');
  const envelope = JSON.parse(content);
  expect(envelope.fmt).toBe('tvault');
  expect(typeof envelope.ct).toBe('string');

  // Reimportar en un contexto de navegador nuevo y limpio.
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  await freshPage.goto('/');
  await goToImportScreen(freshPage);
  await freshPage.setInputFiles('#importfile', path);
  await freshPage.fill('#pass', EXPORT_PASS);
  await freshPage.click('button[type=submit]');
  await expectUnlocked(freshPage);
  await freshPage.evaluate(() => { location.hash = '#/item/i_hotel1'; });
  await freshPage.waitForTimeout(150);
  await expect(freshPage.locator('h1')).toContainText('Hotel Ficticio');

  await freshContext.close();
});

test('cambiar la frase de paso invalida la antigua y habilita la nueva', async ({ page }) => {
  await importFixture(page);
  await expectUnlocked(page);
  await page.evaluate(() => { location.hash = '#/ajustes'; });
  await page.waitForTimeout(150);

  const NEW_PASS = 'nueva-frase-de-paso-distinta-456';

  // Localiza el formulario de cambio de frase por su botón "Cambiar".
  const changeSection = page.locator('form', { has: page.locator('button:has-text("Cambiar")') });
  const inputs = changeSection.locator('input[type=password]');
  await inputs.nth(0).fill(NEW_PASS);
  await inputs.nth(1).fill(NEW_PASS);
  await changeSection.locator('button:has-text("Cambiar")').click();

  await expectLocked(page);

  // La frase antigua ya no funciona.
  await page.fill('#pass', FIXTURE_PASSPHRASE);
  await page.click('button[type=submit]');
  await expect(page.locator('.warn-banner')).toBeVisible();

  // La frase nueva sí funciona.
  await page.fill('#pass', NEW_PASS);
  await page.click('button[type=submit]');
  await expectUnlocked(page);
});
