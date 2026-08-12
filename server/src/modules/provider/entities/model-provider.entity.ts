import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

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

  @Column({ type: 'varchar', length: 64 })
  name: string

  @Column({ type: 'varchar', length: 32 })
  provider: string

  @Column({ type: 'varchar', length: 32, default: 'openai-compatible' })
  provider_type: string

  @Column({ type: 'varchar', length: 512 })
  base_url: string

  @Column({ type: 'varchar', length: 512 })
  api_key: string

  @Column({ type: 'varchar', length: 64 })
  model: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'boolean', default: false })
  is_default: boolean

  // ── 生成参数 ──

  @Column({ type: 'float', default: 0.7 })
  temperature: number

  @Column({ type: 'int', default: 4096 })
  max_tokens: number

  @Column({ type: 'float', default: 1.0 })
  top_p: number

  // ── 高级参数 ──

  /** 是否启用流式响应 */
  @Column({ type: 'boolean', default: true })
  stream: boolean

  /** 请求超时（毫秒） */
  @Column({ type: 'int', default: 30000 })
  timeout: number

  /** 自定义 HTTP Headers（JSON 字符串） */
  @Column({ type: 'text', nullable: true })
  custom_headers: string | null

  /** 自定义 Body 参数（JSON 字符串） */
  @Column({ type: 'text', nullable: true })
  custom_body: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
