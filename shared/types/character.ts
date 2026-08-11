/**
 * Character 角色接口 — 前后端共享规范定义
 * 这是唯一的规范来源（single source of truth）。
 *
 * 前端：通过 @shared/types/character 引用
 * 服务端：通过 character.interface.ts 本地定义引用
 *         （受 NestJS tsc rootDir 限制无法直接 import shared/）
 */
export interface Character {
  id: string
  name: string
  age: number
  gender: string
  background: string
  personality: string
  speakingStyle: string
  likes: string[]
  dislikes: string[]
  relationshipLevel: number
  createdAt: string
  updatedAt: string
}
