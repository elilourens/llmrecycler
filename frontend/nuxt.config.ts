// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase',
    ['@nuxtjs/google-fonts', {
      families: {
        // Uncomment the one you want to use, comment out the rest
        'Inter': [400, 500, 600, 700],
        // 'DM Sans': [400, 500, 600, 700],
        // 'Plus Jakarta Sans': [400, 500, 600, 700],
        // 'Outfit': [400, 500, 600, 700],
        // 'Syne': [400, 500, 600, 700],
        // 'Chakra Petch': [400, 500, 600, 700],
        // 'Rajdhani': [400, 500, 600, 700],
        // 'Oxanium': [400, 500, 600, 700],
      },
      display: 'swap'
    }]
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  ssr: false,

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    useSsrCookies: false,
    redirect: true,
    redirectOptions: {
      login: '/auth/loading',
      callback: '/auth/callback',
      exclude: [
        '/',
        '/auth/login',
        '/auth/signup',
        '/auth/forgot-password',
        '/auth/loading',
        '/auth/callback',
        '/auth/reset-password'
      ]
    }
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001'
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
