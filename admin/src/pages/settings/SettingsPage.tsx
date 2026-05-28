import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationsApi } from '../../api/organizations'
import { useAuthStore } from '../../store/auth.store'
import { Button } from '../../components/ui/Button'

export function SettingsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const orgId = user?.organizationId

  const { data, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: () => organizationsApi.get(orgId!),
    enabled: !!orgId,
  })

  const [form, setForm] = useState({ name: '', inn: '', phone: '', email: '', address: '', logoUrl: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) {
      setForm({
        name:    data.name ?? '',
        inn:     data.inn ?? '',
        phone:   data.phone ?? '',
        email:   data.email ?? '',
        address: data.address ?? '',
        logoUrl: data.logoUrl ?? '',
      })
    }
  }, [data])

  const updateMut = useMutation({
    mutationFn: () => organizationsApi.update(orgId!, {
      name:    form.name || undefined,
      inn:     form.inn || undefined,
      phone:   form.phone || undefined,
      email:   form.email || undefined,
      address: form.address || undefined,
      logoUrl: form.logoUrl || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organization', orgId] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  if (!orgId) return (
    <div className="p-6">
      <p className="text-gray-500">Ваш аккаунт не привязан к организации.</p>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Настройки организации</h1>

      {isLoading && <div className="text-gray-400">Загрузка...</div>}

      {data && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          {[
            { key: 'name',    label: 'Название организации', placeholder: 'ООО УК Ромашка' },
            { key: 'inn',     label: 'ИНН', placeholder: '1234567890' },
            { key: 'phone',   label: 'Телефон', placeholder: '+7 (900) 000-00-00' },
            { key: 'email',   label: 'Email', placeholder: 'info@uk.ru' },
            { key: 'address', label: 'Адрес', placeholder: 'г. Москва, ул. Примерная, 1' },
            { key: 'logoUrl', label: 'URL логотипа', placeholder: 'https://...' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <Button loading={updateMut.isPending} onClick={() => updateMut.mutate()}>
              Сохранить
            </Button>
            {saved && <span className="text-sm text-green-600 font-medium">✓ Сохранено</span>}
            {updateMut.isError && <span className="text-sm text-red-500">Ошибка сохранения</span>}
          </div>
        </div>
      )}
    </div>
  )
}
