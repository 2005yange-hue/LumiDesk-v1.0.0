import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

/**
 * Provider 关联的可用模型列表
 * 一个 Provider 可以有多个模型，供前端下拉选择
 */
@Entity('provider_models')
export class ProviderModel {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'int' })
  provider_id: number

  /** 模型名称，如 deepseek-chat / gpt-4o-mini */
  @Column({ type: 'varchar', length: 128 })
  model_name: string

  /** 是否启用 */
  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @CreateDateColumn()
  created_at: Date
}
