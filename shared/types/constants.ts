// 共享常量定义

export const APP_NAME = 'AI桌面伙伴'
export const APP_VERSION = '0.1.0'

// 情绪状态枚举
export enum EmotionType {
  HAPPY = 'happy',
  SAD = 'sad',
  THINKING = 'thinking',
  SURPRISE = 'surprise',
  IDLE = 'idle',
  SPEAKING = 'speaking'
}

// 记忆类型枚举
export enum MemoryType {
  INTEREST = '兴趣',
  HABIT = '习惯',
  GOAL = '目标',
  EVENT = '事件',
  PREFERENCE = '偏好'
}

// 应用类型（屏幕分析用）
export enum ApplicationType {
  IDE = 'IDE',
  BROWSER = '浏览器',
  DOCUMENT = '文档',
  GAME = '游戏',
  CHAT = '聊天',
  VIDEO = '视频',
  OTHER = '其他'
}
