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
   */
  @Column({ type: 'varchar', length: 32, default: 'openai-compatible' })
  provider_type: string

  /** API 地址 */
  @Column({ type: 'varchar', length: 512 })
  base_url: string

  /** API 密钥 */
  @Column({ type: 'varchar', length: 512 })
  api_key: string

  /** 默认模型 */
  @Column({ type: 'varchar', length: 64 })
  model: string

  /** 是否启用 */
  @Column({ type: 'boolean', default: true })
  enabled: boolean

  /** 是否为默认 Provider */
  @Column({ type: 'boolean', default: false })
  is_default: boolean

  /** 温度参数 (0-2) */
  @Column({ type: 'float', default: 0.7 })
  temperature: number

  /** 最大 Token 数 */
  @Column({ type: 'int', default: 4096 })
  max_tokens: number

  /** Top-P 采样 */
  @Column({ type: 'float', default: 1.0 })
  top_p: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
