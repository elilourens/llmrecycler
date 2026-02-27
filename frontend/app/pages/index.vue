<template>
  <div class="min-h-screen bg-background">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl font-bold text-highlighted">Dashboard</h1>
        <div class="flex items-center gap-4">
          <span v-if="user" class="text-sm text-muted">{{ user.email }}</span>
          <UButton
            color="error"
            variant="soft"
            :loading="loggingOut"
            @click="handleLogout"
          >
            Sign Out
          </UButton>
        </div>
      </div>

      <UCard>
        <p class="text-muted">Welcome back, {{ user?.email }}</p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
} as any)

const loggingOut = ref(false)
const { user, signOut } = useAuth()

const handleLogout = async () => {
  loggingOut.value = true
  try {
    await signOut()
    await navigateTo('/auth/login')
  } catch (error) {
    console.error('Logout failed:', error)
    loggingOut.value = false
  }
}
</script>
