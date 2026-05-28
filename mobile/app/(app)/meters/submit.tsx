import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { metersApi, MeterType, METER_LABEL, METER_EMOJI, METER_UNIT, METER_COLOR } from '../../../src/api/meters'

export default function MeterSubmitScreen() {
  const router      = useRouter()
  const queryClient = useQueryClient()

  const {
    meterId,
    meterType,
    previousValue,
    period,
  } = useLocalSearchParams<{
    meterId:       string
    meterType:     MeterType
    previousValue: string
    period:        string
  }>()

  const prevVal    = previousValue ? parseFloat(previousValue) : null
  const colors     = METER_COLOR[meterType ?? 'COLD_WATER']
  const unit       = METER_UNIT[meterType ?? 'COLD_WATER']
  const label      = METER_LABEL[meterType ?? 'COLD_WATER']
  const emoji      = METER_EMOJI[meterType ?? 'COLD_WATER']

  const [valueText, setValueText] = useState('')
  const [photo,     setPhoto]     = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const value = parseFloat(valueText.replace(',', '.'))
      return metersApi.submitReading(meterId, { value, period })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] })
      router.back()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Не удалось сохранить показание'
      setError(msg)
    },
  })

  function validate(): boolean {
    const value = parseFloat(valueText.replace(',', '.'))
    if (!valueText || isNaN(value)) {
      setError('Введите числовое значение')
      return false
    }
    if (value <= 0) {
      setError('Показание должно быть больше 0')
      return false
    }
    if (prevVal !== null && value < prevVal) {
      setError(`Показание не может быть меньше предыдущего (${prevVal} ${unit})`)
      return false
    }
    return true
  }

  function handleSubmit() {
    setError(null)
    if (validate()) mutation.mutate()
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (!result.canceled) setPhoto(result.assets[0])
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
    if (!result.canceled) setPhoto(result.assets[0])
  }

  const value      = parseFloat(valueText.replace(',', '.'))
  const isValid    = !isNaN(value) && value > 0 && (prevVal === null || value >= prevVal)
  const difference = prevVal !== null && !isNaN(value) && value >= prevVal
    ? (value - prevVal).toFixed(3)
    : null

  const [periodYear, periodMonth] = period?.split('-') ?? ['', '']
  const periodLabel = period
    ? new Date(`${periodYear}-${periodMonth}-01`).toLocaleDateString('ru-RU', {
        month: 'long', year: 'numeric',
      })
    : ''

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg text-slate-700">‹</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-bold text-slate-900">Передать показание</Text>
            <Text className="text-xs text-slate-400 capitalize">{periodLabel}</Text>
          </View>
          <TouchableOpacity
            className={`px-4 py-1.5 rounded-full ${isValid && !mutation.isPending ? 'bg-primary-600' : 'bg-slate-200'}`}
            onPress={handleSubmit}
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className={`text-sm font-semibold ${isValid ? 'text-white' : 'text-slate-400'}`}>
                Сохранить
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardDismissMode="on-drag"
        >
          {/* ── Meter info ────────────────────────────────────────── */}
          <View className={`rounded-2xl border p-4 mb-5 ${colors.bg} ${colors.border}`}>
            <View className="flex-row items-center gap-3">
              <Text className="text-3xl">{emoji}</Text>
              <View>
                <Text className={`text-lg font-bold ${colors.text}`}>{label}</Text>
                <Text className="text-xs text-slate-500">Единица измерения: {unit}</Text>
              </View>
            </View>
          </View>

          {/* ── Previous reading ─────────────────────────────────── */}
          {prevVal !== null && (
            <View className="bg-white rounded-xl px-4 py-3 mb-4 border border-slate-100">
              <Text className="text-xs text-slate-500 mb-1">Предыдущее показание</Text>
              <Text className="text-xl font-bold text-slate-700">
                {prevVal.toLocaleString('ru-RU')}
                <Text className="text-sm font-normal text-slate-400"> {unit}</Text>
              </Text>
              <Text className="text-xs text-slate-400 mt-0.5">
                Новое значение должно быть ≥ {prevVal} {unit}
              </Text>
            </View>
          )}

          {/* ── Value input ──────────────────────────────────────── */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Новое показание *
            </Text>
            <View className={`
              flex-row items-center bg-white border rounded-xl px-4 h-16
              ${error ? 'border-red-300' : 'border-slate-200'}
            `}>
              <TextInput
                className="flex-1 text-3xl font-bold text-slate-900"
                placeholder="0.000"
                placeholderTextColor="#CBD5E1"
                keyboardType="decimal-pad"
                value={valueText}
                onChangeText={(t) => {
                  setValueText(t)
                  setError(null)
                }}
                autoFocus
              />
              <Text className="text-base text-slate-400 ml-2">{unit}</Text>
            </View>
            {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
          </View>

          {/* ── Consumption diff ─────────────────────────────────── */}
          {difference !== null && (
            <View className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4">
              <Text className="text-xs text-green-600">
                Расход за период: <Text className="font-bold">{difference} {unit}</Text>
              </Text>
            </View>
          )}

          {/* ── Photo ────────────────────────────────────────────── */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Фото счётчика (необязательно)
            </Text>

            {photo ? (
              <View className="relative">
                <Image
                  source={{ uri: photo.uri }}
                  className="w-full h-48 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full items-center justify-center"
                  onPress={() => setPhoto(null)}
                >
                  <Text className="text-white text-xs font-bold">✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded-xl h-12"
                  onPress={pickPhoto}
                >
                  <Text className="text-base">📷</Text>
                  <Text className="text-sm text-slate-500">Сфотографировать</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded-xl h-12"
                  onPress={pickFromGallery}
                >
                  <Text className="text-base">🖼️</Text>
                  <Text className="text-sm text-slate-500">Из галереи</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
