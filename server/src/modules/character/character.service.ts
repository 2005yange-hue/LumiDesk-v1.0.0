import { Injectable, Logger } from '@nestjs/common'
import { Character } from './character.interface'
import { CreateCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import * as fs from 'fs'
import * as path from 'path'

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'characters.json')

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
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true })
      }
    } catch {
      this.logger.warn('Failed to create data directory')
    }
  }

  // ──── 持久化 ────

  private loadCharacters(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8')
        this.characters = JSON.parse(raw)
        this.logger.log(`Loaded ${this.characters.length} character(s)`)
        return
      }
    } catch (error) {
      this.logger.warn('Failed to load characters, creating defaults')
    }
    this.createDefaultCharacter()
  }

  private saveCharacters(): void {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.characters, null, 2), 'utf-8')
    } catch (error) {
      this.logger.error('Failed to save characters:', error)
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
      dislikes: defaults.dislikes || ['嘈杂环境']
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
      relationshipLevel: 0,
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
    this.logger.log(`Removed character: ${removed.name}`)
    return true
  }

  /** 获取默认角色（列表第一个） */
  getDefault(): Character | undefined {
    return this.characters[0]
  }
}
