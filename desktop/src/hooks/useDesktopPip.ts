import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { useAuthStore } from '../stores/authStore';
import { useMediaStore } from '../stores/mediaStore';
import type { VoiceParticipant } from '../types';

interface SavedWindowGeometry {
  size: { width: number; height: number };
  position: { x: number; y: number };
  maximized: boolean;
}

export function useDesktopPip() {
  const participants = useMediaStore((state) => state.participants);
  const watchedScreenShares = useMediaStore((state) => state.watchedScreenShares);
  const focusedParticipant = useMediaStore((state) => state.focusedParticipant);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [isDesktopPip, setIsDesktopPip] = useState(false);
  const isDesktopPipRef = useRef(false);
  const transitionRef = useRef(false);
  const savedGeometryRef = useRef<SavedWindowGeometry | null>(null);

  const pipParticipant = useMemo<VoiceParticipant | null>(() => {
    const candidates = Object.values(participants).filter((participant) => (
      participant.isScreenSharing
      && Boolean(participant.screenTrack)
      && (participant.identity === currentUserId || watchedScreenShares[participant.identity])
    ));
    return candidates.find((participant) => participant.identity === focusedParticipant)
      || candidates.find((participant) => participant.identity !== currentUserId)
      || candidates[0]
      || null;
  }, [participants, watchedScreenShares, focusedParticipant, currentUserId]);

  const restore = useCallback(async () => {
    if (!isTauri() || transitionRef.current) return;
    transitionRef.current = true;
    try {
      const [{ getCurrentWindow }, { LogicalSize, PhysicalPosition, PhysicalSize }] = await Promise.all([
        import('@tauri-apps/api/window'),
        import('@tauri-apps/api/dpi'),
      ]);
      const appWindow = getCurrentWindow();
      const saved = savedGeometryRef.current;

      isDesktopPipRef.current = false;
      setIsDesktopPip(false);
      await appWindow.setAlwaysOnTop(false);
      await appWindow.setDecorations(true);
      await appWindow.setMinSize(new LogicalSize(960, 600));
      await appWindow.setResizable(true);
      if (saved) {
        if (saved.maximized) {
          await appWindow.maximize();
        } else {
          await appWindow.setSize(new PhysicalSize(saved.size.width, saved.size.height));
          await appWindow.setPosition(new PhysicalPosition(saved.position.x, saved.position.y));
        }
      }
      await appWindow.setFocus();
    } catch (error) {
      console.warn('[PiP] Não foi possível restaurar a janela:', error);
      isDesktopPipRef.current = false;
      setIsDesktopPip(false);
    } finally {
      transitionRef.current = false;
    }
  }, []);

  const startDragging = useCallback(async () => {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startDragging().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isTauri() || !pipParticipant?.screenTrack) return;
    let disposed = false;

    const checkWindowState = async () => {
      if (disposed || transitionRef.current) return;
      const [{ getCurrentWindow, currentMonitor }, { LogicalSize, PhysicalPosition }] = await Promise.all([
        import('@tauri-apps/api/window'),
        import('@tauri-apps/api/dpi'),
      ]);
      const appWindow = getCurrentWindow();
      const minimized = await appWindow.isMinimized();

      if (!minimized && !isDesktopPipRef.current) {
        const [size, position, maximized] = await Promise.all([
          appWindow.outerSize(),
          appWindow.outerPosition(),
          appWindow.isMaximized(),
        ]);
        savedGeometryRef.current = { size, position, maximized };
        return;
      }

      if (!minimized || isDesktopPipRef.current) return;
      transitionRef.current = true;
      try {
        const saved = savedGeometryRef.current;
        if (saved?.maximized) await appWindow.unmaximize();
        await appWindow.unminimize();
        await appWindow.setMinSize(new LogicalSize(320, 180));
        await appWindow.setResizable(true);
        await appWindow.setDecorations(false);
        await appWindow.setAlwaysOnTop(true);
        await appWindow.setSize(new LogicalSize(420, 236));

        const monitor = await currentMonitor();
        if (monitor) {
          const margin = Math.round(20 * monitor.scaleFactor);
          const width = Math.round(420 * monitor.scaleFactor);
          const height = Math.round(236 * monitor.scaleFactor);
          await appWindow.setPosition(new PhysicalPosition(
            monitor.workArea.position.x + monitor.workArea.size.width - width - margin,
            monitor.workArea.position.y + monitor.workArea.size.height - height - margin,
          ));
        }
        isDesktopPipRef.current = true;
        setIsDesktopPip(true);
      } catch (error) {
        console.warn('[PiP] Não foi possível abrir a janela flutuante:', error);
      } finally {
        transitionRef.current = false;
      }
    };

    void checkWindowState();
    const timer = window.setInterval(() => void checkWindowState(), 350);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [pipParticipant?.identity, pipParticipant?.screenTrack]);

  useEffect(() => {
    if (isDesktopPip && !pipParticipant?.screenTrack) void restore();
  }, [isDesktopPip, pipParticipant?.screenTrack, restore]);

  return { isDesktopPip, pipParticipant, restore, startDragging };
}
