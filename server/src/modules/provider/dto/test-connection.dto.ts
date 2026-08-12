import { IsString, IsNumber } from 'class-validator'

export class TestConnectionDto {
  @IsString()
  base_url: string

  @IsString()
  api_key: string

  @IsString()
  model: string
}

export class FetchModelsDto {
  @IsString()
  base_url: string

  @IsString()
  api_key: string
}

/** 连接测试返回结果 */
export interface ProviderTestResult {
  success: boolean
  latency: number
  model: string
  message?: string
  response?: string
  /** API 返回的 token 数量 */
  tokens?: number
}

/** 添加模型到 Provider */
export class AddProviderModelDto {
  @IsString()
  model_name: string
}
