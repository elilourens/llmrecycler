<template>
  <UCard>
    <template #header>
      <div class="bg-gray-50 -mx-6 -my-4 px-6 py-4 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-highlighted">Keys Being Sold</h2>
        <UButton
          color="primary"
          @click="isOpen = true"
        >
          Add Key
        </UButton>
      </div>
    </template>

    <div class="max-h-48 overflow-y-auto">
      <UTable :data="keys" :columns="columns" :ui="{ td: 'text-xs', th: 'text-xs' }" sticky="header">
      <template #is_active-data="{ row }">
        <UBadge :color="row.original.is_active ? 'success' : 'neutral'" variant="subtle" class="text-xs">
          {{ row.original.is_active ? 'Active' : 'Inactive' }}
        </UBadge>
      </template>

      <template #key_hint-data="{ row }">
        <code class="text-xs text-muted bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
          {{ row.original.key_hint }}
        </code>
      </template>

      <template #provider-data="{ row }">
        <span class="text-xs">{{ row.original.provider }}</span>
      </template>
    </UTable>
    </div>

    <UModal v-model:open="isOpen" title="Add API Key" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-4">
          <UInput
            v-model="apiKey"
            placeholder="Paste or type your API key"
            type="password"
            class="w-full"
          />
          <div v-if="detectedProvider" class="space-y-2">
            <div class="text-sm text-muted">
              Detected: <span class="font-semibold text-highlighted">{{ detectedProvider }}</span>
            </div>
            <UAlert
              v-if="keyValidation"
              :color="keyValidation.isValid ? 'success' : 'error'"
              variant="subtle"
              :title="keyValidation.message"
              class="py-2"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton
            color="neutral"
            variant="outline"
            @click="isOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            :disabled="!!(detectedProvider && keyValidation && !keyValidation.isValid) || loading"
            :loading="loading"
            @click="handleAddKey"
          >
            Add
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
interface SellerKey {
  is_active: boolean
  key_hint: string
  provider: string
}

interface Props {
  keys: SellerKey[]
}

defineProps<Props>()

const isOpen = ref(false)
const apiKey = ref('')

const detectedProvider = computed(() => {
  const key = apiKey.value.trim().toLowerCase()

  if (!key) return null

  if (key.startsWith('sk-ant-')) return 'Anthropic Claude API Key'
  if (key.startsWith('sk-proj-') || key.startsWith('sk-')) {
    // Could be OpenAI or Grok, check more specifically
    if (key.includes('grok')) return 'xAI Grok API Key'
    return 'OpenAI API Key'
  }
  if (key.startsWith('aiza') || key.startsWith('aiz-')) return 'Google Gemini API Key'
  if (key.startsWith('xai-')) return 'xAI Grok API Key'
  if (key.startsWith('sk-')) return 'OpenAI API Key'
  if (key.includes('deepseek') || key.startsWith('sk_deepseek')) return 'Deepseek API Key'

  return null
})

const keyValidation = computed(() => {
  const key = apiKey.value.trim()
  const provider = detectedProvider.value

  if (!provider) return null

  // Valid characters: alphanumeric, hyphens, underscores
  const validCharacters = /^[a-zA-Z0-9\-_]+$/

  if (!validCharacters.test(key)) {
    return { isValid: false, message: 'Key contains invalid characters' }
  }

  // Provider-specific validation
  if (provider === 'Anthropic Claude API Key') {
    // Claude keys: sk-ant- prefix, typically 80+ characters
    if (key.length < 80) return { isValid: false, message: 'Claude key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Claude key seems too long' }
    return { isValid: true, message: 'Valid Claude API key format' }
  }

  if (provider === 'OpenAI API Key') {
    // OpenAI keys: typically 48+ characters
    if (key.length < 48) return { isValid: false, message: 'OpenAI key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'OpenAI key seems too long' }
    return { isValid: true, message: 'Valid OpenAI API key format' }
  }

  if (provider === 'Google Gemini API Key') {
    // Gemini keys: typically 39+ characters
    if (key.length < 35) return { isValid: false, message: 'Gemini key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Gemini key seems too long' }
    return { isValid: true, message: 'Valid Gemini API key format' }
  }

  if (provider === 'xAI Grok API Key') {
    // Grok keys: xai- prefix, typically 80+ characters
    if (key.length < 50) return { isValid: false, message: 'Grok key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Grok key seems too long' }
    return { isValid: true, message: 'Valid Grok API key format' }
  }

  if (provider === 'Deepseek API Key') {
    // Deepseek keys: variable format, at least 20 characters
    if (key.length < 20) return { isValid: false, message: 'Deepseek key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Deepseek key seems too long' }
    return { isValid: true, message: 'Valid Deepseek API key format' }
  }

  return null
})

const columns = [
  {
    accessorKey: 'is_active',
    header: 'Status',
    id: 'is_active',
  },
  {
    accessorKey: 'provider',
    header: 'Provider',
    id: 'provider',
  },
  {
    accessorKey: 'key_hint',
    header: 'Key',
    id: 'key_hint',
  },
]

const emit = defineEmits<{
  'key-added': []
}>()

const loading = ref(false)

const handleAddKey = async () => {
  const { apiFetch } = useApi()
  loading.value = true

  try {
    await apiFetch('/api/keys', {
      method: 'POST',
      body: {
        key: apiKey.value.trim(),
        provider: detectedProvider.value,
      },
    })

    // Success
    apiKey.value = ''
    isOpen.value = false
    emit('key-added')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add key'
    useToast().add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
