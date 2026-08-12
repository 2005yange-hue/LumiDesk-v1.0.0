import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ModelProvider } from './entities/model-provider.entity'

export interface CreateProviderDto {
  user_id?: string
  name: string
  provider: string
  base_url: string
  api_key: string
  model: string
  enabled?: boolean
}

export interface ProviderTestResult {
  success: boolean
  latency: number
  error?: string
}

export interface ProviderModelInfo {
  id: string
  owned_by: string
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name)

  constructor(
    @InjectRepository(ModelProvider)
    private readonly providerRepo: Repository<ModelProvider>
  ) {}

  /** 创建 API Provider */
  async createProvider(dto: CreateProviderDto): Promise<ModelProvider> {
    // 禁用其他同用户 provider（只保留一个启用）
    const userId = dto.user_id || 'default'
    await this.providerRepo.update(
      { user_id: userId, enabled: true },
      { enabled: false }
    )

    const record = this.providerRepo.create({ ...dto, user_id: userId, enabled: true })
    const saved = await this.providerRepo.save(record)
    this.logger.log(`Created provider: ${saved.name} (${saved.provider})`)
    return this.maskApiKey(saved)
  }

  /** 更新 Provider */
  async updateProvider(id: number, dto: Partial<CreateProviderDto>): Promise<ModelProvider | null> {
    await this.providerRepo.update(id, dto)
    const updated = await this.providerRepo.findOneBy({ id })
    if (updated && dto.enabled) {
      // 互斥：只有一个 enabled
      await this.providerRepo.update(
        { user_id: updated.user_id, enabled: true, id: undefined as unknown as number },
        { enabled: false }
      )
      await this.providerRepo.update(id, { enabled: true })
    }
    return updated ? this.maskApiKey(updated) : null
  }

  /** 删除 Provider */
  async deleteProvider(id: number): Promise<void> {
    await this.providerRepo.delete(id)
    this.logger.log(`Deleted provider id=${id}`)
  }

  /** 获取用户的所有 Provider */
  async getProviders(userId = 'default'): Promise<ModelProvider[]> {
    const providers = await this.providerRepo.find({
      where: { user_id: userId },
      order: { enabled: 'DESC', created_at: 'DESC' }
    })
    return providers.map((p) => this.maskApiKey(p))
  }

  /** 获取用户当前启用的 Provider */
  async getActiveProvider(userId = 'default'): Promise<ModelProvider | null> {
    const provider = await this.providerRepo.findOneBy({
      user_id: userId,
      enabled: true
    })
    return provider || null
  }

  /**
   * 测试 API 连接
   * 发送轻量 chat 请求验证连通性
   */
  async testConnection(
    baseUrl: string,
    apiKey: string,
    model: string
  ): Promise<ProviderTestResult> {
    const start = Date.now()
    try {
      const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5
        })
      })

      const latency = Date.now() - start
      if (res.ok) {
        return { success: true, latency }
      }
      const body = await res.text()
      return { success: false, latency, error: `HTTP ${res.status}: ${body.substring(0, 200)}` }
    } catch (error) {
      return { success: false, latency: Date.now() - start, error: String(error) }
    }
  }

  /**
   * 获取 API 的可用模型列表
   */
  async listModels(
    baseUrl: string,
    apiKey: string
  ): Promise<ProviderModelInfo[]> {
    try {
      const url = baseUrl.replace(/\/+$/, '') + '/models'
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        }
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const body = await res.json()
      return (body.data || []).map((m: { id: string; owned_by?: string }) => ({
        id: m.id,
        owned_by: m.owned_by || 'unknown'
      }))
    } catch (error) {
      this.logger.warn(`Failed to list models: ${error}`)
      throw error
    }
  }

  /**
   * 脱敏 API Key（仅保留前3后4位）
   */
  private maskApiKey(provider: ModelProvider): ModelProvider {
    if (provider.api_key && provider.api_key.length > 10) {
      provider.api_key = provider.api_key.substring(0, 3) + '****' + provider.api_key.slice(-4)
    }
    return provider
  }
}
