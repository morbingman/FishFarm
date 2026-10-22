import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
export const NavigationContext = createContext({
  expanded: false,
  toggle: () => {},
});
export const useNavigation = () => useContext(NavigationContext);

/** A single indicator moves between links instead of remounting on each click. */
export function useNavIndicator(active: string) {
  const ref = useRef<HTMLElement>(null);
  const [style, setStyle] = useState({
    opacity: 0,
    transform: "translate(0px, 0px)",
    width: 0,
    height: 0,
  });
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const measure = () => {
      const link = nav.querySelector<HTMLElement>(
        '[aria-current]:not([data-no-indicator]), [data-nav-active="true"]',
      );
      if (!link) {
        setStyle((s) => ({ ...s, opacity: 0 }));
        return;
      }
      const next = {
        opacity: 1,
        transform: `translate3d(${link.offsetLeft}px, ${link.offsetTop}px, 0)`,
        width: link.offsetWidth,
        height: link.offsetHeight,
      };
      setStyle((previous) =>
        previous.transform === next.transform &&
        previous.width === next.width &&
        previous.height === next.height &&
        previous.opacity === next.opacity
          ? previous
          : next,
      );
    };
    measure();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(nav);
    nav.querySelectorAll("a, button").forEach((a) => observer.observe(a));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active]);
  return { ref, style };
}
