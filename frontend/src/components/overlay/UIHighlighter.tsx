import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useChatbot } from '../../contexts/ChatbotContext';
import { agentEventBus } from '../../utils/eventBus';
import type { AgentEvent } from '../../utils/eventBus';

// ============================================================
// UIHighlighter — Dùng box-shadow trick (reliable, no SVG bugs)
//
// Lắng nghe HIGHLIGHT_ELEMENT event từ agentEventBus (Event-Driven)
// Vẫn tương thích với state.highlightedElementId (legacy)
// ============================================================

const PADDING = 10;

interface ViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const UIHighlighter: React.FC = () => {
  const { state, clearHighlight } = useChatbot();
  const [rect, setRect] = useState<ViewportRect | null>(null);
  const [label, setLabel] = useState('');
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number>(0);

  const elementId = state.highlightedElementId;

  // ── Update rect từ DOM element (viewport-relative) ──
  const updateRect = useCallback((el: Element) => {
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    });
  }, []);

  // ── Core logic: tìm element và bật spotlight ──
  const activateHighlight = useCallback((id: string, lbl?: string) => {
    let attempts = 0;

    const findEl = () => {
      const el =
        document.querySelector(`[data-highlight-id="${id}"]`) ||
        document.getElementById(id);

      if (!el) {
        if (attempts++ < 15) setTimeout(findEl, 200);
        return;
      }

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => {
        updateRect(el);
        setLabel(
          lbl ||
          el.getAttribute('data-highlight-label') ||
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.textContent?.trim().slice(0, 40) ||
          id
        );
      }, 400);

      const onScroll = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => updateRect(el));
      };

      observerRef.current?.disconnect();
      observerRef.current = new ResizeObserver(() => updateRect(el));
      observerRef.current.observe(el);
      window.addEventListener('scroll', onScroll, { passive: true });
    };

    findEl();
  }, [updateRect]);

  // ── Lắng nghe HIGHLIGHT_ELEMENT event từ agentEventBus ──
  // Khai báo SAU activateHighlight để tránh lỗi "used before declaration"
  useEffect(() => {
    const handler = (event: AgentEvent) => {
      if (event.type === 'HIGHLIGHT_ELEMENT') {
        activateHighlight(event.elementId, event.elementLabel);
      }
    };

    agentEventBus.on('HIGHLIGHT_ELEMENT', handler);
    return () => agentEventBus.off('HIGHLIGHT_ELEMENT', handler);
  }, [activateHighlight]);

  // ── Legacy: elementId từ ChatbotContext state ──
  useEffect(() => {
    if (!elementId) {
      setRect(null);
      setLabel('');
      observerRef.current?.disconnect();
      return;
    }

    activateHighlight(elementId, undefined);

    return () => {
      observerRef.current?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [elementId, activateHighlight]);

  // ── Auto-dismiss sau 8 giây ──
  useEffect(() => {
    if (!rect) return;
    const t = setTimeout(() => {
      setRect(null);
      clearHighlight();
    }, 8000);
    return () => clearTimeout(t);
  }, [rect, clearHighlight]);

  const handleDismiss = () => {
    setRect(null);
    clearHighlight();
  };

  if (!rect) return null;

  const tooltipBelow = rect.top < 80;
  const tooltipTop = tooltipBelow ? rect.top + rect.height + 10 : rect.top - 46;
  const tooltipLeft = Math.min(Math.max(rect.left, 8), window.innerWidth - 280);

  return (
    <>
      {/* ── Backdrop click-to-dismiss ── */}
      <div
        onClick={handleDismiss}
        role="button"
        aria-label="Đóng chỉ dẫn"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Escape' && handleDismiss()}
        style={{ position: 'fixed', inset: 0, zIndex: 9499, cursor: 'pointer' }}
      />

      {/* ── Spotlight element ── */}
      <div
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          zIndex: 9500,
          pointerEvents: 'none',
          borderRadius: 10,
          boxShadow: [
            '0 0 0 9999px rgba(9, 30, 66, 0.75)',
            '0 0 0 3px #FFD700',
            '0 0 24px 4px rgba(255, 215, 0, 0.5)',
          ].join(', '),
          animation: 'spotlight-pulse 2s ease-in-out infinite',
        }}
      />

      {/* ── Tooltip label ── */}
      <div
        style={{
          position: 'fixed',
          top: tooltipTop,
          left: tooltipLeft,
          zIndex: 9501,
          background: '#FFD700',
          color: '#1a1a2e',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: '0.8125rem',
          fontWeight: 700,
          fontFamily: 'Be Vietnam Pro, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
          animation: 'tooltip-appear 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>👆</span>
        {label}
      </div>

      {/* ── Dismiss hint ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9501,
          color: 'rgba(255,255,255,0.65)',
          fontSize: '0.8rem',
          fontFamily: 'Be Vietnam Pro, sans-serif',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Nhấn bất kỳ đâu hoặc nhấn Esc để tắt chỉ dẫn
      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes spotlight-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 9999px rgba(9, 30, 66, 0.75),
              0 0 0 3px #FFD700,
              0 0 24px 4px rgba(255, 215, 0, 0.5);
          }
          50% {
            box-shadow:
              0 0 0 9999px rgba(9, 30, 66, 0.75),
              0 0 0 4px #FFD700,
              0 0 40px 8px rgba(255, 215, 0, 0.7);
          }
        }
        @keyframes tooltip-appear {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default UIHighlighter;
