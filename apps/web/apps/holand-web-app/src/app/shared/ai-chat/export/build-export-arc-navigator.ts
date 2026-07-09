import {
  ARC_ACTIVE_LENGTH_BONUS,
  ARC_EDGE_FADE_ZONE,
  ARC_MAX_LINE_PX,
  ARC_MIN_LINE_PX,
  ARC_NAV_CENTER_SLOT,
  ARC_NAV_MIN_TURNS,
  ARC_NAV_SLOT_COUNT,
  arcMessageAnchorId,
  buildDialSlots,
  buildTurnsFromMessages,
  computeArcLineGeometry,
  type ArcNavMessageLike,
  type ArcNavTurn,
} from '../arc-navigator/arc-navigator-utils';

export { ARC_NAV_MIN_TURNS, arcMessageAnchorId, buildTurnsFromMessages };

/** Escape JSON embedded in a script tag (prevents </script> breaking the page). */
export function safeJsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c');
}

export const ARC_NAV_EXPORT_CSS = `
  /* Sidebar width drives arc horizontal offset (always visible, never overlaps). */
  .export-app { --export-sidebar-w: 0px; }
  .export-app.has-sidebar:not(.sidebar-collapsed) { --export-sidebar-w: 320px; }
  @media (max-width: 980px) { .export-app.has-sidebar { --export-sidebar-w: 0px; } }

  .export-main.has-arc-nav {
    padding-inline-end: clamp(52px, 7vw, 80px);
  }
  .export-arc-nav {
    position: fixed; top: 50%; z-index: 20;
    transform: translateY(-50%);
    width: 72px; max-height: min(72vh, 640px);
    display: none; flex-direction: column; align-items: flex-end; justify-content: center;
    gap: 7px; padding: 16px 0; pointer-events: auto; user-select: none;
  }
  @media (min-width: 1024px) {
    .export-arc-nav.visible { display: flex; }
    /* Sit inside the main column, just before the session-files sidebar */
    html[dir="ltr"] .export-arc-nav {
      right: calc(
        max(0px, (100vw - min(100vw, 1320px)) / 2)
        + var(--export-sidebar-w)
        + 20px
      );
    }
    html[dir="rtl"] .export-arc-nav {
      left: calc(
        max(0px, (100vw - min(100vw, 1320px)) / 2)
        + var(--export-sidebar-w)
        + 20px
      );
    }
  }
  .export-arc-item, .export-arc-ghost {
    display: flex; width: 100%; align-items: center; justify-content: flex-end; gap: 6px;
    padding: 2px 4px;
  }
  .export-arc-item {
    border: none; background: transparent; cursor: pointer;
    transition: all 150ms ease-out;
  }
  .export-arc-label {
    max-width: 3.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 9px; line-height: 1.2; color: var(--export-text-muted); text-align: end;
    opacity: 0; transition: opacity 150ms ease-out;
  }
  .export-arc-item:hover .export-arc-label,
  .export-arc-item.active .export-arc-label { opacity: 1; }
  .export-arc-item.active .export-arc-label { font-weight: 600; color: var(--export-primary); }
  .export-arc-dot {
    flex-shrink: 0; width: 4px; height: 4px; border-radius: 50%;
    background: var(--export-primary);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--export-primary) 40%, transparent);
  }
  .export-arc-line {
    flex-shrink: 0; display: block; height: 1px; border-radius: 1px;
    background: color-mix(in srgb, var(--export-text-muted) 55%, transparent);
    transform-origin: right center;
    transition: width 150ms ease-out, opacity 150ms ease-out, transform 150ms ease-out, height 150ms ease-out;
  }
  .export-arc-item.active .export-arc-line {
    height: 2px; background: var(--export-primary);
    box-shadow: 0 1px 4px color-mix(in srgb, var(--export-primary) 35%, transparent);
  }
  html[dir="rtl"] .export-arc-line { transform-origin: left center; }
`;

function escAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function renderDialSlot(
  slotIndex: number,
  turn: ArcNavTurn | null,
  globalIndex: number,
  maxWeight: number
): string {
  const geo = computeArcLineGeometry(
    slotIndex,
    ARC_NAV_SLOT_COUNT,
    turn?.weight ?? 1,
    maxWeight,
    ARC_NAV_CENTER_SLOT,
    { placeholder: turn === null }
  );

  if (!turn) {
    return `<div class="export-arc-ghost" aria-hidden="true">
      <span class="export-arc-line" style="width:${geo.length.toFixed(1)}px;opacity:${geo.opacity.toFixed(3)};transform:translateX(${geo.offsetX}px)"></span>
    </div>`;
  }

  const dot = geo.showDot
    ? '<span class="export-arc-dot" aria-hidden="true"></span>'
    : '';

  return `<button type="button" class="export-arc-item${geo.isActive ? ' active' : ''}"
    data-arc-anchor="${escAttr(arcMessageAnchorId(turn.userMessageId))}"
    data-arc-global="${globalIndex}"
    title="${escAttr(`${turn.label} (${turn.userChars}+${turn.assistantChars})`)}">
    <span class="export-arc-label">${geo.isActive ? escAttr(turn.label) : ''}</span>
    ${dot}
    <span class="export-arc-line" style="width:${geo.length.toFixed(1)}px;opacity:${geo.isActive ? 1 : geo.opacity.toFixed(3)};transform:translateX(${geo.offsetX}px)" aria-hidden="true"></span>
  </button>`;
}

export function renderArcNavigatorHtml(
  messages: ArcNavMessageLike[],
  hasSidebar: boolean
): string {
  const turns = buildTurnsFromMessages(messages);
  if (turns.length < ARC_NAV_MIN_TURNS) return '';

  const maxWeight = Math.max(1, ...turns.map((t) => t.weight));
  const activeIndex = Math.floor(turns.length / 2);
  const slots = buildDialSlots(turns, activeIndex);
  const items = slots
    .map((s) => renderDialSlot(s.slotIndex, s.turn, s.globalIndex, maxWeight))
    .join('');

  const turnsJson = JSON.stringify(
    turns.map((t) => ({
      anchor: arcMessageAnchorId(t.userMessageId),
      label: t.label,
      weight: t.weight,
      userChars: t.userChars,
      assistantChars: t.assistantChars,
    }))
  );

  return `<nav class="export-arc-nav visible" id="export-arc-nav" aria-label="Message index">
    <div class="export-arc-list" id="export-arc-list">${items}</div>
  </nav>
  <script type="application/json" id="export-arc-data">${safeJsonForScript(turnsJson)}</script>`;
}

export const ARC_NAV_EXPORT_SCRIPT = `
      (function () {
        var dataEl = document.getElementById('export-arc-data');
        var listEl = document.getElementById('export-arc-list');
        var navEl = document.getElementById('export-arc-nav');
        if (!dataEl || !listEl || !navEl) return;

        var turns = [];
        try { turns = JSON.parse(dataEl.textContent || '[]'); } catch (e) { return; }
        if (turns.length < ${ARC_NAV_MIN_TURNS}) { navEl.remove(); return; }

        var MIN_LINE = ${ARC_MIN_LINE_PX}, MAX_LINE = ${ARC_MAX_LINE_PX}, ACTIVE_BONUS = ${ARC_ACTIVE_LENGTH_BONUS};
        var EDGE_ZONE = ${ARC_EDGE_FADE_ZONE}, SLOTS = ${ARC_NAV_SLOT_COUNT}, CENTER = ${ARC_NAV_CENTER_SLOT};
        var activeIndex = 0, wheelAccum = 0, programmatic = false;

        function gaussian(index, total, sigma) {
          if (total <= 1) return 1;
          var mid = (total - 1) / 2;
          return Math.exp(-0.5 * Math.pow((index - mid) / sigma, 2));
        }

        function geometry(slotIndex, weight, maxWeight, placeholder) {
          var isActive = slotIndex === CENTER;
          var weightRatio = maxWeight > 0 ? weight / maxWeight : 0.5;
          var length = MIN_LINE + weightRatio * (MAX_LINE - MIN_LINE);
          if (isActive) length += ACTIVE_BONUS;
          if (placeholder) length = MIN_LINE * 0.6;
          var sigma = Math.max(SLOTS / 3.5, 2);
          var bell = gaussian(slotIndex, SLOTS, sigma);
          var edgeT = SLOTS > 1 ? slotIndex / (SLOTS - 1) : 0.5;
          var edgeFade = Math.min(Math.min(edgeT / EDGE_ZONE, 1), Math.min((1 - edgeT) / EDGE_ZONE, 1));
          var veil = Math.pow(edgeFade, 1.5) * (0.3 + 0.7 * bell);
          var offsetX = (1 - bell) * 4;
          var opacity;
          if (isActive) opacity = 1;
          else if (placeholder) opacity = 0.04 + veil * 0.06;
          else opacity = Math.min(0.2 + veil * 0.35 + weightRatio * 0.08, 0.55);
          return { length: length, opacity: opacity, offsetX: offsetX, isActive: isActive, showDot: isActive };
        }

        var maxWeight = 1;
        turns.forEach(function (t) { if (t.weight > maxWeight) maxWeight = t.weight; });

        function render() {
          var html = '';
          for (var i = 0; i < SLOTS; i++) {
            var gi = activeIndex - CENTER + i;
            var turn = gi >= 0 && gi < turns.length ? turns[gi] : null;
            var geo = geometry(i, turn ? turn.weight : 1, maxWeight, !turn);
            if (!turn) {
              html += '<div class="export-arc-ghost" aria-hidden="true"><span class="export-arc-line" style="width:' + geo.length.toFixed(1) + 'px;opacity:' + geo.opacity.toFixed(3) + ';transform:translateX(' + geo.offsetX + 'px)"></span></div>';
              continue;
            }
            var dot = geo.showDot ? '<span class="export-arc-dot" aria-hidden="true"></span>' : '';
            html += '<button type="button" class="export-arc-item' + (geo.isActive ? ' active' : '') + '" data-arc-anchor="' + turn.anchor + '" data-arc-global="' + gi + '" title="' + turn.label + ' (' + turn.userChars + '+' + turn.assistantChars + ')">' +
              '<span class="export-arc-label">' + (geo.isActive ? turn.label : '') + '</span>' + dot +
              '<span class="export-arc-line" style="width:' + geo.length.toFixed(1) + 'px;opacity:' + (geo.isActive ? 1 : geo.opacity.toFixed(3)) + ';transform:translateX(' + geo.offsetX + 'px)" aria-hidden="true"></span></button>';
          }
          listEl.innerHTML = html;
          listEl.querySelectorAll('.export-arc-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var gi = Number(btn.getAttribute('data-arc-global'));
              if (!Number.isFinite(gi)) return;
              activeIndex = gi;
              render();
              scrollToAnchor(btn.getAttribute('data-arc-anchor'));
            });
          });
        }

        function scrollToAnchor(anchorId) {
          if (!anchorId) return;
          var el = document.getElementById(anchorId);
          if (!el) return;
          programmatic = true;
          window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 24), behavior: 'smooth' });
          setTimeout(function () { programmatic = false; }, 450);
        }

        navEl.addEventListener('wheel', function (e) {
          e.preventDefault();
          wheelAccum += e.deltaY;
          if (Math.abs(wheelAccum) < 40) return;
          var dir = wheelAccum > 0 ? 1 : -1;
          wheelAccum = 0;
          var next = Math.max(0, Math.min(turns.length - 1, activeIndex + dir));
          if (next === activeIndex) return;
          activeIndex = next;
          render();
          scrollToAnchor(turns[next].anchor);
        }, { passive: false });

        if ('IntersectionObserver' in window) {
          var observer = new IntersectionObserver(function (entries) {
            if (programmatic) return;
            var best = null;
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              var idx = turns.findIndex(function (t) { return t.anchor === entry.target.id; });
              if (idx < 0) return;
              if (!best || entry.intersectionRatio > best.ratio) best = { idx: idx, ratio: entry.intersectionRatio };
            });
            if (best) { activeIndex = best.idx; render(); }
          }, { root: null, rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
          turns.forEach(function (t) {
            var el = document.getElementById(t.anchor);
            if (el) observer.observe(el);
          });
        }

        render();
      })();
`;
