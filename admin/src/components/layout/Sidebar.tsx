import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'

const navItems = [
  { to: '/',              label: 'Дашборд',      icon: '⬛' },
  { to: '/tickets',       label: 'Заявки',        icon: '🎫' },
  { to: '/residents',     label: 'Жильцы',        icon: '👥' },
  { to: '/announcements', label: 'Объявления',    icon: '📢' },
  { to: '/cameras',       label: 'Камеры',        icon: '📷' },
  { to: '/settings',      label: 'Настройки',     icon: '⚙️' },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()

  return (
    <aside className="w-60 bg-gray-900 flex flex-col min-h-screen">
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-white font-bold text-lg">МойДом</span>
        <span className="ml-2 text-gray-400 text-xs">Админка</span>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-1 truncate">
          {user?.firstName ?? user?.phone}
        </div>
        <div className="text-xs text-gray-500 mb-3">{user?.role}</div>
        <button
          onClick={() => clearAuth()}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Выйти
        </button>
      </div>
    </aside>
  )
}
