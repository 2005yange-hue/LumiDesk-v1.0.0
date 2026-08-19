let apiOrigin = ''

/** Configure the backend origin before stores start loading data. */
export async function configureApiBaseUrl(): Promise<{ error: string | null }> {
  if (!window.electronAPI) return { error: null }
  try {
    const result = await window.electronAPI.getApiBaseUrl()
    apiOrigin = typeof result?.url === 'string' ? result.url.replace(/\/$/, '') : ''
    return { error: typeof result?.error === 'string' ? result.error : null }
  } catch (error) {
    apiOrigin = ''
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export function apiUrl(path: string): string {
  if (!apiOrigin) return path
  return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`
}

export function getApiOrigin(): string {
  return apiOrigin
}
