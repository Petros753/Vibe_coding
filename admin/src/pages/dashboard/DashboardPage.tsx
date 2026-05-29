import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ticketsApi, type TicketStatus } from '../../api/tickets'
import { residentsApi } from '../../api/residents'
import { announcementsApi } from '../../api/announcements'
import { Badge } from '../../components/ui/Badge'

const STATUSES: { status: TicketStatus; label: string; color: 'gray' | 'blue' | 'yellow' | 'green' | 'red' }[] = [
  { status: 'OPEN',        label: 'Новые',      color: 'blue' },
  { status: 'IN_PROGRESS', label: 'В работе',   color: 'yellow' },
  { status: 'WAITING',     label: 'Ожидание',   color: 'purple' as any },
  { status: 'RESOLVED',    label: 'Решены',     color: 'green' },
  { status: 'CLOSED',      label: 'Закрыты',    color: 'gray' },
]

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

const REFETCH = { refetchInterval: 30_000, refetchIntervalInBackground: true }

export function DashboardPage() {
  const openQ     = useQuery({ queryKey: ['tickets', 'OPEN'],        queryFn: () => ticketsApi.list({ status: 'OPEN', limit: 1 }),        ...REFETCH })
  const inProgQ   = useQuery({ queryKey: ['tickets', 'IN_PROGRESS'], queryFn: () => ticketsApi.list({ status: 'IN_PROGRESS', limit: 1 }), ...REFETCH })
  const waitQ     = useQuery({ queryKey: ['tickets', 'WAITING'],     queryFn: () => ticketsApi.list({ status: 'WAITING', limit: 1 }),     ...REFETCH })
  const resolvedQ = useQuery({ queryKey: ['tickets', 'RESOLVED'],    queryFn: () => ticketsApi.list({ status: 'RESOLVED', limit: 1 }),    ...REFETCH })
  const residentsQ = useQuery({ queryKey: ['residents'],              queryFn: () => residentsApi.list(),                                  ...REFETCH })
  const announcQ  = useQuery({ queryKey: ['announcements', 'PUBLISHED'], queryFn: () => announcementsApi.list({ status: 'PUBLISHED', limit: 1 }), ...REFETCH })
  const recentQ   = useQuery({ queryKey: ['tickets', 'recent'],      queryFn: () => ticketsApi.list({ limit: 10 }),                       ...REFETCH })

  const pendingCount = (openQ.data?.meta.total ?? 0) + (inProgQ.data?.meta.total ?? 0) + (waitQ.data?.meta.total ?? 0)

  const [lastUpdated, setLastUpdated] = useState(new Date())
  const isFetching = openQ.isFetching || inProgQ.isFetching || recentQ.isFetching
  useEffect(() => {
    if (!isFetching) setLastUpdated(new Date())
  }, [isFetching])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Дашборд</h1>
        <span className="text-xs text-gray-400">
          {isFetching ? 'Обновляется...' : `Обновлено ${lastUpdated.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Активных заявок" value={pendingCount} sub="OPEN + IN_PROGRESS + WAITING" />
        <StatCard label="Жильцов" value={residentsQ.data?.length ?? '—'} />
        <StatCard label="Объявлений" value={announcQ.data?.meta.total ?? '—'} sub="опубликованных" />
        <StatCard label="Решено заявок" value={resolvedQ.data?.meta.total ?? '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {STATUSES.map(({ status, label, color }) => {
          const counts: Record<TicketStatus, number> = {
            OPEN:        openQ.data?.meta.total ?? 0,
            IN_PROGRESS: inProgQ.data?.meta.total ?? 0,
            WAITING:     waitQ.data?.meta.total ?? 0,
            RESOLVED:    resolvedQ.data?.meta.total ?? 0,
            CLOSED:      0,
          }
          return (
            <div key={status} className="bg-white rounded-xl px-5 py-4 shadow-sm flex items-center justify-between">
              <Badge color={color}>{label}</Badge>
              <span className="text-2xl font-bold text-gray-900">{counts[status]}</span>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Последние заявки</h2>
        </div>
        <div className="divide-y">
          {recentQ.data?.data.map(t => (
            <div key={t.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t.title}</p>
                <p className="text-xs text-gray-400">{t.creator.phone} · {new Date(t.createdAt).toLocaleDateString('ru')}</p>
              </div>
              <Badge color={statusColor(t.status)}>{statusLabel(t.status)}</Badge>
            </div>
          ))}
          {recentQ.isLoading && <div className="px-5 py-4 text-sm text-gray-400">Загрузка...</div>}
        </div>
      </div>
    </div>
  )
}

function statusLabel(s: TicketStatus) {
  return { OPEN: 'Новая', IN_PROGRESS: 'В работе', WAITING: 'Ожидание', RESOLVED: 'Решена', CLOSED: 'Закрыта' }[s]
}
function statusColor(s: TicketStatus): 'blue' | 'yellow' | 'purple' | 'green' | 'gray' {
  return { OPEN: 'blue', IN_PROGRESS: 'yellow', WAITING: 'purple', RESOLVED: 'green', CLOSED: 'gray' }[s] as any
}
