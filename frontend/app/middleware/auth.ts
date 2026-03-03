// Redirect authenticated users away from auth pages.
// Unauthenticated users are handled globally by @nuxtjs/supabase redirectOptions.
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  const authOnlyRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password']
  if (user.value && authOnlyRoutes.includes(to.path)) {
    return navigateTo('/')
  }
})
