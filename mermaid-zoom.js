// Click-to-zoom for mermaid SVGs.
// mdbook-mermaid renders SVGs inline and constrains them to the column width,
// which makes labels unreadable for dense flowcharts. This script adds a
// modal overlay on click so readers can see the diagram at full size.
//
// Behavior:
//   - cursor: zoom-in on every rendered mermaid SVG
//   - click   -> open in fullscreen overlay (max 95vw x 95vh)
//   - click overlay or press Esc -> close
//   - browser-native pinch/Ctrl+wheel still works inside the modal

(() => {
  'use strict';

  const ZOOM_BOUND_FLAG = 'data-zoom-bound';
  const MODAL_CLASS = 'mermaid-zoom-modal';

  // Inject minimal CSS once.
  const style = document.createElement('style');
  style.textContent = `
    pre.mermaid svg, .mermaid > svg {
      cursor: zoom-in;
      transition: outline 0.15s ease;
    }
    pre.mermaid svg:hover, .mermaid > svg:hover {
      outline: 2px solid rgba(0, 122, 204, 0.5);
      outline-offset: 4px;
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
  `;
  document.head.appendChild(style);

  function bindSvg(svg) {
    if (svg.getAttribute(ZOOM_BOUND_FLAG)) return;
    svg.setAttribute(ZOOM_BOUND_FLAG, 'true');
    svg.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(svg);
    });
  }

  function openModal(originalSvg) {
    const modal = document.createElement('div');
    modal.className = MODAL_CLASS;

    const clone = originalSvg.cloneNode(true);
    // Remove width/height so max-width/max-height take over.
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.removeAttribute('style');

    const hint = document.createElement('div');
    hint.className = `${MODAL_CLASS}-hint`;
    hint.textContent = 'クリックまたは Esc で閉じる / ブラウザの拡大 (Ctrl/Cmd + +) でさらに拡大';

    modal.appendChild(clone);
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

  // mermaid renders asynchronously. Bind any SVGs that exist now,
  // and watch for new ones added later.
  function scan(root) {
    root.querySelectorAll('pre.mermaid svg, .mermaid > svg').forEach(bindSvg);
  }

  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches && node.matches('pre.mermaid svg, .mermaid > svg')) {
          bindSvg(node);
        } else {
          scan(node);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
