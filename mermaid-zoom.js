// Click-to-zoom for mermaid SVGs.
// mdbook-mermaid renders SVGs inline and constrains them to the column width,
// which makes labels unreadable for dense flowcharts. This script adds a
// modal overlay on click so readers can see the diagram at full size.
//
// Implementation note:
//   We bind the click handler on the `<pre class="mermaid">` parent rather
//   than the inner `<svg>`. mermaid replaces the SVG element across renders
//   (theme switch, view changes), which would silently drop listeners
//   attached to the SVG itself. The parent <pre> is stable.

(() => {
  'use strict';

  const BOUND = Symbol.for('aws-cw-study.mermaid-zoom.bound');
  const MODAL_CLASS = 'mermaid-zoom-modal';

  const style = document.createElement('style');
  style.textContent = `
    pre.mermaid {
      cursor: zoom-in;
      transition: outline 0.15s ease;
      outline: 2px solid transparent;
      outline-offset: 4px;
    }
    pre.mermaid:hover {
      outline-color: rgba(0, 122, 204, 0.5);
    }
    pre.mermaid svg {
      pointer-events: none; /* let the click bubble to <pre> */
    }
    .${MODAL_CLASS} {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: zoom-out;
      padding: 2rem;
      box-sizing: border-box;
    }
    .${MODAL_CLASS} > svg {
      max-width: 95vw;
      max-height: 95vh;
      width: auto;
      height: auto;
      background: #ffffff;
      border-radius: 6px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      padding: 1rem;
      box-sizing: border-box;
    }
    .${MODAL_CLASS}-hint {
      position: fixed;
      bottom: 1.25rem;
      left: 50%;
      transform: translateX(-50%);
      color: #ffffff;
      font-size: 0.85rem;
      opacity: 0.75;
      pointer-events: none;
    }
    .${MODAL_CLASS}-newtab {
      position: fixed;
      top: 1rem;
      right: 1rem;
      padding: 0.5rem 0.9rem;
      background: rgba(255, 255, 255, 0.92);
      color: #1a1a1a;
      border: none;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }
    .${MODAL_CLASS}-newtab:hover {
      background: #ffffff;
    }
  `;
  document.head.appendChild(style);

  function bindContainer(container) {
    if (container[BOUND]) return;
    container[BOUND] = true;
    container.addEventListener('click', (e) => {
      const svg = container.querySelector('svg');
      if (!svg) return;
      e.preventDefault();
      e.stopPropagation();
      openModal(svg);
    });
  }

  function openInNewTab(originalSvg) {
    const clone = originalSvg.cloneNode(true);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.removeAttribute('style');
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    const xml =
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
      new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    // Best-effort cleanup — keep the URL alive long enough for the new tab
    // to load, then revoke. Most browsers tolerate revoke after load.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function openModal(originalSvg) {
    const modal = document.createElement('div');
    modal.className = MODAL_CLASS;

    const clone = originalSvg.cloneNode(true);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.removeAttribute('style');

    const newTabBtn = document.createElement('button');
    newTabBtn.className = `${MODAL_CLASS}-newtab`;
    newTabBtn.type = 'button';
    newTabBtn.textContent = '新しいタブで開く ↗';
    newTabBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openInNewTab(originalSvg);
    });

    const hint = document.createElement('div');
    hint.className = `${MODAL_CLASS}-hint`;
    hint.textContent =
      'クリックまたは Esc で閉じる / さらに拡大したいときは「新しいタブで開く」';

    modal.appendChild(clone);
    modal.appendChild(newTabBtn);
    modal.appendChild(hint);

    const close = () => {
      modal.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') close();
    };

    modal.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(modal);
  }

  function scan(root) {
    root.querySelectorAll('pre.mermaid').forEach(bindContainer);
  }

  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches && node.matches('pre.mermaid')) {
          bindContainer(node);
        } else {
          scan(node);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
