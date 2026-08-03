import { useEffect, useRef } from "react";

/**
 * Accessibility helper for non-modal disclosure panels (the AI and Help chat
 * side panels, which sit alongside page content rather than over it).
 *
 * On open it moves focus into the panel; while open, Escape closes it; on close
 * it restores focus to the element that was focused when the panel opened (the
 * trigger button). Attach the returned ref to the panel's root element, and
 * give that root role="dialog" + an aria-label.
 *
 * Backs the Section 508 / WCAG 2.1 AA remediation (BACKLOG.md Feature #6):
 * WCAG 2.4.3 (Focus Order), 2.1.2 (No Keyboard Trap), 4.1.2 (Name/Role/Value).
 */
export function useDialogPanel<T extends HTMLElement>(onClose: () => void) {
  const panelRef = useRef<T>(null);
  // Keep the latest onClose without re-running the mount/unmount effect.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      // Prefer the message input; fall back to the first focusable, then the
      // panel container itself (which is tabIndex={-1}).
      const target =
        panel.querySelector<HTMLElement>("textarea") ??
        panel.querySelector<HTMLElement>(
          'button, [href], input, select, [tabindex]:not([tabindex="-1"])',
        ) ??
        panel;
      target.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return panelRef;
}
