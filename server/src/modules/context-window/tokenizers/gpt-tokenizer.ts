import { ITokenizer } from '../tokenizer.interface'
import { encode } from 'gpt-tokenizer'

/**
 * OpenAI GPT 系列模型 Tokenizer
 * 使用 cl100k_base 编码（GPT-4 / GPT-3.5-turbo / text-embedding-ada-002）
 */
export class GptTokenizer implements ITokenizer {
  readonly name = 'gpt-tokenizer'

  encode(text: string): number[] {
    return encode(text)
  }

  countTokens(text: string): number {
    return encode(text).length
  }

  isWithinTokenLimit(text: string, maxTokens: number): boolean {
    return this.countTokens(text) <= maxTokens
  }
}
