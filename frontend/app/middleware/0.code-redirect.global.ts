// Combined auth middleware: handles OAuth code redirects, recovery flows, and auth-only routes
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  // ✅ Allow Supabase password recovery flow (uses hash, not query)
  if (to.path === '/auth/callback' && to.hash.includes('type=recovery')) {
    return
  }

  // Redirect authenticated users away from auth pages
  const authOnlyRoutes = ['/auth/login', '/auth/signup', '/auth/forgot-password']
  if (user.value && authOnlyRoutes.includes(to.path)) {
    return navigateTo('/')
  }

  // OAuth code forwarding: if we hit any page with ?code=, send to callback handler
  // (handles case where Supabase redirect_to is site root instead of /auth/callback)
  if (to.query.code && to.path !== '/auth/callback') {
    return navigateTo({ path: '/auth/callback', query: { code: to.query.code as string } })
  }
})
