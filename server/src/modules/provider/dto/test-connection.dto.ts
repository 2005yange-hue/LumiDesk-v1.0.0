import { IsString } from 'class-validator'

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
