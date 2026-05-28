import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as SecureStore from 'expo-secure-store'

interface AuthState {
  accessToken:  string | null
  refreshToken: string | null
  _hasHydrated: boolean

  setTokens:   (access: string, refresh: string) => void
  clearAuth:   () => void
  setHydrated: (v: boolean) => void
}

const secureStorage = createJSONStorage<AuthState>(() => ({
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
}))

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken:  null,
      refreshToken: null,
      _hasHydrated: false,

      setTokens:   (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      clearAuth:   () => set({ accessToken: null, refreshToken: null }),
      setHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'moidom-auth',
      storage: secureStorage,
      partialize: (state) => ({
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      } as AuthState),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    },
  ),
)
