import axios from 'axios';

export function authErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 429) {
    const seconds = Number(error.response.headers['retry-after']);
    return Number.isFinite(seconds) && seconds > 0
      ? `Too many attempts. Try again in ${Math.ceil(seconds)} seconds.`
      : 'Too many attempts. Please wait before trying again.';
  }
  return typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback;
}

export function passwordError(password: string, confirmation: string): string {
  if (password.length < 12) return 'Use at least 12 characters for your new password.';
  if (new TextEncoder().encode(password).length > 72) return 'Keep your password within 72 UTF-8 bytes.';
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}
