import { Stack } from 'expo-router'

export default function AnnouncementsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F8FAFC' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]"  />
    </Stack>
  )
}
