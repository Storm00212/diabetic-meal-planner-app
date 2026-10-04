import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://glucoplate-api.vercel.app';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('auth_token');

  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Handle unauthorized (e.g., redirect to login)
    // In Expo, we typically use router.replace('/login')
  }

  return response;
}

export async function setAuthToken(token: string) {
  await SecureStore.setItemAsync('auth_token', token);
}

export async function removeAuthToken() {
  await SecureStore.deleteItemAsync('auth_token');
}
