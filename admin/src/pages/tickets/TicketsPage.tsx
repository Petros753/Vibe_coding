import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi, type Ticket, type TicketDetail, type TicketStatus, type TicketCategory } from '../../api/tickets'
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

// ── "Seen" state: track comment count per ticket at time of last open ──────────

const STORAGE_KEY = 'moidom-ticket-seen'

interface SeenEntry { commentCount: number; seenAt: string }

function loadSeen(): Record<string, SeenEntry> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

function saveSeen(state: Record<string, SeenEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function useSeenState() {
  const [seen, setSeen] = useState<Record<string, SeenEntry>>(loadSeen)

  function markSeen(t: Ticket) {
    setSeen(prev => {
      const next = { ...prev, [t.id]: { commentCount: t._count.comments, seenAt: new Date().toISOString() } }
      saveSeen(next)
      return next
    })
  }

  function hasNewComments(t: Ticket): boolean {
    const entry = seen[t.id]
    if (!entry) return t._count.comments > 0
    return t._count.comments > entry.commentCount
  }

  return { markSeen, hasNewComments }
}

// ── New comment badge on individual comments in detail modal ──────────────────

const TWENTY_FOUR_H = 24 * 60 * 60 * 1000

function isNewResidentComment(createdAt: string, role: string): boolean {
  return role === 'RESIDENT' && Date.now() - new Date(createdAt).getTime() < TWENTY_FOUR_H
}

export function TicketsPage() {
  const qc = useQueryClient()
  const { markSeen, hasNewComments } = useSeenState()

  const [status, setStatus]         = useState<TicketStatus | ''>('')
  const [category, setCategory]     = useState<TicketCategory | ''>('')
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Ticket | null>(null)
  const [comment, setComment]       = useState('')
  const [newStatus, setNewStatus]   = useState<TicketStatus | ''>('')

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['ticket', selected?.id] })
    },
  })

  const commentMut = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => ticketsApi.addComment(id, text, true),
    onSuccess: () => {
      setComment('')
      qc.invalidateQueries({ queryKey: ['ticket', selected?.id] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  function openTicket(t: Ticket) {
    setSelected(t)
    markSeen(t)
  }

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
            {data?.data.map(t => {
              const isNew = hasNewComments(t)
              return (
                <tr
                  key={t.id}
                  className={`hover:bg-gray-50 cursor-pointer ${isNew ? 'border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                  onClick={() => openTicket(t)}
                >
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-gray-900 truncate ${isNew ? 'font-semibold' : ''}`}>
                        {t.title}
                      </span>
                      {isNew && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                          Новый комментарий
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{catLabel(t.category)}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(t.status)}>{statusLabel(t.status)}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{t.creator.phone}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(t.createdAt).toLocaleDateString('ru')}</td>
                  <td className="px-4 py-3 text-primary-600 text-xs">Открыть</td>
                </tr>
              )
            })}
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
          <TicketDetailContent
            detail={detailQ.data}
            comment={comment}
            setComment={setComment}
            newStatus={newStatus}
            setNewStatus={setNewStatus}
            statusMut={statusMut}
            commentMut={commentMut}
          />
        )}
        {detailQ.isLoading && <p className="text-sm text-gray-400">Загрузка...</p>}
      </Modal>
    </div>
  )
}

// ── Ticket detail content extracted to avoid inline complexity ─────────────────

function TicketDetailContent({
  detail, comment, setComment, newStatus, setNewStatus, statusMut, commentMut,
}: {
  detail: TicketDetail
  comment: string
  setComment: (v: string) => void
  newStatus: TicketStatus | ''
  setNewStatus: (v: TicketStatus | '') => void
  statusMut: any
  commentMut: any
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={statusColor(detail.status)}>{statusLabel(detail.status)}</Badge>
        <Badge color="gray">{catLabel(detail.category)}</Badge>
        {detail.assignee && (
          <Badge color="purple">Исполнитель: {detail.assignee.firstName ?? detail.assignee.id}</Badge>
        )}
      </div>

      <p className="text-sm text-gray-700">{detail.description}</p>

      <div>
        <label className="text-xs text-gray-500 font-medium mb-1 block">Сменить статус</label>
        <div className="flex gap-2 flex-wrap">
          {NEXT_STATUSES[detail.status].map(s => (
            <Button
              key={s}
              variant="secondary"
              size="sm"
              loading={statusMut.isPending && newStatus === s}
              onClick={() => { setNewStatus(s); statusMut.mutate({ id: detail.id, s }) }}
            >
              {statusLabel(s)}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 font-medium mb-2">Комментарии ({detail.comments.length})</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {detail.comments.map(c => {
            const isNewFromResident = isNewResidentComment(c.createdAt, c.author.role ?? '')
            return (
              <div
                key={c.id}
                className={`rounded-lg p-3 text-sm border ${
                  isNewFromResident
                    ? 'bg-blue-50 border-blue-200'
                    : c.isInternal
                    ? 'bg-yellow-50 border-yellow-100'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-700">{c.author.firstName ?? c.author.role}</span>
                  {isNewFromResident && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                      Новый
                    </span>
                  )}
                  {c.isInternal && <Badge color="yellow">внутренний</Badge>}
                  <span className="text-xs text-gray-400 ml-auto">{new Date(c.createdAt).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-gray-600">{c.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Добавить внутренний комментарий..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && comment.trim() && commentMut.mutate({ id: detail.id, text: comment })}
        />
        <Button
          size="sm"
          loading={commentMut.isPending}
          disabled={!comment.trim()}
          onClick={() => commentMut.mutate({ id: detail.id, text: comment })}
        >
          Отправить
        </Button>
      </div>
    </div>
  )
}
