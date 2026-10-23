const key = 'form-haptics-v1';
let lastPulse = -Infinity;
export const supportsHaptics = () => typeof navigator.vibrate === 'function';
export function hapticsEnabled() {
  try { return localStorage.getItem(key) === 'on'; } catch { return false; }
}
export function setHapticsEnabled(enabled: boolean) {
  try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch { return false; }
  if (!enabled && supportsHaptics()) { try { navigator.vibrate(0); } catch { /* Optional hardware feedback. */ } }
  return true;
}
export function pulseHaptic(kind: 'tap' | 'complete' = 'tap') {
  if (!supportsHaptics() || !hapticsEnabled() || document.visibilityState !== 'visible' || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const now = performance.now();
  if (now - lastPulse < 80) return false;
  try {
    const accepted = navigator.vibrate(kind === 'complete' ? 18 : 8);
    if (accepted) lastPulse = now;
    return accepted;
  } catch { return false; }
}
export function startInteractionHaptics() {
  const onClick = (event: MouseEvent) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLButtonElement>('button');
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true' || target.closest('[data-haptics-settings], [data-managed-haptics]')) return;
    if (target.matches('.mobile-nav .active, [aria-selected="true"], .set-check[aria-pressed="true"]')) return;
    if (target.matches('.set-check, [data-haptic="complete"]')) pulseHaptic('complete');
    else if (target.matches('.btn.primary, .btn.secondary, .mobile-nav button, .train-tabs button, .setting-switch, .color-swatch, .source-segments button')) pulseHaptic();
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
