<template>
  <div class="min-h-screen flex items-center justify-center bg-white">
    <div class="text-center">
      <UIcon name="i-lucide-loader-circle" class="animate-spin text-primary size-12 mb-4" />
      <p class="text-muted">Verifying...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
onMounted(async () => {
  const supabase = useSupabaseClient()
  const code = useRoute().query.code as string | undefined

  let destination = '/'

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      destination = '/auth/reset-password'
    }
  })

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  subscription.unsubscribe()
  await navigateTo(destination)
})
</script>
