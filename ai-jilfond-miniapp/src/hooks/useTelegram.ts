import { useCallback, useEffect, useMemo } from 'react';
import type { TelegramUser, TelegramWebApp } from '../types/telegram';

interface UseTelegramReturn {
  tg: TelegramWebApp | null;
  user: TelegramUser | null;
  chatId: number | null;
  initData: string;
  colorScheme: 'light' | 'dark';
  isReady: boolean;
  close: () => void;
  expand: () => void;
  showMainButton: (text: string, onClick: () => void) => void;
  hideMainButton: () => void;
  showBackButton: (onClick: () => void) => void;
  hideBackButton: () => void;
  hapticFeedback: (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
  openLink: (url: string) => void;
}

export const useTelegram = (): UseTelegramReturn => {
  const tg = useMemo(() => window.Telegram?.WebApp || null, []);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();

      // Apply Telegram theme colors to CSS variables
      if (tg.themeParams) {
        const root = document.documentElement;
        if (tg.themeParams.bg_color) {
          root.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
        }
        if (tg.themeParams.text_color) {
          root.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
        }
        if (tg.themeParams.hint_color) {
          root.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color);
        }
        if (tg.themeParams.link_color) {
          root.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color);
        }
        if (tg.themeParams.button_color) {
          root.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
        }
        if (tg.themeParams.button_text_color) {
          root.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color);
        }
        if (tg.themeParams.secondary_bg_color) {
          root.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color);
        }
      }
    }
  }, [tg]);

  const user = useMemo(() => tg?.initDataUnsafe?.user || null, [tg]);
  const chatId = useMemo(() => user?.id || null, [user]);
  const initData = useMemo(() => tg?.initData || '', [tg]);
  const colorScheme = useMemo(() => tg?.colorScheme || 'light', [tg]);

  const close = useCallback(() => {
    tg?.close();
  }, [tg]);

  const expand = useCallback(() => {
    tg?.expand();
  }, [tg]);

  const showMainButton = useCallback((text: string, onClick: () => void) => {
    if (tg?.MainButton) {
      tg.MainButton.setText(text);
      tg.MainButton.onClick(onClick);
      tg.MainButton.show();
    }
  }, [tg]);

  const hideMainButton = useCallback(() => {
    if (tg?.MainButton) {
      tg.MainButton.hide();
    }
  }, [tg]);

  const showBackButton = useCallback((onClick: () => void) => {
    if (tg?.BackButton) {
      tg.BackButton.onClick(onClick);
      tg.BackButton.show();
    }
  }, [tg]);

  const hideBackButton = useCallback(() => {
    if (tg?.BackButton) {
      tg.BackButton.hide();
    }
  }, [tg]);

  const hapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
    if (tg?.HapticFeedback) {
      if (type === 'success' || type === 'warning' || type === 'error') {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    }
  }, [tg]);

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      if (tg) {
        tg.showAlert(message, () => resolve());
      } else {
        alert(message);
        resolve();
      }
    });
  }, [tg]);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (tg) {
        tg.showConfirm(message, (confirmed) => resolve(confirmed));
      } else {
        resolve(confirm(message));
      }
    });
  }, [tg]);

  const openLink = useCallback((url: string) => {
    if (tg) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }, [tg]);

  return {
    tg,
    user,
    chatId,
    initData,
    colorScheme,
    isReady: !!tg,
    close,
    expand,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    hapticFeedback,
    showAlert,
    showConfirm,
    openLink,
  };
};
