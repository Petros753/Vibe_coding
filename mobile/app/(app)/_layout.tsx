import { Tabs } from 'expo-router'
import { Text } from 'react-native'

function TabIcon({ label, emoji }: { label: string; emoji: string }) {
  return (
    <Text style={{ fontSize: 22 }}>{emoji}</Text>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:      false,
        tabBarActiveTintColor:   '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor:  '#E2E8F0',
          paddingBottom:   4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:    'Главная',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Главная" emoji={focused ? '🏠' : '🏡'} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title:    'Заявки',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Заявки" emoji={focused ? '🔧' : '🔨'} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title:    'Объявления',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Объявления" emoji={focused ? '📢' : '📣'} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title:    'Чат',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Чат" emoji={focused ? '💬' : '🗨️'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title:    'Профиль',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Профиль" emoji={focused ? '👤' : '🙍'} />
          ),
        }}
      />
    </Tabs>
  )
}
