import { Stack } from 'expo-router'

export default function ChatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F8FAFC' } }}>
      <Stack.Screen name="index"     />
      <Stack.Screen name="[roomId]"  />
    </Stack>
  )
}
