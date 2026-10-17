import { h, safeImgSrc } from '../dom.js';
import { getTripData, getKey, registerBlobUrl, revokeBlobUrl } from '../session.js';
import { loadBlob } from '../store.js';
import { navigate } from '../router.js';

export async function renderAttachmentViewer(attId) {
  const trip = getTripData();
  const meta = trip.attachments.find((a) => a.id === attId);
  if (!meta) {
    navigate('/mas');
    return () => {};
  }

  const bytes = await loadBlob(attId, getKey());
  if (!bytes) {
    navigate('/mas');
    return () => {};
  }
  const blob = new Blob([bytes], { type: meta.mime });
  const url = registerBlobUrl(attId, URL.createObjectURL(blob));

  let overlay;
  const closeBtn = h('button', { class: 'viewer-close', 'aria-label': 'Cerrar', onClick: close }, '✕');

  if (meta.mime === 'application/pdf') {
    const openBtn = h('button', { class: 'btn btn-primary' }, 'Abrir PDF');
    const safeHref = safeImgSrc(url); // blob: también válido aquí
    openBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = safeHref;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    });
    overlay = h('div', { class: 'viewer-overlay overlay-root' }, closeBtn, h('div', null, h('p', { style: { color: '#fff' } }, meta.name), openBtn));
  } else {
    const imgSrc = safeImgSrc(url);
    overlay = h('div', { class: 'viewer-overlay overlay-root' }, closeBtn, imgSrc ? h('img', { src: imgSrc, alt: meta.name }) : null);
  }

  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    revokeBlobUrl(attId);
    navigate('/mas');
  }

  return () => {
    if (overlay.isConnected) overlay.remove();
    revokeBlobUrl(attId);
  };
}
