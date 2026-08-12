import { Controller, Get, Post, Put, Delete, Body, Param, Logger } from '@nestjs/common'
import { ProviderService } from './provider.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'
import { TestConnectionDto, FetchModelsDto } from './dto/test-connection.dto'

@Controller('provider')
export class ProviderController {
  private readonly logger = new Logger(ProviderController.name)

  constructor(private readonly providerService: ProviderService) {}

  /** 获取所有 Provider */
  @Get()
  async getProviders() {
    return this.providerService.getProviders()
  }

  /** 获取当前启用的 Provider（返回脱敏 Key） */
  @Get('active')
  async getActiveProvider() {
    const provider = await this.providerService.getActiveProvider()
    return provider ? this.providerService.maskApiKey(provider) : null
  }

  /** 获取默认 Provider（返回脱敏 Key） */
  @Get('default')
  async getDefaultProvider() {
    const provider = await this.providerService.getDefaultProvider()
    return provider ? this.providerService.maskApiKey(provider) : null
  }

  /** 获取指定 Provider 的模型列表（通过 ID） */
  @Get(':id/models')
  async getModelsByProviderId(@Param('id') id: string) {
    this.logger.log(`Fetching models for provider id=${id}`)
    return this.providerService.listModelsByProviderId(Number(id))
  }

  /** 创建 Provider */
  @Post()
  async createProvider(@Body() dto: CreateProviderDto) {
    return this.providerService.createProvider(dto)
  }

  /** 更新 Provider */
  @Put(':id')
  async updateProvider(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providerService.updateProvider(Number(id), dto)
  }

  /** 删除 Provider */
  @Delete(':id')
  async deleteProvider(@Param('id') id: string) {
    await this.providerService.deleteProvider(Number(id))
    return { success: true }
  }

  /**
   * 测试 API 连接
   * POST /api/provider/test
   */
  @Post('test')
  async testConnection(@Body() dto: TestConnectionDto) {
    this.logger.log(`Testing connection to: ${dto.base_url}`)
    return this.providerService.testConnection(dto.base_url, dto.api_key, dto.model)
  }

  /**
   * 获取 API 模型列表（传入 base_url + api_key）
   * POST /api/provider/models
   */
  @Post('models')
  async getModels(@Body() dto: FetchModelsDto) {
    this.logger.log(`Fetching models from: ${dto.base_url}`)
    return this.providerService.listModels(dto.base_url, dto.api_key)
  }
}
