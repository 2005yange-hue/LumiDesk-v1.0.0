/**
 * Tokenizer 接口
 * 所有 tokenizer 实现必须遵循此接口，支持未来替换不同模型的编码器
 */
export interface ITokenizer {
  /** Tokenizer 标识名，如 'gpt-4o' / 'claude-3' */
  readonly name: string

  /** 将文本编码为 token ID 数组 */
  encode(text: string): number[]

  /** 计算文本的 token 数量 */
  countTokens(text: string): number
}
