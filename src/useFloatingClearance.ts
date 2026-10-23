import {useLayoutEffect} from 'react';

// Reserve the measured space of floating controls, including wrapped text.
export function useFloatingClearance(screenKey: string) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const controls = [...document.querySelectorAll<HTMLElement>('.mobile-nav, .workout-dock, .resume-bar')];
    const toast = document.querySelector<HTMLElement>('.toast');
    function update() {
      if (!matchMedia('(max-width: 760px)').matches) return;
      const clearance = Math.ceil(Math.max(0, ...controls.filter(el => el.getClientRects().length).map(el => el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0))));
      root.style.setProperty('--floating-controls-clearance', `${clearance + 12}px`);
      root.style.setProperty('--floating-content-clearance', `${clearance + (toast?.offsetHeight || 0) + 36}px`);
    }
    const observer = new ResizeObserver(update);
    for (const control of controls) observer.observe(control);
    if (toast) observer.observe(toast);
    update(); window.addEventListener('resize', update);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', update);
      root.style.removeProperty('--floating-controls-clearance');
      root.style.removeProperty('--floating-content-clearance');
    };
  }, [screenKey]);
}
