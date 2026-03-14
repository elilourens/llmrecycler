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
  const route = useRoute()
  const code = route.query.code as string | undefined
  const hash = window.location.hash

  let destination = '/dashboard'
  let errorMessage = ''

  // Parse hash for errors (Supabase sends errors as #error=...&error_description=...)
  const hashParams = new URLSearchParams(hash.replace('#', ''))
  const error = hashParams.get('error')
  const errorDescription = hashParams.get('error_description')

  // Check for Supabase errors first
  if (error) {
    errorMessage = decodeURIComponent(errorDescription || error)
    // Redirect to forgot-password with error, user can request a new link
    await navigateTo(`/auth/forgot-password?error=${encodeURIComponent(errorMessage)}`)
    return
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      destination = '/auth/reset-password'
    }
  })

  // Handle OAuth code exchange
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Handle password recovery via hash (type=recovery in URL fragment)
  if (hash.includes('type=recovery')) {
    // Ensure session is hydrated before redirecting
    await supabase.auth.getSession()
    destination = '/auth/reset-password'
  }

  subscription.unsubscribe()
  await new Promise(resolve => setTimeout(resolve, 500))
  await navigateTo(destination)
})
</script>
