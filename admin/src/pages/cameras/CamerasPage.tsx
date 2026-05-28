import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { camerasApi, type Camera, type CameraFormData } from '../../api/cameras'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

const emptyForm: CameraFormData = { name: '', rtspUrl: '', complexId: '', buildingId: '', entranceId: '' }

export function CamerasPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Camera | null>(null)
  const [form, setForm] = useState<CameraFormData>(emptyForm)
  const [editRtsp, setEditRtsp] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => camerasApi.list(),
  })

  const createMut = useMutation({
    mutationFn: () => camerasApi.create({
      name: form.name,
      rtspUrl: form.rtspUrl,
      complexId: form.complexId || undefined,
      buildingId: form.buildingId || undefined,
      entranceId: form.entranceId || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cameras'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: () => camerasApi.update(editing!.id, { name: form.name, ...(editRtsp ? { rtspUrl: editRtsp } : {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cameras'] }); closeModal() },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => camerasApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => camerasApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cameras'] }),
  })

  function openCreate() { setEditing(null); setForm(emptyForm); setEditRtsp(''); setModalOpen(true) }
  function openEdit(c: Camera) {
    setEditing(c)
    setForm({ name: c.name, rtspUrl: '', complexId: c.complexId ?? '', buildingId: c.buildingId ?? '', entranceId: c.entranceId ?? '' })
    setEditRtsp('')
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditing(null); setForm(emptyForm); setEditRtsp('') }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Камеры</h1>
        <Button onClick={openCreate}>+ Добавить</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Название', 'Статус', 'Stream URL', 'Привязка', 'Действия'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Загрузка...</td></tr>
            )}
            {data?.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3">
                  <Badge color={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Активна' : 'Отключена'}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate text-xs font-mono">
                  {c.streamUrl ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {c.complexId ? `ЖК: ${c.complexId.slice(-8)}` : c.buildingId ? `Дом: ${c.buildingId.slice(-8)}` : c.entranceId ? `Подъезд: ${c.entranceId.slice(-8)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary"
                      loading={toggleMut.isPending && toggleMut.variables?.id === c.id}
                      onClick={() => toggleMut.mutate({ id: c.id, isActive: !c.isActive })}>
                      {c.isActive ? 'Откл' : 'Вкл'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>✏️</Button>
                    <Button size="sm" variant="danger"
                      loading={deleteMut.isPending && deleteMut.variables === c.id}
                      onClick={() => confirm('Удалить камеру?') && deleteMut.mutate(c.id)}>
                      🗑️
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Редактировать камеру' : 'Новая камера'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Отмена</Button>
            <Button loading={createMut.isPending || updateMut.isPending}
              onClick={() => editing ? updateMut.mutate() : createMut.mutate()}>
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Название</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {editing ? (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Новый RTSP URL (оставьте пустым чтобы не менять)</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="rtsp://..."
                value={editRtsp} onChange={e => setEditRtsp(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">RTSP URL</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="rtsp://..."
                  value={form.rtspUrl} onChange={e => setForm(f => ({ ...f, rtspUrl: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">ID жилого комплекса (необязательно)</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.complexId} onChange={e => setForm(f => ({ ...f, complexId: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">ID здания (необязательно)</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.buildingId} onChange={e => setForm(f => ({ ...f, buildingId: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">ID подъезда (необязательно)</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.entranceId} onChange={e => setForm(f => ({ ...f, entranceId: e.target.value }))} />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
