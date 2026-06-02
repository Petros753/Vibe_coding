import type { FirebaseAuthTypes } from '@react-native-firebase/auth'

// In-memory хранилище для Firebase confirmation объекта.
// Объект нельзя сериализовать через JSON (теряются методы),
// поэтому храним в модульной переменной.

let currentConfirmation: FirebaseAuthTypes.ConfirmationResult | null = null

export const firebaseConfirmation = {
  set: (c: FirebaseAuthTypes.ConfirmationResult) => {
    currentConfirmation = c
  },
  get: () => currentConfirmation,
  clear: () => {
    currentConfirmation = null
  },
}
