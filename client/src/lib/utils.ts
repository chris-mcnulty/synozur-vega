import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { KeyboardEvent } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Keyboard handler that mirrors a click for elements given role="button".
 * Fires the handler on Enter or Space (and prevents Space from scrolling), so
 * a clickable non-button element becomes operable by keyboard.
 * Backs the Section 508 / WCAG 2.1 AA remediation (WCAG 2.1.1 Keyboard).
 */
export function activateOnKey(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}
