// Injected into every recorded page: headless Chrome draws no cursor and no
// keys, so the videos get a visible pointer, a click ripple and a key badge.
export function overlay() {
  const install = () => {
    const style = document.createElement('style');
    style.textContent = `
      #rec-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 2147483647;
        pointer-events: none; translate: -100px -100px; transition: scale 120ms ease; }
      #rec-cursor.down { scale: 0.85; }
      .rec-ripple { position: fixed; z-index: 2147483646; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border-radius: 50%; border: 2px solid rgba(124, 92, 196, 0.9); pointer-events: none;
        animation: rec-ripple 520ms ease-out forwards; }
      @keyframes rec-ripple { from { scale: 0.3; opacity: 1; } to { scale: 1.5; opacity: 0; } }
      #rec-keys { position: fixed; left: 24px; bottom: 24px; z-index: 2147483647; pointer-events: none;
        display: flex; gap: 6px; }
      #rec-keys kbd { font: 700 15px ui-monospace, Menlo, monospace; color: #fff; background: rgba(20, 18, 33, 0.86);
        padding: 7px 12px; border-radius: 9px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        animation: rec-key 1300ms ease forwards; }
      @keyframes rec-key { 0% { opacity: 0; translate: 0 6px; } 10%, 75% { opacity: 1; translate: 0 0; } 100% { opacity: 0; } }
    `;
    document.head.append(style);
    const cursor = document.createElement('div');
    cursor.id = 'rec-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2 L3 18 L7.5 13.8 L10.6 20.5 L13.4 19.2 L10.4 12.6 L16.5 12.4 Z" fill="#141221" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const keys = document.createElement('div');
    keys.id = 'rec-keys';
    document.body.append(cursor, keys);

    addEventListener('mousemove', (e) => (cursor.style.translate = `${e.clientX - 3}px ${e.clientY - 2}px`), true);
    addEventListener('mousedown', (e) => {
      cursor.classList.add('down');
      const r = document.createElement('div');
      r.className = 'rec-ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.append(r);
      setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener('mouseup', () => cursor.classList.remove('down'), true);

    const names = {Enter: '⏎ Enter', Escape: 'Esc', Backspace: '⌫', Delete: 'Del', ArrowDown: '↓', ArrowUp: '↑'};
    addEventListener('keydown', (e) => {
      if (['Meta', 'Shift', 'Control', 'Alt'].includes(e.key)) return;
      const t = e.target;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName) || t.closest?.('.cm-editor'));
      const combo = e.metaKey || e.ctrlKey;
      if (typing && !combo && !names[e.key]) return;
      if (typing && (e.key === 'Backspace' || e.key.startsWith('Arrow'))) return;
      let label = names[e.key] || e.key.toUpperCase();
      if (e.metaKey) label = '⌘' + label;
      if (e.shiftKey && combo) label = '⇧' + label;
      const k = document.createElement('kbd');
      k.textContent = label;
      keys.append(k);
      setTimeout(() => k.remove(), 1300);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
}
