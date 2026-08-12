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
  /** API 返回的响应摘要 */
  response?: string
}

/** 添加模型到 Provider */
export class AddProviderModelDto {
  @IsString()
  model_name: string
}
