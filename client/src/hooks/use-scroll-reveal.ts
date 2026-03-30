import { useEffect, useRef } from "react";

/**
 * useScrollReveal
 *
 * Attaches an IntersectionObserver to the returned containerRef.
 * When an element with `fade-up-hidden` or `fade-in-hidden` enters
 * the viewport, the hook adds the `is-visible` class to trigger the
 * CSS transition defined in index.css.
 *
 * Usage:
 *   const ref = useScrollReveal();
 *   <section ref={ref}>
 *     <div className="fade-up-hidden">…</div>
 *   </section>
 *
 * The hook selects all descendants that have the sentinel classes
 * so you can wrap entire sections.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  threshold = 0.12
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const targets = container.querySelectorAll<HTMLElement>(
      ".fade-up-hidden, .fade-in-hidden"
    );

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
