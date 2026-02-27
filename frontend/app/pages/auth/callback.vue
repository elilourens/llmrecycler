<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="text-center">
      <UIcon name="i-lucide-loader-circle" class="animate-spin text-primary size-12 mb-4" />
      <p class="text-muted">Verifying...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
} as any)

onMounted(async () => {
  const { $supabase } = useNuxtApp()
  const supabase = $supabase as any

  const code = useRoute().query.code as string | undefined

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  await navigateTo('/')
})
</script>
