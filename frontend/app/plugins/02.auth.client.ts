export default defineNuxtPlugin(async (nuxtApp) => {
  const { $supabase } = nuxtApp
  const supabase = $supabase as any
  const { user, session, loading } = useAuth()

  // Get initial session
  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user ?? null
  session.value = data.session ?? null
  loading.value = false

  // Listen for auth state changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, currentSession: any) => {
    session.value = currentSession
    user.value = currentSession?.user ?? null

    if (event === 'SIGNED_OUT') {
      navigateTo('/auth/login')
    }
  })

  // Cleanup subscription on app unmount
  nuxtApp.hook('app:unmounted', () => {
    subscription?.unsubscribe()
  })
})
