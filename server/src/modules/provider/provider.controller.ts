import { Controller, Get, Post, Put, Delete, Body, Param, Logger } from '@nestjs/common'
import { ProviderService } from './provider.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'
import { TestConnectionDto, FetchModelsDto, AddProviderModelDto } from './dto/test-connection.dto'

@Controller('provider')
export class ProviderController {
  private readonly logger = new Logger(ProviderController.name)

  constructor(private readonly providerService: ProviderService) {}

  // ====================================================
  // 固定路由（必须在参数路由之前）
  // ====================================================

  @Get()
  async getProviders() {
    return this.providerService.getProviders()
  }

  @Get('active')
  async getActiveProvider() {
    const provider = await this.providerService.getActiveProvider()
    return provider ? this.providerService.maskApiKey(provider) : null
  }

  @Get('default')
  async getDefaultProvider() {
    const provider = await this.providerService.getDefaultProvider()
    return provider ? this.providerService.maskApiKey(provider) : null
  }

  @Post()
  async createProvider(@Body() dto: CreateProviderDto) {
    return this.providerService.createProvider(dto)
  }

  @Post('test')
  async testConnection(@Body() dto: TestConnectionDto) {
    this.logger.log(`Testing connection to: ${dto.base_url}`)
    return this.providerService.testConnection(dto.base_url, dto.api_key, dto.model)
  }

  @Post('models')
  async getModels(@Body() dto: FetchModelsDto) {
    this.logger.log(`Fetching models from: ${dto.base_url}`)
    return this.providerService.listModels(dto.base_url, dto.api_key)
  }

  // 模型 CRUD 的固定路径在参数路径之前
  @Delete('model/:modelId')
  async deleteProviderModel(@Param('modelId') modelId: string) {
    await this.providerService.removeModel(Number(modelId))
    return { success: true }
  }

  // ====================================================
  // 参数路由（:id 结尾的放在最后）
  // ====================================================

  @Get(':id/saved-models')
  async getSavedModels(@Param('id') id: string) {
    return this.providerService.getSavedModels(Number(id))
  }

  @Get(':id/models')
  async getModelsByProviderId(@Param('id') id: string) {
    return this.providerService.listModelsByProviderId(Number(id))
  }

  @Post(':id/models')
  async addProviderModel(@Param('id') id: string, @Body() dto: AddProviderModelDto) {
    return this.providerService.addModel(Number(id), dto.model_name)
  }

  @Put(':id')
  async updateProvider(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providerService.updateProvider(Number(id), dto)
  }

  @Delete(':id')
  async deleteProvider(@Param('id') id: string) {
    await this.providerService.deleteProvider(Number(id))
    return { success: true }
  }
}
