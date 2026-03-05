<template>
  <div class="min-h-screen bg-white">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl font-bold text-highlighted">Dashboard</h1>
        <div class="flex items-center gap-4">
          <span v-if="user" class="text-sm text-muted">{{ user.email }}</span>
          <UButton
            color="primary"
            
            :loading="loggingOut"
            @click="handleLogout"
          >
            Sign Out
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Balance
          :balance="0.00"
          :total-earned="0.00"
          :total-spent="0.00"
        />

        <SellerKeys
          :keys="sellerKeys"
          @key-added="fetchKeys"
        />

        <BuyerKeys
          :keys="buyerKeys"
          @key-generated="fetchBuyerKeys"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const loggingOut = ref(false)
const { user, signOut } = useAuth()
const { apiFetch } = useApi()

const sellerKeys = ref<Array<{ id: string; is_active: boolean; key_hint: string; provider: string; created_at: string }>>([])
const buyerKeys = ref<Array<{ id: string; name: string; is_active: boolean; key_hint: string; created_at: string }>>([])
const loading = ref(true)

const fetchKeys = async () => {
  loading.value = true
  try {
    const { keys } = await apiFetch('/api/keys')
    sellerKeys.value = keys || []
  } catch (error) {
    console.error('Failed to fetch keys:', error)
    sellerKeys.value = []
  } finally {
    loading.value = false
  }
}

const fetchBuyerKeys = async () => {
  try {
    const { keys } = await apiFetch('/api/buyer-keys')
    buyerKeys.value = keys || []
  } catch (error) {
    console.error('Failed to fetch buyer keys:', error)
    buyerKeys.value = []
  }
}

onMounted(() => {
  fetchKeys()
  fetchBuyerKeys()
})

const handleLogout = async () => {
  loggingOut.value = true
  try {
    await signOut()
    await navigateTo('/')
  } catch (error) {
    console.error('Logout failed:', error)
    loggingOut.value = false
  }
}
</script>
