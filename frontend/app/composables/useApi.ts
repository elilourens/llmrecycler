export const useApi = () => {
  const session = useSupabaseSession();
  const config = useRuntimeConfig();
  const baseURL = config.public.apiUrl as string;

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = session.value?.access_token;
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let body = options.body;
    if (body && typeof body === 'object') {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }

    const response = await fetch(`${baseURL}${url}`, {
      ...options,
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  };

  return { apiFetch };
};
