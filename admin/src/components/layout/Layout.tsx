import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '../../store/auth.store'

export function Layout() {
  const { accessToken, user } = useAuthStore()

  if (!accessToken || !user) return <Navigate to="/login" replace />
  if (user.role !== 'ORG_ADMIN' && user.role !== 'ORG_MANAGER' && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-800">Доступ запрещён</p>
          <p className="text-sm text-gray-500 mt-1">Недостаточно прав для входа в панель управления</p>
          <button onClick={() => useAuthStore.getState().clearAuth()} className="mt-4 text-primary-600 text-sm hover:underline">
            Выйти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
