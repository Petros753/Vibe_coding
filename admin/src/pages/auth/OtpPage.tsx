import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth.store'
import { Button } from '../../components/ui/Button'

export function OtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { accessToken, setAuth } = useAuthStore()
  const phone: string = location.state?.phone ?? ''
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (accessToken) return <Navigate to="/" replace />
  if (!phone) return <Navigate to="/login" replace />

  const mutation = useMutation({
    mutationFn: () => authApi.verifyOtp(phone, code),
    onSuccess: ({ accessToken, refreshToken, user }) => {
      setAuth(accessToken, refreshToken, user)
      navigate('/', { replace: true })
    },
    onError: (err: any) => setError(err?.response?.data?.error?.message ?? 'Неверный код'),
  })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-2xl">М</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">МойДом</h1>
          <p className="text-sm text-gray-500 mt-1">Панель управления</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Код подтверждения</h2>
          <p className="text-sm text-gray-500 mb-5">
            Отправили SMS на <span className="font-medium text-gray-700">{phone}</span>
          </p>

          <input
            className={`w-full border rounded-xl px-4 h-12 text-center text-2xl tracking-widest font-mono outline-none focus:ring-2 focus:ring-primary-500 ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            placeholder="----"
            value={code}
            onChange={e => { setError(null); setCode(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
            autoFocus
            inputMode="numeric"
          />

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          <Button
            className="w-full mt-4 justify-center h-11"
            onClick={() => code.length === 4 && mutation.mutate()}
            disabled={code.length < 4}
            loading={mutation.isPending}
          >
            Войти
          </Button>

          <button onClick={() => navigate('/login')} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600">
            Изменить номер
          </button>
        </div>
      </div>
    </div>
  )
}
