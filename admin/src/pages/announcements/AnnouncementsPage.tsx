import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { announcementsApi, type Announcement, type AnnouncementStatus } from '../../api/announcements'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

const STATUS_OPTIONS: { value: AnnouncementStatus | ''; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'DRAFT', label: 'Черновики' },
  { value: 'PUBLISHED', label: 'Опубликованы' },
  { value: 'ARCHIVED', label: 'Архив' },
]

const statusColor: Record<AnnouncementStatus, any> = {
  DRAFT: 'gray', PUBLISHED: 'green', ARCHIVED: 'yellow',
}
const statusLabel: Record<AnnouncementStatus, string> = {
  DRAFT: 'Черновик', PUBLISHED: 'Опубликовано', ARCHIVED: 'Архив',
}

const emptyForm = { title: '', body: '', imageUrl: '', isPinned: false }

export function AnnouncementsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<AnnouncementStatus | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', filter],
    queryFn: () => announcementsApi.list({ status: filter || undefined, limit: 50 }),
  })

  const createMut = useMutation({
    mutationFn: () => announcementsApi.create({ title: form.title, body: form.body, isPinned: form.isPinned, imageUrl: form.imageUrl || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); closeModal() },
  })

  // Creates a draft and immediately publishes it — this triggers push to all residents
  const createAndPublishMut = useMutation({
    mutationFn: async () => {
      const announcement = await announcementsApi.create({ title: form.title, body: form.body, isPinned: form.isPinned, imageUrl: form.imageUrl || undefined })
      await announcementsApi.publish(announcement.id)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: () => announcementsApi.update(editing!.id, { title: form.title, body: form.body, isPinned: form.isPinned }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcements'] }); closeModal() },
  })

  const publishMut = useMutation({
    mutationFn: (id: string) => announcementsApi.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const archiveMut = useMutation({
    mutationFn: (id: string) => announcementsApi.update(id, { status: 'ARCHIVED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const pinMut = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) => announcementsApi.update(id, { isPinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  function openCreate() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(a: Announcement) { setEditing(a); setForm({ title: a.title, body: a.body, imageUrl: a.imageUrl ?? '', isPinned: a.isPinned }); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null); setForm(emptyForm) }

  const isSaving = createMut.isPending || updateMut.isPending || createAndPublishMut.isPending

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Объявления</h1>
        <Button onClick={openCreate}>+ Создать</Button>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_OPTIONS.map(o => (
          <button key={o.value} onClick={() => setFilter(o.value as any)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === o.value ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && <div className="text-center text-gray-400 py-8">Загрузка...</div>}
        {data?.data.map(a => (
          <div key={a.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color={statusColor[a.status]}>{statusLabel[a.status]}</Badge>
                  {a.isPinned && <Badge color="blue">📌 Закреплено</Badge>}
                  <span className="text-xs text-gray-400 ml-auto">{new Date(a.createdAt).toLocaleDateString('ru')}</span>
                </div>
                <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.body}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {a.status === 'DRAFT' && (
                  <Button size="sm" loading={publishMut.isPending && publishMut.variables === a.id} onClick={() => publishMut.mutate(a.id)}>
                    Опубликовать
                  </Button>
                )}
                {a.status === 'PUBLISHED' && (
                  <Button size="sm" variant="secondary"
                    loading={pinMut.isPending && pinMut.variables?.id === a.id}
                    onClick={() => pinMut.mutate({ id: a.id, isPinned: !a.isPinned })}>
                    {a.isPinned ? 'Открепить' : 'Закрепить'}
                  </Button>
                )}
                {a.status === 'PUBLISHED' && (
                  <Button size="sm" variant="secondary"
                    loading={archiveMut.isPending && archiveMut.variables === a.id}
                    onClick={() => archiveMut.mutate(a.id)}>
                    В архив
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>✏️</Button>
                <Button size="sm" variant="danger"
                  loading={deleteMut.isPending && deleteMut.variables === a.id}
                  onClick={() => confirm('Удалить объявление?') && deleteMut.mutate(a.id)}>
                  🗑️
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Редактировать объявление' : 'Новое объявление'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Отмена</Button>
            <Button
              variant="secondary"
              loading={createMut.isPending || updateMut.isPending}
              disabled={isSaving}
              onClick={() => editing ? updateMut.mutate() : createMut.mutate()}
            >
              {editing ? 'Сохранить' : 'Черновик'}
            </Button>
            {!editing && (
              <Button
                loading={createAndPublishMut.isPending}
                disabled={isSaving}
                onClick={() => createAndPublishMut.mutate()}
              >
                Опубликовать 🔔
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Заголовок</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Текст</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={5}
              value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Ссылка на изображение (необязательно)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.imageUrl}
              onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} />
            <span className="text-sm text-gray-700">Закрепить объявление</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
