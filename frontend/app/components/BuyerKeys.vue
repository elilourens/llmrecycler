<template>
  <UCard>
    <template #header>
      <div class="bg-gray-50  -mx-6 -my-4 px-6 py-4 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-highlighted">Buyer API Keys</h2>
        <UButton
          color="primary"
          @click="isGenerateOpen = true"
        >
          Generate Key
        </UButton>
      </div>
    </template>

    <div class="max-h-48 overflow-y-auto">
      <UTable
        :data="keys"
        :columns="columns"
        :ui="{ td: 'text-xs', th: 'text-xs' }"
        sticky="header"
      >
        <template #is_active-cell="{ row }">
          <UBadge
            :color="row.original.is_active ? 'primary' : 'neutral'"
            variant="subtle"
            class="text-xs"
          >
            {{ row.original.is_active ? 'Active' : 'Revoked' }}
          </UBadge>
        </template>

        <template #name-cell="{ row }">
          <span class="text-xs text-black">{{ row.original.name }}</span>
        </template>

        <template #key_hint-cell="{ row }">
          <code class="text-xs text-black">
            {{ row.original.key_hint }}
          </code>
        </template>

        <template #created_at-cell="{ row }">
          <span class="text-xs text-black">
            {{ formatDate(row.original.created_at) }}
          </span>
        </template>

        <template #actions-cell="{ row }">
          <UButton
            v-if="row.original.is_active"
            size="xs"
            color="error"
            variant="outline"
            @click="handleRevoke(row.original.id)"
            :loading="revokingKeyId === row.original.id"
          >
            Revoke
          </UButton>
        </template>
      </UTable>
    </div>

    <UModal v-model:open="isGenerateOpen" title="Generate API Key" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-4">
          <div v-if="!newlyGeneratedKey">
            <UInput
              v-model="keyName"
              placeholder="e.g. Production, Development"
              class="w-full"
            />
            <p class="text-xs text-muted mt-2">Optional: Give your key a memorable name</p>
          </div>

          <div v-if="newlyGeneratedKey" class="space-y-3">
            <UAlert
              color="warning"
              variant="subtle"
              title="Save your key now"
              description="This key will not be shown again. Store it securely."
            >
              <template #description>
                <div class="mt-2 space-y-2">
                  <code class="block text-xs bg-gray-900 text-gray-100 p-3 rounded break-all select-all font-mono">
                    {{ newlyGeneratedKey }}
                  </code>
                  <UButton
                    size="xs"
                    @click="copyKey"
                    :loading="copying"
                  >
                    {{ copying ? 'Copied!' : 'Copy to Clipboard' }}
                  </UButton>
                </div>
              </template>
            </UAlert>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton
            color="neutral"
            variant="outline"
            @click="handleModalClose"
          >
            {{ newlyGeneratedKey ? 'Done' : 'Cancel' }}
          </UButton>
          <UButton
            v-if="!newlyGeneratedKey"
            :loading="loading"
            @click="handleGenerateKey"
          >
            Generate
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
interface BuyerKey {
  id: string
  name: string
  is_active: boolean
  key_hint: string
  created_at: string
}

interface Props {
  keys: BuyerKey[]
}

defineProps<Props>()

const isGenerateOpen = ref(false)
const keyName = ref('')
const newlyGeneratedKey = ref('')
const loading = ref(false)
const copying = ref(false)
const revokingKeyId = ref<string | null>(null)

const columns = [
  {
    accessorKey: 'is_active',
    header: 'Status',
    id: 'is_active',
  },
  {
    accessorKey: 'name',
    header: 'Name',
    id: 'name',
  },
  {
    accessorKey: 'key_hint',
    header: 'Key',
    id: 'key_hint',
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    id: 'created_at',
  },
  {
    accessorKey: 'actions',
    header: '',
    id: 'actions',
  },
]

const emit = defineEmits<{
  'key-generated': []
}>()

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const handleGenerateKey = async () => {
  const { apiFetch } = useApi()
  loading.value = true

  try {
    const response = await apiFetch('/api/buyer-keys', {
      method: 'POST',
      body: {
        name: keyName.value.trim() || undefined,
      },
    })

    // Store the raw key for display
    newlyGeneratedKey.value = response.rawKey

    // Show toast
    useToast().add({
      title: 'Key generated',
      description: 'Save this key — it won\'t be shown again',
      color: 'success',
    })

    // Emit event to refresh parent
    emit('key-generated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate key'
    useToast().add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const copyKey = async () => {
  copying.value = true
  try {
    await navigator.clipboard.writeText(newlyGeneratedKey.value)
    useToast().add({
      title: 'Copied',
      color: 'success',
    })
  } catch (error) {
    useToast().add({
      title: 'Error',
      description: 'Failed to copy to clipboard',
      color: 'error',
    })
  } finally {
    copying.value = false
  }
}

const handleModalClose = () => {
  isGenerateOpen.value = false
  keyName.value = ''
  newlyGeneratedKey.value = ''
}

const handleRevoke = async (keyId: string) => {
  const { apiFetch } = useApi()
  revokingKeyId.value = keyId

  try {
    await apiFetch(`/api/buyer-keys/${keyId}`, {
      method: 'DELETE',
    })

    useToast().add({
      title: 'Key revoked',
      color: 'success',
    })

    emit('key-generated')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke key'
    useToast().add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    revokingKeyId.value = null
  }
}
</script>
