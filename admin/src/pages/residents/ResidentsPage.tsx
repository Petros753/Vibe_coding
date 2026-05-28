import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { residentsApi } from '../../api/residents'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

export function ResidentsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all')

  const params = filter === 'verified' ? { isVerified: true } : filter === 'unverified' ? { isVerified: false } : undefined
  const { data, isLoading } = useQuery({
    queryKey: ['residents', filter],
    queryFn: () => residentsApi.list(params),
  })

  const verifyMut = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => residentsApi.verify(id, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['residents'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => residentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['residents'] }),
  })

  const accessLabel = (a: string) => ({ OWNER: 'Собственник', TENANT: 'Арендатор', FAMILY_MEMBER: 'Член семьи' }[a] ?? a)

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Жильцы</h1>

      <div className="flex gap-2 mb-4">
        {(['all', 'unverified', 'verified'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {{ all: 'Все', unverified: 'Не верифицированы', verified: 'Верифицированы' }[f]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Жилец', 'Телефон', 'Квартира', 'Тип', 'Статус', 'Действия'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Загрузка...</td></tr>
            )}
            {data?.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {r.user.firstName && r.user.lastName
                    ? `${r.user.lastName} ${r.user.firstName}`
                    : r.user.firstName ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{r.user.phone}</td>
                <td className="px-4 py-3 text-gray-500">
                  кв. {r.apartment.number}, {r.apartment.entrance.building.address}
                </td>
                <td className="px-4 py-3 text-gray-500">{accessLabel(r.accessLevel)}</td>
                <td className="px-4 py-3">
                  {r.isVerified
                    ? <Badge color="green">Верифицирован</Badge>
                    : <Badge color="yellow">Ожидает</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {!r.isVerified ? (
                      <Button
                        size="sm"
                        loading={verifyMut.isPending && verifyMut.variables?.id === r.id}
                        onClick={() => verifyMut.mutate({ id: r.id, v: true })}
                      >
                        Подтвердить
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={verifyMut.isPending && verifyMut.variables?.id === r.id}
                        onClick={() => verifyMut.mutate({ id: r.id, v: false })}
                      >
                        Отозвать
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deleteMut.isPending && deleteMut.variables === r.id}
                      onClick={() => confirm('Удалить жильца?') && deleteMut.mutate(r.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
