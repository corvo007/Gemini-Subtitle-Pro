import { useEffect, type RefObject } from 'react';

/**
 * Hook that alerts clicks outside of the passed ref(s)
 */
export function useOutsideClick<T extends HTMLElement>(
  refOrRefs: RefObject<T> | RefObject<T>[],
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const refs = Array.isArray(refOrRefs) ? refOrRefs : [refOrRefs];

      // Do nothing if clicking any of the refs' elements or their descendants
      const isInside = refs.some(
        (ref) => ref.current && ref.current.contains(event.target as Node)
      );

      if (isInside) {
        return;
      }

      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refOrRefs, handler, enabled]);
}
