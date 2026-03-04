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

        <SellerKeys :keys="sellerKeys" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const loggingOut = ref(false)
const { user, signOut } = useAuth()

const sellerKeys = ref([
  { is_active: true, key_hint: 'sk-ant-test1234567890abcdefghijklmn***', provider: 'Anthropic Claude API Key' },
  { is_active: true, key_hint: 'sk-proj-test1234567890abcdefghijk***', provider: 'OpenAI API Key' },
  { is_active: false, key_hint: 'AIzaSytest1234567890abcdefghijk***', provider: 'Google Gemini API Key' },
  { is_active: true, key_hint: 'xai-test1234567890abcdefghijklmno***', provider: 'xAI Grok API Key' },
])

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
