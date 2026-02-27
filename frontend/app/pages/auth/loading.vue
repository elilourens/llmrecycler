<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="text-center">
      <UIcon name="i-lucide-loader-circle" class="animate-spin text-primary size-12 mb-4" />
      <p class="text-muted">Loading...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
} as any)

onMounted(async () => {
  const { getSession, user } = useAuth()
  await getSession()

  if (user.value) {
    await navigateTo('/')
  } else {
    await navigateTo('/auth/login')
  }
})
</script>
