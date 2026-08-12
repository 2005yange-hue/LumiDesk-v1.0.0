import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

/**
 * API Provider 类型枚举
 * 定义不同 API 的协议族，决定调用方式
 */
export enum ProviderType {
  OPENAI = 'openai',
  OPENAI_COMPATIBLE = 'openai-compatible',
  DEEPSEEK = 'deepseek',
  GEMINI = 'gemini',
  CLAUDE = 'claude',
  OPENROUTER = 'openrouter'
}

@Entity('model_providers')
export class ModelProvider {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 36, default: 'default' })
  user_id: string

  /** 配置名称，如 "DeepSeek"、"我的OpenRouter" */
  @Column({ type: 'varchar', length: 64 })
  name: string

  /** 预设标识，如 deepseek / siliconflow / openrouter */
  @Column({ type: 'varchar', length: 32 })
  provider: string

  /**
   * API 协议类型
   * openai | openai-compatible | deepseek | gemini | claude | openrouter
   * 所有类型统一使用 OpenAI Compatible 接口调用
   */
  @Column({ type: 'varchar', length: 32, default: 'openai-compatible' })
  provider_type: string

  /** API 地址 */
  @Column({ type: 'varchar', length: 512 })
  base_url: string

  /** API 密钥（生产环境建议加密存储） */
  @Column({ type: 'varchar', length: 512 })
  api_key: string

  /** 默认模型 */
  @Column({ type: 'varchar', length: 64 })
  model: string

  /** 是否启用 */
  @Column({ type: 'boolean', default: true })
  enabled: boolean

  /** 是否为默认 Provider（每个用户仅一个） */
  @Column({ type: 'boolean', default: false })
  is_default: boolean

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
