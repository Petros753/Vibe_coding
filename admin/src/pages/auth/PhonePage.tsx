import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/auth'
import { Button } from '../../components/ui/Button'
import { useAuthStore } from '../../store/auth.store'

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length === 0) return ''
  if (d.length <= 3)  return `(${d}`
  if (d.length <= 6)  return `(${d.slice(0,3)}) ${d.slice(3)}`
  if (d.length <= 8)  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,8)}-${d.slice(8)}`
}

export function PhonePage() {
  const navigate = useNavigate()
  const { accessToken } = useAuthStore()
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (accessToken) return <Navigate to="/" replace />

  const phone = `+7${digits}`

  const mutation = useMutation({
    mutationFn: () => authApi.sendOtp(phone),
    onSuccess: () => navigate('/login/otp', { state: { phone } }),
    onError: (err: any) => setError(err?.response?.data?.error?.message ?? err.message),
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setDigits(e.target.value.replace(/\D/g, '').slice(0, 10))
  }

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
          <h2 className="font-semibold text-gray-900 mb-1">Вход</h2>
          <p className="text-sm text-gray-500 mb-5">Введите номер телефона сотрудника УК</p>

          <div className={`flex items-center border rounded-xl px-3 h-12 ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
            <span className="text-gray-600 text-sm mr-1">+7</span>
            <input
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none"
              placeholder="(900) 000-00-00"
              value={formatPhone(digits)}
              onChange={handleChange}
              autoFocus
              inputMode="numeric"
            />
          </div>

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          <Button
            className="w-full mt-4 justify-center h-11"
            onClick={() => digits.length === 10 && mutation.mutate()}
            disabled={digits.length < 10}
            loading={mutation.isPending}
          >
            Получить код
          </Button>
        </div>
      </div>
    </div>
  )
}
