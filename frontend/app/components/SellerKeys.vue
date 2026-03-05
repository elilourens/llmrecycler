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
      <template #status-cell="{ row }">
        <UBadge :color="row.original.status === 'active' ? 'primary' : 'warning'" variant="subtle" class="text-xs">
          {{ row.original.status === 'active' ? 'Active' : 'Deactivated' }}
        </UBadge>
      </template>

      <template #key_hint-cell="{ row }">
        <code class="text-xs text-black">
          {{ row.original.key_hint }}
        </code>
      </template>

      <template #provider-cell="{ row }">
        <span class="text-xs text-black">{{ row.original.provider }}</span>
      </template>

      <template #actions-cell="{ row }">
        <div class="flex gap-2">
          <UButton
            size="xs"
            :color="row.original.status === 'active' ? 'warning' : 'success'"
            variant="outline"
            @click="handleToggleStatus(row.original.id, row.original.status === 'active' ? 'deactivated' : 'active')"
            :loading="togglingKeyId === row.original.id"
          >
            {{ row.original.status === 'active' ? 'Disable' : 'Enable' }}
          </UButton>
          <UButton
            size="xs"
            color="error"
            variant="outline"
            @click="handleDelete(row.original.id)"
            :loading="deletingKeyId === row.original.id"
          >
            Delete
          </UButton>
        </div>
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
  id: string
  status: 'active' | 'deactivated' | 'hidden'
  key_hint: string
  provider: string
}

interface Props {
  keys: SellerKey[]
}

defineProps<Props>()

const isOpen = ref(false)
const apiKey = ref('')
const togglingKeyId = ref<string | null>(null)
const deletingKeyId = ref<string | null>(null)

const detectedProvider = computed(() => {
  const key = apiKey.value.trim().toLowerCase()

  if (!key) return null

  if (key.startsWith('sk-ant-')) return 'Anthropic'
  if (key.startsWith('sk-proj-') || key.startsWith('sk-')) {
    // Could be OpenAI or Grok, check more specifically
    if (key.includes('grok')) return 'xAI'
    return 'OpenAI'
  }
  if (key.startsWith('aiza') || key.startsWith('aiz-')) return 'Google'
  if (key.startsWith('xai-')) return 'xAI'
  if (key.startsWith('sk-')) return 'OpenAI'
  if (key.includes('deepseek') || key.startsWith('sk_deepseek')) return 'Deepseek'

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
  if (provider === 'Anthropic') {
    // Claude keys: sk-ant- prefix, typically 80+ characters
    if (key.length < 80) return { isValid: false, message: 'Key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Key seems too long' }
    return { isValid: true, message: 'Valid API key format' }
  }

  if (provider === 'OpenAI') {
    // OpenAI keys: typically 48+ characters
    if (key.length < 48) return { isValid: false, message: 'Key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Key seems too long' }
    return { isValid: true, message: 'Valid API key format' }
  }

  if (provider === 'Google') {
    // Gemini keys: typically 39+ characters
    if (key.length < 35) return { isValid: false, message: 'Key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Key seems too long' }
    return { isValid: true, message: 'Valid API key format' }
  }

  if (provider === 'xAI') {
    // Grok keys: xai- prefix, typically 80+ characters
    if (key.length < 50) return { isValid: false, message: 'Key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Key seems too long' }
    return { isValid: true, message: 'Valid API key format' }
  }

  if (provider === 'Deepseek') {
    // Deepseek keys: variable format, at least 20 characters
    if (key.length < 20) return { isValid: false, message: 'Key seems too short' }
    if (key.length > 200) return { isValid: false, message: 'Key seems too long' }
    return { isValid: true, message: 'Valid API key format' }
  }

  return null
})

const columns = [
  {
    accessorKey: 'status',
    header: 'Status',
    id: 'status',
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
  {
    accessorKey: 'actions',
    header: '',
    id: 'actions',
  },
]

const emit = defineEmits<{
  'key-added': []
}>()

const loading = ref(false)

const handleToggleStatus = async (keyId: string, status: 'active' | 'deactivated') => {
  const { apiFetch } = useApi()
  togglingKeyId.value = keyId

  try {
    await apiFetch(`/api/keys/${keyId}`, {
      method: 'PATCH',
      body: {
        status,
      },
    })

    useToast().add({
      title: status === 'active' ? 'Key enabled' : 'Key disabled',
      color: 'success',
    })

    emit('key-added')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update key status'
    useToast().add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    togglingKeyId.value = null
  }
}

const handleDelete = async (keyId: string) => {
  const { apiFetch } = useApi()
  deletingKeyId.value = keyId

  try {
    await apiFetch(`/api/keys/${keyId}`, {
      method: 'DELETE',
    })

    useToast().add({
      title: 'Key deleted',
      color: 'success',
    })

    emit('key-added')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete key'
    useToast().add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    deletingKeyId.value = null
  }
}

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
