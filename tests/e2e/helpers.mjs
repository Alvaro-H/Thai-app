import { expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { FIXTURE_PASSPHRASE } from '../fixtures/passphrase.mjs';

export { FIXTURE_PASSPHRASE };

export const FIXTURE_PATH = fileURLToPath(new URL('../fixtures/fake-trip.tvault', import.meta.url));
export const FIXTURE_TAMPERED_PATH = fileURLToPath(new URL('../fixtures/fake-trip-tampered.tvault', import.meta.url));
export const FIXTURE_HUGEITER_PATH = fileURLToPath(new URL('../fixtures/fake-trip-hugeiter.tvault', import.meta.url));
export const TEST_IMAGE_PATH = fileURLToPath(new URL('../fixtures/test-image.jpg', import.meta.url));

export async function gotoFresh(page) {
  await page.goto('/');
}

/** Importa el fixture y queda desbloqueado en /hoy. */
export async function importFixture(page, { passphrase = FIXTURE_PASSPHRASE, filePath = FIXTURE_PATH } = {}) {
  await gotoFresh(page);
  await goToImportScreen(page);
  await page.setInputFiles('#importfile', filePath);
  await page.fill('#pass', passphrase);
  await page.click('button[type=submit]');
}

/** Lleva la pantalla de bloqueo (crear o desbloquear) hasta el formulario de importación. */
export async function goToImportScreen(page) {
  const importFile = page.locator('#importfile');
  if (await importFile.count()) return;
  await page.click('button:has-text("importar")');
  await expect(page.locator('#importfile')).toBeVisible();
}

export async function expectUnlocked(page) {
  await expect(page.locator('#app')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#lock-screen')).toBeHidden();
}

export async function expectLocked(page) {
  await expect(page.locator('#lock-screen')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#app')).toBeHidden();
}
