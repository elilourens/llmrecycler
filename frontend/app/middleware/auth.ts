export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, loading, getSession } = useAuth()

  // Public routes that don't require authentication
  const publicRoutes = [
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/loading',
    '/auth/callback'
  ]

  // Check if trying to access a public route
  const isPublicRoute = publicRoutes.some(route =>
    to.path.startsWith(route)
  )

  // Handle redirect callback from Supabase
  if (to.path === '/auth/callback') {
    return
  }

  // If already have a session, allow access
  if (user.value) {
    // Redirect authenticated users away from auth pages
    if (isPublicRoute && !to.path.includes('callback')) {
      return navigateTo('/')
    }
    return
  }

  // If still loading session, show loading page
  if (loading.value) {
    if (to.path !== '/auth/loading') {
      return navigateTo('/auth/loading')
    }
    return
  }

  // Fetch session if not loaded yet
  if (!user.value && !loading.value) {
    await getSession()

    if (user.value) {
      // Allow access to protected routes
      return
    }
  }

  // If no session and not a public route, redirect to login
  if (!user.value && !isPublicRoute) {
    return navigateTo('/auth/login')
  }
})
