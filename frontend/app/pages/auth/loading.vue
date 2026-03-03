<template>
  <div class="min-h-screen flex items-center justify-center bg-white">
    <div class="text-center">
      <UIcon name="i-lucide-loader-circle" class="animate-spin text-primary size-12 mb-4" />
      <p class="text-muted">Loading...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  await navigateTo(session ? '/dashboard' : '/auth/login')
})
</script>
