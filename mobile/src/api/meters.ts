import { api } from './client'

export type MeterType = 'COLD_WATER' | 'HOT_WATER' | 'ELECTRICITY' | 'GAS' | 'HEAT'

export interface MeterReading {
  id:          string
  value:       number
  period:      string
  imageUrl:    string | null
  submittedAt: string
}

export interface Meter {
  id:           string
  type:         MeterType
  serialNumber: string | null
  isActive:     boolean
  readings:     MeterReading[]
}

export interface SubmitReadingDto {
  value:    number
  period:   string
  imageUrl?: string
}

export const metersApi = {
  getByApartment: (apartmentId: string) =>
    api
      .get<{ data: Meter[] }>('/meters', { params: { apartmentId } })
      .then((r) => r.data.data),

  submitReading: (meterId: string, data: SubmitReadingDto) =>
    api
      .post<{ data: MeterReading }>(`/meters/${meterId}/readings`, data)
      .then((r) => r.data.data),
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export const METER_LABEL: Record<MeterType, string> = {
  COLD_WATER:  'Холодная вода',
  HOT_WATER:   'Горячая вода',
  ELECTRICITY: 'Электричество',
  GAS:         'Газ',
  HEAT:        'Теплоснабжение',
}

export const METER_UNIT: Record<MeterType, string> = {
  COLD_WATER:  'м³',
  HOT_WATER:   'м³',
  ELECTRICITY: 'кВт·ч',
  GAS:         'м³',
  HEAT:        'Гкал',
}

export const METER_EMOJI: Record<MeterType, string> = {
  COLD_WATER:  '🔵',
  HOT_WATER:   '🔴',
  ELECTRICITY: '⚡',
  GAS:         '🔥',
  HEAT:        '🌡️',
}

export const METER_COLOR: Record<MeterType, { bg: string; text: string; border: string }> = {
  COLD_WATER:  { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100'   },
  HOT_WATER:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100'    },
  ELECTRICITY: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' },
  GAS:         { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  HEAT:        { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
}
