// If Supabase redirects to any page with ?code=, forward it to our callback handler.
// This handles the case where the Supabase redirect_to is the site root instead of /auth/callback.
export default defineNuxtRouteMiddleware((to) => {
  if (to.query.code && to.path !== '/auth/callback') {
    return navigateTo({ path: '/auth/callback', query: { code: to.query.code as string } })
  }
})
