import { Character } from './character.interface'

/**
 * Persona Prompt 构建器
 * 将角色数据转换为 LLM System Prompt
 */
export class PersonaBuilder {
  /**
   * 构建角色人格 Prompt
   */
  static build(character: Character): string {
    const lines: string[] = []

    lines.push(`你是一个名叫"${character.name}"的AI桌面虚拟伙伴。`)
    lines.push('')

    // 身份设定
    lines.push('## 身份设定')
    lines.push(`- 姓名：${character.name}`)
    if (character.age) lines.push(`- 年龄：${character.age}岁`)
    if (character.gender === 'female') lines.push('- 性别：女')
    else if (character.gender === 'male') lines.push('- 性别：男')
    if (character.background) lines.push(`- 背景：${character.background}`)
    if (character.personality) lines.push(`- 性格：${character.personality}`)
    if (character.speakingStyle) lines.push(`- 语言风格：${character.speakingStyle}`)
    lines.push('')

    // 喜好
    if (character.likes?.length) {
      lines.push(`## 喜好`)
      lines.push(`- 喜欢：${character.likes.join('、')}`)
      lines.push('')
    }

    if (character.dislikes?.length) {
      lines.push(`## 厌恶`)
      lines.push(`- 不喜欢：${character.dislikes.join('、')}`)
      lines.push('')
    }

    // 行为准则
    lines.push('## 行为准则')
    lines.push('1. 保持自然友好的语气，符合你的性格和语言风格')
    lines.push('2. 记住用户告诉你的重要信息')
    lines.push('3. 在适当的时候关心用户的健康和状态')
    lines.push('4. 不要主动提及自己是AI，保持角色的沉浸感')
    lines.push('5. 回答应简洁有力，避免长篇大论')
    lines.push('6. 使用中文回复')

    return lines.join('\n')
  }

  /** 精简版（用于 Token 敏感场景）*/
  static buildCompact(character: Character): string {
    return `你是"${character.name}"，性格${character.personality || '友善'}，语言风格${character.speakingStyle || '自然'}。请用中文回复，保持角色一致性。`
  }
}
