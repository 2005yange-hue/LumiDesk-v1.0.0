import { apiUrl } from '@/services/api-base'

/** 将后端保存的相对头像路径转换为当前运行环境可访问的地址。 */
export function resolveAvatarUrl(avatarUrl?: string): string {
  if (!avatarUrl) return ''
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl
  return apiUrl(avatarUrl)
}
