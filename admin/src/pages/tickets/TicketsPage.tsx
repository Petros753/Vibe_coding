import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi, type Ticket, type TicketStatus, type TicketCategory } from '../../api/tickets'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

const STATUS_OPTIONS: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: 'Все статусы' },
  { value: 'OPEN', label: 'Новые' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'WAITING', label: 'Ожидание' },
  { value: 'RESOLVED', label: 'Решены' },
  { value: 'CLOSED', label: 'Закрыты' },
]

const CAT_OPTIONS: { value: TicketCategory | ''; label: string }[] = [
  { value: '', label: 'Все категории' },
  { value: 'PLUMBING', label: 'Сантехника' },
  { value: 'ELECTRICAL', label: 'Электрика' },
  { value: 'ELEVATOR', label: 'Лифт' },
  { value: 'INTERCOM', label: 'Домофон' },
  { value: 'CLEANING', label: 'Уборка' },
  { value: 'SECURITY', label: 'Безопасность' },
  { value: 'PARKING', label: 'Парковка' },
  { value: 'OTHER', label: 'Прочее' },
]

const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  OPEN:        ['IN_PROGRESS', 'WAITING', 'CLOSED'],
  IN_PROGRESS: ['WAITING', 'RESOLVED', 'CLOSED'],
  WAITING:     ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED:    ['CLOSED', 'OPEN'],
  CLOSED:      ['OPEN'],
}

function statusLabel(s: TicketStatus) {
  return { OPEN: 'Новая', IN_PROGRESS: 'В работе', WAITING: 'Ожидание', RESOLVED: 'Решена', CLOSED: 'Закрыта' }[s]
}
function statusColor(s: TicketStatus): any {
  return { OPEN: 'blue', IN_PROGRESS: 'yellow', WAITING: 'purple', RESOLVED: 'green', CLOSED: 'gray' }[s]
}
function catLabel(c: TicketCategory) {
  return { PLUMBING: 'Сантехника', ELECTRICAL: 'Электрика', ELEVATOR: 'Лифт', INTERCOM: 'Домофон', CLEANING: 'Уборка', SECURITY: 'Безопасность', PARKING: 'Парковка', OTHER: 'Прочее' }[c]
}

export function TicketsPage() {
  const qc = useQueryClient()
  const [status, setStatus]     = useState<TicketStatus | ''>('')
  const [category, setCategory] = useState<TicketCategory | ''>('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [comment, setComment]   = useState('')
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', status, category, page],
    queryFn: () => ticketsApi.list({ status: status || undefined, category: category || undefined, page, limit: 20 }),
  })

  const detailQ = useQuery({
    queryKey: ['ticket', selected?.id],
    queryFn: () => ticketsApi.get(selected!.id),
    enabled: !!selected,
  })

  const statusMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: TicketStatus }) => ticketsApi.updateStatus(id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); qc.invalidateQueries({ queryKey: ['ticket', selected?.id] }) },
  })

  const commentMut = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => ticketsApi.addComment(id, text, true),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['ticket', selected?.id] }) },
  })

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Заявки</h1>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={status} onChange={e => { setStatus(e.target.value as any); setPage(1) }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={category} onChange={e => { setCategory(e.target.value as any); setPage(1) }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Заявка', 'Категория', 'Статус', 'Жилец', 'Дата', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Загрузка...</td></tr>
            )}
            {data?.data.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(t)}>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                <td className="px-4 py-3 text-gray-500">{catLabel(t.category)}</td>
                <td className="px-4 py-3"><Badge color={statusColor(t.status)}>{statusLabel(t.status)}</Badge></td>
                <td className="px-4 py-3 text-gray-500">{t.creator.phone}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(t.createdAt).toLocaleDateString('ru')}</td>
                <td className="px-4 py-3 text-primary-600 text-xs">Открыть</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.meta.totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>Страница {page} из {data.meta.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</Button>
              <Button variant="secondary" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>→</Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
      >
        {detailQ.data && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color={statusColor(detailQ.data.status)}>{statusLabel(detailQ.data.status)}</Badge>
              <Badge color="gray">{catLabel(detailQ.data.category)}</Badge>
              {detailQ.data.assignee && (
                <Badge color="purple">Исполнитель: {detailQ.data.assignee.firstName ?? detailQ.data.assignee.id}</Badge>
              )}
            </div>

            <p className="text-sm text-gray-700">{detailQ.data.description}</p>

            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Сменить статус</label>
              <div className="flex gap-2 flex-wrap">
                {NEXT_STATUSES[detailQ.data.status].map(s => (
                  <Button
                    key={s}
                    variant="secondary"
                    size="sm"
                    loading={statusMut.isPending && newStatus === s}
                    onClick={() => { setNewStatus(s); statusMut.mutate({ id: detailQ.data.id, s }) }}
                  >
                    {statusLabel(s)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Комментарии ({detailQ.data.comments.length})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {detailQ.data.comments.map(c => (
                  <div key={c.id} className={`rounded-lg p-3 text-sm ${c.isInternal ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-700">{c.author.firstName ?? c.author.role}</span>
                      {c.isInternal && <Badge color="yellow">внутренний</Badge>}
                      <span className="text-xs text-gray-400 ml-auto">{new Date(c.createdAt).toLocaleDateString('ru')}</span>
                    </div>
                    <p className="text-gray-600">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Добавить внутренний комментарий..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <Button
                size="sm"
                loading={commentMut.isPending}
                disabled={!comment.trim()}
                onClick={() => commentMut.mutate({ id: detailQ.data.id, text: comment })}
              >
                Отправить
              </Button>
            </div>
          </div>
        )}
        {detailQ.isLoading && <p className="text-sm text-gray-400">Загрузка...</p>}
      </Modal>
    </div>
  )
}
