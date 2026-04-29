let installed = false;

export function installLcpGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const stopClarity = () => {
    const w = window as any;
    if (typeof w.clarity === 'function') {
      try { w.clarity('stop'); } catch {}
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopClarity();
  });

  window.addEventListener('pagehide', stopClarity);
}
