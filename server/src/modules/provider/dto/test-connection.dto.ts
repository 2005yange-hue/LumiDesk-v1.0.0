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
  /** 延迟（毫秒） */
  latency: number
  /** 测试使用的模型名 */
  model: string
  /** 失败时的错误信息 */
  message?: string
}
