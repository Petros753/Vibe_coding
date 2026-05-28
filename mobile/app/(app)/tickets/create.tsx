import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { ticketsApi, TicketCategory, CATEGORY_LABEL, CATEGORY_EMOJI } from '../../../src/api/tickets'

const CATEGORIES = Object.entries(CATEGORY_LABEL) as [TicketCategory, string][]

export default function CreateTicketScreen() {
  const router        = useRouter()
  const queryClient   = useQueryClient()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [category,    setCategory]    = useState<TicketCategory>('OTHER')
  const [images,      setImages]      = useState<ImagePicker.ImagePickerAsset[]>([])
  const [errors,      setErrors]      = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => ticketsApi.create({
      title:       title.trim(),
      description: description.trim(),
      category,
      mediaUrls:   [],  // upload endpoint needed for real URLs
    }),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      router.replace(`/(app)/tickets/${ticket.id}`)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Не удалось создать заявку'
      Alert.alert('Ошибка', msg)
    },
  })

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (title.trim().length < 5)        e.title       = 'Минимум 5 символов'
    if (description.trim().length < 10) e.description = 'Минимум 10 символов'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках телефона')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 5 - images.length,
    })
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 5))
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках телефона')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    })
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 5))
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    if (validate()) mutation.mutate()
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate-100">
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg text-slate-700">‹</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900 flex-1">Новая заявка</Text>
          <TouchableOpacity
            className={`px-4 py-1.5 rounded-full ${
              mutation.isPending ? 'bg-slate-200' : 'bg-primary-600'
            }`}
            onPress={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-sm font-semibold text-white">Отправить</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardDismissMode="on-drag"
        >
          {/* ── Title ─────────────────────────────────────────────────── */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Краткое описание проблемы *
            </Text>
            <TextInput
              className={`bg-white rounded-xl px-4 py-3 text-sm text-slate-900 border ${
                errors.title ? 'border-red-300' : 'border-slate-100'
              }`}
              placeholder="Например: Течёт кран на кухне"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={(t) => { setTitle(t); setErrors((e) => ({ ...e, title: '' })) }}
              maxLength={200}
              returnKeyType="next"
            />
            {errors.title && <Text className="text-xs text-red-500 mt-1">{errors.title}</Text>}
            <Text className="text-xs text-slate-400 mt-1 text-right">{title.length}/200</Text>
          </View>

          {/* ── Category ──────────────────────────────────────────────── */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Категория
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full border ${
                    category === key
                      ? 'bg-primary-600 border-primary-600'
                      : 'bg-white border-slate-200'
                  }`}
                  onPress={() => setCategory(key)}
                >
                  <Text className="text-sm">{CATEGORY_EMOJI[key]}</Text>
                  <Text className={`text-xs font-medium ${
                    category === key ? 'text-white' : 'text-slate-600'
                  }`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Description ───────────────────────────────────────────── */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Подробное описание *
            </Text>
            <TextInput
              className={`bg-white rounded-xl px-4 py-3 text-sm text-slate-900 border min-h-[120px] ${
                errors.description ? 'border-red-300' : 'border-slate-100'
              }`}
              placeholder="Опишите проблему подробнее: когда появилась, где именно, что пробовали делать..."
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={(t) => { setDescription(t); setErrors((e) => ({ ...e, description: '' })) }}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            {errors.description && (
              <Text className="text-xs text-red-500 mt-1">{errors.description}</Text>
            )}
            <Text className="text-xs text-slate-400 mt-1 text-right">{description.length}/2000</Text>
          </View>

          {/* ── Photo attachments ─────────────────────────────────────── */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Фото {images.length > 0 ? `(${images.length}/5)` : '(необязательно)'}
            </Text>

            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                <View className="flex-row gap-2">
                  {images.map((img, i) => (
                    <View key={i} className="relative">
                      <Image
                        source={{ uri: img.uri }}
                        className="w-24 h-24 rounded-xl"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                        onPress={() => removeImage(i)}
                      >
                        <Text className="text-white text-xs font-bold">✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {images.length < 5 && (
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded-xl h-12"
                  onPress={pickImage}
                >
                  <Text className="text-base">🖼️</Text>
                  <Text className="text-sm text-slate-500">Из галереи</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded-xl h-12"
                  onPress={takePhoto}
                >
                  <Text className="text-base">📷</Text>
                  <Text className="text-sm text-slate-500">Камера</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Note ──────────────────────────────────────────────────── */}
          <View className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <Text className="text-xs text-blue-600 leading-4">
              После отправки заявки вы получите уведомление при изменении статуса.
              Среднее время ответа — 1 рабочий день.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
