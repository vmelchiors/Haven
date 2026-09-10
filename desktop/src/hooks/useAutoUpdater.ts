import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';

export function useAutoUpdater(): void {
  useEffect(() => {
    if (!isTauri() || import.meta.env.DEV) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const [{ check }, { relaunch }] = await Promise.all([
          import('@tauri-apps/plugin-updater'),
          import('@tauri-apps/plugin-process'),
        ]);
        const update = await check();
        if (!update || cancelled) return;

        const accepted = window.confirm(
          `Haven ${update.version} está disponível. Deseja baixar e instalar agora?`,
        );
        if (!accepted || cancelled) return;

        await update.downloadAndInstall();
        if (!cancelled) await relaunch();
      } catch (error) {
        // Update failure must never prevent the communication client from opening.
        console.warn('[Updater] Não foi possível verificar ou instalar a atualização:', error);
      }
    }, 4_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);
}
