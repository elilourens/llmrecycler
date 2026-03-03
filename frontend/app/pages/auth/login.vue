<template>
  <div class="min-h-screen flex items-center justify-center bg-white px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-2xl font-bold text-center text-highlighted">Sign In</h1>
      </template>

      <UForm :state="{ email, password }" class="space-y-4" @submit="handleLogin">
        <UFormField label="Email" name="email">
          <UInput v-model="email" type="email" placeholder="you@example.com" class="w-full" required />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput v-model="password" type="password" placeholder="••••••••" class="w-full" required />
        </UFormField>

        <UButton type="submit" color="primary" block :loading="loading">
          Sign In
        </UButton>
      </UForm>

      <UAlert v-if="error" color="error" variant="soft" class="mt-4" :title="error" />

      <USeparator label="or" class="my-4" />

      <UButton
        color="neutral"
        variant="outline"
        block
        icon="i-simple-icons-google"
        :loading="googleLoading"
        @click="handleGoogleLogin"
      >
        Continue with Google
      </UButton>

      <template #footer>
        <div class="text-center text-sm space-y-2">
          <p class="text-muted">
            Don't have an account?
            <UButton to="/auth/signup" variant="link" color="primary" class="p-0 h-auto font-medium">Sign Up</UButton>
          </p>
          <p>
            <UButton to="/auth/forgot-password" variant="link" color="primary" class="p-0 h-auto font-medium">Forgot Password?</UButton>
          </p>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const { signIn, signInWithGoogle } = useAuth()

const googleLoading = ref(false)

const handleGoogleLogin = async () => {
  googleLoading.value = true
  try {
    await signInWithGoogle()
  } catch (err: any) {
    error.value = err.message || 'Failed to sign in with Google'
    googleLoading.value = false
  }
}

const handleLogin = async () => {
  error.value = ''
  loading.value = true

  try {
    await signIn(email.value, password.value)
    await navigateTo('/dashboard')
  } catch (err: any) {
    error.value = err.message || 'Failed to sign in'
  } finally {
    loading.value = false
  }
}
</script>
