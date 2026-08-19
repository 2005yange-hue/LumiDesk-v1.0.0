import { Injectable, Logger } from '@nestjs/common'
import { Character } from './character.interface'
import { CreateCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = process.env.LUMIDESK_DATA_DIR || path.join(__dirname, '..', '..', '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'characters.json')
export const CHARACTER_AVATAR_DIR = path.join(DATA_DIR, 'avatars')
const AVATAR_URL_PREFIX = '/uploads/avatars/'

const DEFAULT_ADDRESSING_RULES = {
  stranger: '使用礼貌中性的称呼；用户未明确姓名时不要杜撰名字或昵称。',
  familiar: '若用户已经提供姓名，可以自然使用名字；不要使用亲密昵称。',
  friend: '可在有明确依据时使用用户名字或已知昵称，语气自然不过度。',
  intimate: '可使用用户明确接受的自定义昵称；始终尊重边界。',
  special: '可稳定使用用户明确接受的特别称呼；不要假设关系。'
}

@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name)
  private characters: Character[] = []

  constructor() {
    this.ensureDataDir()
    this.loadCharacters()
  }

  private ensureDataDir(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.mkdirSync(CHARACTER_AVATAR_DIR, { recursive: true })
    } catch {
      this.logger.warn('Failed to create data directory')
    }
  }

  // ──── 持久化 ────

  private loadCharacters(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8')
        this.characters = JSON.parse(raw).map((character: Record<string, unknown>) => {
          delete character.relationshipLevel
          return {
            ...character,
            addressingRules: this.normalizeAddressingRules(character.addressingRules),
            appearance: this.normalizeAppearance(character.appearance)
          } as Character
        })
        this.logger.log(`Loaded ${this.characters.length} character(s)`)
        return
      }
    } catch (error) {
      this.logger.warn('Failed to load characters, creating defaults')
    }
    this.createDefaultCharacter()
  }

  private saveCharacters(): boolean {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.characters, null, 2), 'utf-8')
      return true
    } catch (error) {
      this.logger.error('Failed to save characters:', error)
      return false
    }
  }

  private createDefaultCharacter(): void {
    const defaults = this.loadPromptTemplate()
    const defaultChar: CreateCharacterDto = {
      name: defaults.name || '艾莉',
      age: defaults.age || 20,
      gender: defaults.gender || 'female',
      background: defaults.background || '陪伴用户学习和生活的AI伙伴',
      personality: defaults.personality || '温柔、理性、善解人意',
      speakingStyle: defaults.speakingStyle || '简洁、自然',
      likes: defaults.likes || ['阅读', '学习', '编程'],
      dislikes: defaults.dislikes || ['嘈杂环境'],
      addressingRules: DEFAULT_ADDRESSING_RULES
    }
    this.create(defaultChar)
  }

  /** 从 character.txt 读取默认模板 */
  private loadPromptTemplate(): Record<string, any> {
    try {
      const promptPath = path.join(__dirname, '..', '..', 'prompts', 'character.txt')
      const content = fs.readFileSync(promptPath, 'utf-8')

      // 简单解析角色模板
      const result: Record<string, any> = {}
      const nameMatch = content.match(/名叫[「"](.+?)[」"]/)
      const traitMatch = content.match(/性格[：:]\s*(.+)/)
      const styleMatch = content.match(/语言风格[：:]\s*(.+)/)
      const bgMatch = content.match(/背景[：:]\s*(.+)/)

      if (nameMatch) result.name = nameMatch[1]
      if (traitMatch) result.personality = traitMatch[1].trim()
      if (styleMatch) result.speakingStyle = styleMatch[1].trim()
      if (bgMatch) result.background = bgMatch[1].trim()

      return result
    } catch {
      return {}
    }
  }

  // ──── CRUD ────

  findAll(): Character[] {
    return this.characters
  }

  findOne(id: string): Character | undefined {
    return this.characters.find((c) => c.id === id)
  }

  create(dto: CreateCharacterDto): Character {
    const now = new Date().toISOString()
    const character: Character = {
      id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: dto.name,
      age: dto.age || 20,
      gender: dto.gender || 'female',
      background: dto.background || '',
      personality: dto.personality || '',
      speakingStyle: dto.speakingStyle || '自然',
      likes: dto.likes || [],
      dislikes: dto.dislikes || [],
      addressingRules: this.normalizeAddressingRules(dto.addressingRules),
      openingMessage: dto.openingMessage || '',
      appearance: this.normalizeAppearance(dto.appearance),
      createdAt: now,
      updatedAt: now
    }

    this.characters.push(character)
    this.saveCharacters()
    this.logger.log(`Created character: ${character.name}`)
    return character
  }

  update(id: string, dto: UpdateCharacterDto): Character | null {
    const index = this.characters.findIndex((c) => c.id === id)
    if (index === -1) return null

    const character = this.characters[index]
    if (dto.name !== undefined) character.name = dto.name
    if (dto.age !== undefined) character.age = dto.age
    if (dto.gender !== undefined) character.gender = dto.gender
    if (dto.background !== undefined) character.background = dto.background
    if (dto.personality !== undefined) character.personality = dto.personality
    if (dto.speakingStyle !== undefined) character.speakingStyle = dto.speakingStyle
    if (dto.likes !== undefined) character.likes = dto.likes
    if (dto.dislikes !== undefined) character.dislikes = dto.dislikes
    if (dto.addressingRules !== undefined) character.addressingRules = this.normalizeAddressingRules(dto.addressingRules)
    if (dto.openingMessage !== undefined) character.openingMessage = dto.openingMessage
    if (dto.appearance !== undefined) character.appearance = this.normalizeAppearance(dto.appearance)
    character.updatedAt = new Date().toISOString()

    this.saveCharacters()
    this.logger.log(`Updated character: ${character.name}`)
    return character
  }

  remove(id: string): boolean {
    const index = this.characters.findIndex((c) => c.id === id)
    if (index === -1) return false

    const removed = this.characters.splice(index, 1)[0]
    this.saveCharacters()
    this.removeAvatarFile(removed.avatarUrl)
    this.logger.log(`Removed character: ${removed.name}`)
    return true
  }

  saveAvatar(id: string, file: { buffer: Buffer; mimetype: string }): Character | null {
    const character = this.findOne(id)
    if (!character) return null

    const extension = this.getAvatarExtension(file.mimetype)
    const filename = `${randomUUID()}.${extension}`
    const filepath = path.join(CHARACTER_AVATAR_DIR, filename)
    const previousAvatarUrl = character.avatarUrl
    const previousUpdatedAt = character.updatedAt

    try {
      fs.writeFileSync(filepath, file.buffer)
      character.avatarUrl = `${AVATAR_URL_PREFIX}${filename}`
      character.updatedAt = new Date().toISOString()
      if (!this.saveCharacters()) {
        throw new Error('角色头像信息保存失败')
      }
      this.removeAvatarFile(previousAvatarUrl)
      this.logger.log(`Updated avatar for character: ${character.name}`)
      return character
    } catch (error) {
      character.avatarUrl = previousAvatarUrl
      character.updatedAt = previousUpdatedAt
      try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
      } catch {
        this.logger.warn(`Failed to remove unfinished avatar: ${filename}`)
      }
      this.logger.error(`Failed to save avatar for character: ${character.name}`, error)
      throw error
    }
  }

  private getAvatarExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp'
    }
    return extensions[mimetype] || 'img'
  }

  private removeAvatarFile(avatarUrl?: string): void {
    if (!avatarUrl || !avatarUrl.startsWith(AVATAR_URL_PREFIX)) return

    const filename = path.basename(avatarUrl)
    const filepath = path.join(CHARACTER_AVATAR_DIR, filename)
    if (path.dirname(filepath) !== CHARACTER_AVATAR_DIR) return

    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    } catch (error) {
      this.logger.warn(`Failed to remove avatar file ${filename}: ${String(error)}`)
    }
  }

  private normalizeAppearance(appearance?: unknown): Character['appearance'] {
    if (!appearance || typeof appearance !== 'object' || Array.isArray(appearance)) return undefined
    const source = appearance as Record<string, unknown>
    const normalized: NonNullable<Character['appearance']> = {}
    for (const key of ['modelId', 'expressionSetId', 'motionSetId', 'backgroundId', 'themeId', 'presentationStyleId'] as const) {
      const value = source[key]
      if (typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value)) normalized[key] = value
    }
    return Object.keys(normalized).length ? normalized : undefined
  }
  private normalizeAddressingRules(rules?: unknown): Character['addressingRules'] {
    const source = rules && typeof rules === 'object' ? rules as Record<string, unknown> : {}
    const result = { ...DEFAULT_ADDRESSING_RULES }
    for (const level of Object.keys(result) as Array<keyof typeof result>) {
      const value = source[level]
      if (typeof value === 'string' && value.trim()) result[level] = value.trim()
    }
    return result
  }

  /** 获取默认角色（列表第一个） */
  getDefault(): Character | undefined {
    return this.characters[0]
  }
}

