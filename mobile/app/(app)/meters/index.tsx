import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { profileApi } from '../../../src/api/profile'
import {
  metersApi, Meter,
  METER_LABEL, METER_UNIT, METER_EMOJI, METER_COLOR,
} from '../../../src/api/meters'

function currentPeriod(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function MeterCard({ meter, onSubmit }: { meter: Meter; onSubmit: () => void }) {
  const lastReading = meter.readings[0]
  const colors      = METER_COLOR[meter.type]
  const period      = currentPeriod()
  const submittedThisMonth = meter.readings.some((r) => r.period === period)

  const lastDate = lastReading
    ? new Date(lastReading.submittedAt).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'short',
      })
    : null

  return (
    <View className={`mx-4 mb-3 rounded-2xl border p-4 ${colors.bg} ${colors.border}`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl">{METER_EMOJI[meter.type]}</Text>
          <View>
            <Text className={`text-sm font-bold ${colors.text}`}>{METER_LABEL[meter.type]}</Text>
            {meter.serialNumber && (
              <Text className="text-xs text-slate-400">№ {meter.serialNumber}</Text>
            )}
          </View>
        </View>

        {submittedThisMonth ? (
          <View className="bg-green-100 rounded-full px-2.5 py-0.5">
            <Text className="text-xs font-semibold text-green-700">✓ Сдано</Text>
          </View>
        ) : (
          <View className="bg-amber-100 rounded-full px-2.5 py-0.5">
            <Text className="text-xs font-semibold text-amber-700">⏳ Ожидание</Text>
          </View>
        )}
      </View>

      {lastReading ? (
        <View className="bg-white/60 rounded-xl p-3 mb-3">
          <Text className="text-xs text-slate-500 mb-0.5">Последнее показание</Text>
          <Text className="text-2xl font-bold text-slate-900">
            {lastReading.value.toLocaleString('ru-RU')}
            <Text className="text-base font-normal text-slate-500"> {METER_UNIT[meter.type]}</Text>
          </Text>
          {lastDate && (
            <Text className="text-xs text-slate-400 mt-0.5">{lastDate} · период {lastReading.period}</Text>
          )}
        </View>
      ) : (
        <View className="bg-white/60 rounded-xl p-3 mb-3">
          <Text className="text-sm text-slate-400">Показаний нет</Text>
        </View>
      )}

      <TouchableOpacity
        className="bg-white rounded-xl h-10 items-center justify-center border border-white/80 shadow-sm"
        onPress={onSubmit}
        activeOpacity={0.7}
      >
        <Text className={`text-sm font-semibold ${colors.text}`}>
          {submittedThisMonth ? 'Обновить показание' : 'Передать показание'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default function MetersScreen() {
  const router = useRouter()

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn:  profileApi.getProfile,
  })

  const apartmentId = profile?.residents?.[0]?.apartmentId ?? null

  const { data: meters, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['meters', apartmentId],
    queryFn:  () => metersApi.getByApartment(apartmentId!),
    enabled:  !!apartmentId,
  })

  const period = currentPeriod()
  const [year, month] = period.split('-')
  const periodLabel = new Date(`${year}-${month}-01`).toLocaleDateString('ru-RU', {
    month: 'long', year: 'numeric',
  })

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
          onPress={() => router.back()}
        >
          <Text className="text-lg text-slate-700">‹</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-slate-900">Счётчики</Text>
          <Text className="text-xs text-slate-400 capitalize">{periodLabel}</Text>
        </View>
      </View>

      {isLoading || !apartmentId ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2563EB" size="large" />
        </View>
      ) : (
        <FlatList
          data={meters ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MeterCard
              meter={item}
              onSubmit={() =>
                router.push({
                  pathname: '/(app)/meters/submit',
                  params: {
                    meterId:       item.id,
                    meterType:     item.type,
                    previousValue: String(item.readings[0]?.value ?? ''),
                    period,
                  },
                })
              }
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563EB" />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-4xl mb-3">📊</Text>
              <Text className="text-base font-semibold text-slate-700">Счётчиков нет</Text>
              <Text className="text-sm text-slate-400 mt-1 text-center px-8">
                Счётчики привязываются управляющей компанией
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View className="mx-4 mt-3 mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Text className="text-xs text-blue-600 leading-4">
                Показания принимаются с 20 по 25 число каждого месяца.
                После передачи показание учитывается при расчёте квитанции.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  )
}
