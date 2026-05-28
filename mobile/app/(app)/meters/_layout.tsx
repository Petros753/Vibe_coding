import { Stack } from 'expo-router'

export default function MetersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F8FAFC' } }}>
      <Stack.Screen name="index"  />
      <Stack.Screen name="submit" />
    </Stack>
  )
}
