import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

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

  /** 提供商类型: openai-compatible | deepseek | siliconflow | google */
  @Column({ type: 'varchar', length: 32 })
  provider: string

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

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
