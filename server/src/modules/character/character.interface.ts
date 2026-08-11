/**
 * Character 接口 — 与 shared/types/character.ts 保持一致
 *
 * 规范来源：shared/types/character.ts
 * 此处为本项目本地定义，受 NestJS tsc rootDir 限制无法直接 import shared/
 * 修改本接口时请同步更新 shared/types/character.ts
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
