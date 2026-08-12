import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ModelProvider } from './entities/model-provider.entity'
import { ProviderModel } from './entities/provider-model.entity'
import type { CreateProviderDto } from './dto/create-provider.dto'
import type { ProviderTestResult } from './dto/test-connection.dto'

export interface ProviderModelInfo {
  id: string
  owned_by: string
}

/** 本地存储的 Provider 模型 */
export interface SavedModel {
  id: number
  provider_id: number
  model_name: string
  enabled: boolean
  created_at: Date
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name)

  constructor(
    @InjectRepository(ModelProvider)
    private readonly providerRepo: Repository<ModelProvider>,
    @InjectRepository(ProviderModel)
    private readonly modelRepo: Repository<ProviderModel>
  ) {}

  // ====================================================
  // Provider CRUD
  // ====================================================

  async createProvider(dto: CreateProviderDto): Promise<ModelProvider> {
    const userId = dto.user_id || 'default'
    if (dto.is_default) {
      await this.providerRepo.update({ user_id: userId, is_default: true }, { is_default: false })
    }
    const count = await this.providerRepo.count({ where: { user_id: userId } })
    const record = this.providerRepo.create({ ...dto, user_id: userId, enabled: true })
    const saved = await this.providerRepo.save(record)
    this.logger.log(`Created provider: ${saved.name} (${saved.provider})`)
    return this.maskApiKey(saved)
  }

  async updateProvider(id: number, dto: Partial<CreateProviderDto>): Promise<ModelProvider | null> {
    if (dto.api_key && this.isMaskedApiKey(dto.api_key)) {
      this.logger.log(`Detected masked API key, skipping update`)
      delete dto.api_key
    }
    if (dto.is_default) {
      const existing = await this.providerRepo.findOneBy({ id })
      if (existing) {
        await this.providerRepo.update(
          { user_id: existing.user_id, is_default: true },
          { is_default: false }
        )
      }
    }
    await this.providerRepo.update(id, dto)
    const updated = await this.providerRepo.findOneBy({ id })
    return updated ? this.maskApiKey(updated) : null
  }

  async deleteProvider(id: number): Promise<void> {
    await this.modelRepo.delete({ provider_id: id })
    await this.providerRepo.delete(id)
    this.logger.log(`Deleted provider id=${id}`)
  }

  async getProviders(userId = 'default'): Promise<ModelProvider[]> {
    const providers = await this.providerRepo.find({
      where: { user_id: userId },
      order: { is_default: 'DESC', enabled: 'DESC', created_at: 'DESC' }
    })
    return providers.map((p) => this.maskApiKey(p))
  }

  async getActiveProvider(userId = 'default'): Promise<ModelProvider | null> {
    const provider = await this.providerRepo.findOneBy({ user_id: userId, enabled: true })
    if (provider) {
      this.logger.log(`[Provider Debug] getActiveProvider → name: ${provider.name}, model: ${provider.model}, api_key: ${this.#safeKeyPrefix(provider.api_key)}`)
    }
    return provider || null
  }

  async findProviderById(id: number): Promise<ModelProvider | null> {
    return this.providerRepo.findOneBy({ id })
  }

  async findProviderByIdOrFail(id: number): Promise<ModelProvider> {
    const provider = await this.findProviderById(id)
    if (!provider) throw new NotFoundException(`模型配置 #${id} 不存在`)
    return provider
  }

  async getDefaultProvider(userId = 'default'): Promise<ModelProvider | null> {
    const provider = await this.providerRepo.findOneBy({ user_id: userId, is_default: true })
    if (provider) {
      this.logger.log(`[Provider Debug] getDefaultProvider → name: ${provider.name}, model: ${provider.model}, api_key: ${this.#safeKeyPrefix(provider.api_key)}`)
    }
    return provider || null
  }

  // ====================================================
  // 本地模型管理 (provider_models 表)
  // ====================================================

  /** 获取 Provider 的本地模型列表 */
  async getSavedModels(providerId: number): Promise<SavedModel[]> {
    return this.modelRepo.find({
      where: { provider_id: providerId },
      order: { enabled: 'DESC', created_at: 'ASC' }
    })
  }

  /** 添加模型到 Provider */
  async addModel(providerId: number, modelName: string): Promise<SavedModel> {
    await this.findProviderByIdOrFail(providerId)
    const existing = await this.modelRepo.findOneBy({
      provider_id: providerId,
      model_name: modelName
    })
    if (existing) {
      if (!existing.enabled) {
        existing.enabled = true
        return this.modelRepo.save(existing)
      }
      return existing
    }
    const model = this.modelRepo.create({ provider_id: providerId, model_name: modelName, enabled: true })
    return this.modelRepo.save(model)
  }

  /** 删除模型 */
  async removeModel(modelId: number): Promise<void> {
    await this.modelRepo.delete(modelId)
    this.logger.log(`Deleted provider model id=${modelId}`)
  }

  // ====================================================
  // 连接测试 & 模型获取
  // ====================================================

  async testConnection(baseUrl: string, apiKey: string, model: string): Promise<ProviderTestResult> {
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
        const body = await res.json()
        const choice = body.choices?.[0]
        const response = choice?.message?.content || choice?.text || JSON.stringify(choice).substring(0, 80)
        return { success: true, latency, model, response: response?.substring(0, 120) }
      }

      const errBody = await res.text()
      return {
        success: false,
        latency,
        model,
        message: `HTTP ${res.status}: ${errBody.substring(0, 200)}`
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - start,
        model,
        message: String(error)
      }
    }
  }

  async listModelsByProviderId(id: number): Promise<ProviderModelInfo[]> {
    const provider = await this.findProviderByIdOrFail(id)
    return this.listModels(provider.base_url, provider.api_key)
  }

  async listModels(baseUrl: string, apiKey: string): Promise<ProviderModelInfo[]> {
    try {
      const url = baseUrl.replace(/\/+$/, '') + '/models'
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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

  // ====================================================
  // 工具方法
  // ====================================================

  maskApiKey(provider: ModelProvider): ModelProvider {
    const copy = { ...provider }
    if (copy.api_key && copy.api_key.length > 10) {
      copy.api_key = copy.api_key.substring(0, 3) + '****' + copy.api_key.slice(-4)
    }
    return copy
  }

  private isMaskedApiKey(key: string): boolean {
    return key.includes('****')
  }

  #safeKeyPrefix(key?: string): string {
    if (!key) return '<empty>'
    if (key.length <= 8) return key.substring(0, 4) + '...'
    return key.substring(0, 8) + '...'
  }
}
