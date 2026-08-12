import { Controller, Get, Post, Put, Delete, Body, Param, Logger } from '@nestjs/common'
import { ProviderService, CreateProviderDto } from './provider.service'

@Controller('provider')
export class ProviderController {
  private readonly logger = new Logger(ProviderController.name)

  constructor(private readonly providerService: ProviderService) {}

  /** 获取所有 Provider */
  @Get()
  async getProviders() {
    return this.providerService.getProviders()
  }

  /** 获取当前启用的 Provider */
  @Get('active')
  async getActiveProvider() {
    return this.providerService.getActiveProvider() || null
  }

  /** 创建 Provider */
  @Post()
  async createProvider(@Body() dto: CreateProviderDto) {
    return this.providerService.createProvider(dto)
  }

  /** 更新 Provider */
  @Put(':id')
  async updateProvider(@Param('id') id: string, @Body() dto: Partial<CreateProviderDto>) {
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
  async testConnection(@Body() body: { base_url: string; api_key: string; model: string }) {
    this.logger.log(`Testing connection to: ${body.base_url}`)
    return this.providerService.testConnection(body.base_url, body.api_key, body.model)
  }

  /**
   * 获取 API 模型列表
   * POST /api/provider/models
   */
  @Post('models')
  async getModels(@Body() body: { base_url: string; api_key: string }) {
    this.logger.log(`Fetching models from: ${body.base_url}`)
    return this.providerService.listModels(body.base_url, body.api_key)
  }
}
