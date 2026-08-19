# LumiDesk

## 项目开发文档

---

## 一、项目名称

LumiDesk：基于多模态大语言模型与长期记忆机制的智能桌面虚拟伙伴系统设计与实现

---

## 二、项目背景

随着大语言模型（LLM）和多模态技术的发展，AI 助手已经能够进行自然语言对话和图像理解。然而，大多数 AI 助手缺乏持续存在感、长期记忆能力和稳定的人格设定。

本项目旨在开发一个运行于桌面的 AI 虚拟伙伴，不仅能够进行自然语言交流，还具备：
- 视觉环境感知（理解用户屏幕内容）
- 长期记忆（记住用户偏好和习惯）
- 人格系统（稳定的角色设定）
- Live2D 可视化呈现
- 主动交互能力

该系统不是普通聊天机器人，而是一个具有持续存在感的 AI 智能体。

---

## 三、项目目标

### 总体目标

开发一个运行于桌面的 AI 虚拟伙伴应用，实现：

1. 用户与虚拟角色自然语言交流（文本、流式输出）
2. AI 角色拥有固定人格和背景设定（角色：艾莉）
3. AI 能够长期记忆用户信息（向量检索 + 结构化存储）
4. AI 能够读取用户屏幕内容（多模态视觉分析）
5. AI 能够理解当前用户行为并主动提供反馈
6. Live2D 角色根据 AI 状态进行表情和动作变化
7. 支持多模型切换（OpenAI / DeepSeek / Gemini 等）

---

## 四、核心功能

### 4.1 基础聊天系统 ✅

- 多轮连续对话
- 流式输出（SSE）
- 上下文理解（CHAT_CONTEXT_LIMIT 自动截断）
- 停止生成控制
- 消息持久化到 MySQL（conversations + messages 表）
- 长会话摘要：未摘要消息超过 50 条时压缩早期记录，保留摘要与受控数量的近期原文进入 Prompt

### 4.2 角色人格系统 ✅

- Character CRUD 接口
- 角色"艾莉"（温柔、理性、善解人意）
- `PromptContextService` 动态 Prompt 生成
- 多角色创建与切换
- Prompt 模板文件管理（`server/src/prompts/`）

### 4.3 动态 Provider 管理系统 ✅

- Provider CRUD（GET/POST/PUT/DELETE）
- 多 Provider 并存与优先级链（providerId → default Provider → .env）
- `provider_type` 预设：OpenAI / DeepSeek / Gemini / Claude / OpenRouter / 自定义
- 模型参数（temperature / max_tokens / top_p）
- 高级参数（stream / timeout / custom_headers / custom_body）
- 连接测试（延迟 / tokens / 友好错误分类）
- 远程获取模型列表
- 桌面版 SQLite 持久化；开发/部署可选 MySQL

### 4.4 长期记忆系统 ✅

- `MemoryExtractor` 自动提取关键信息
- JSON 多策略容错解析（`parseEntries`）
- MySQL `memory_entries` 表结构化存储
- 记忆分类：preference / personality / event / relationship / fact
- importance + confidence 双重质量权重（0-1）
- character_id 隔离角色记忆，旧数据保持兼容回退
- last_used_at 使用记录，为记忆衰减与治理预留

### 4.5 向量记忆系统 ✅（可选）

- ChromaDB v2 向量存储（tenant: default_tenant, database: default_database）
- `collection: memory_entries` 自动创建
- Embedding API 文本向量化（OpenAI 兼容）
- 安全降级：未启用或无配置时跳过 Chroma，不影响聊天主流程
- 按用户与角色范围进行语义相似度搜索（Top-K）

### 4.6 Conversation 会话管理 ✅

- 多会话管理（Sidebar 会话列表 + 切换）
- 会话 CRUD（新建 / 重命名 / 删除）
- 历史消息分页加载
- 当前会话 localStorage 持久化
- 首次消息自动生成标题

### 4.7 Character State 角色状态系统 ✅

- `character_state` 表保存角色动态运行态
- 心情、精力、亲密度、关系等级与最近互动时间
- 用户消息触发确定性、可解释的轻量规则更新
- 状态作为 system prompt 注入，影响角色回复语气
- 前端 Pinia state store 缓存并展示当前角色状态
- 关系等级按 affinity 分为陌生、熟悉、朋友、亲密、特殊关系
- 状态分层影响回复：称呼、语气、主动关心和长期记忆权重

### 4.7 屏幕视觉感知 📋（规划中）

- 定时屏幕截图
- 多模态 VLM 分析
- 环境状态识别

### 4.8 情绪智能层 ✅（v0.17.0）

- 当前角色会话范围内识别用户开心、平静、焦虑、低落、愤怒、疲惫六类状态，并记录强度与置信度
- 规则兜底结合非阻塞结构化模型识别；模型不可用时不影响流式聊天
- 后续对话可自然参考近期趋势；用户可查看、修正、删除、清除历史或关闭分析
- 高风险表达只触发当轮安全陪伴指引，不写入普通情绪记录、长期记忆或主动通知
### 4.9 Live2D 角色系统 📋（规划中）

- 虚拟角色模型加载
- 表情切换、动作播放
- 口型同步

### 4.10 Agent 主动交互 📋（规划中）

- 定时状态评估
- 主动触发决策
- 系统通知推送

---

## 五、技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | ^3.5 | UI 框架 |
| TypeScript | ~5.7 | 类型安全 |
| Vite | ^6.0 | 构建工具 |
| Pinia | ^2.3 | 状态管理 |
| Element Plus | ^2.9 | UI 组件库 |
| Vue Router | ^4.5 | 前端路由 |
| SCSS | - | 样式预处理 |

### 桌面框架

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | ^33.3 | 桌面壳（窗口管理、截图、通知） |
| electron-builder | ^25.1 | 打包分发 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | ^11.0 | 服务端框架 |
| TypeORM | ^0.3 | ORM |
| MySQL | 8.0 | 关系型数据库 |
| ChromaDB | v2 API | 向量数据库 |
| Node.js | - | 运行时 |

### AI 能力

| 技术 | 用途 |
|------|------|
| OpenAI API（兼容） | LLM 调用、Embedding 向量化（支持 DeepSeek / Gemini 等） |
| 多模态 VLM | 屏幕内容理解（规划中） |
| Prompt 工程 | 角色人格、记忆提取模板 |

---

## 六、用户使用流程

```
启动应用
  │
  ▼
初始化引导页（后端健康检查 + 会话/角色/Provider 数据加载）
  │ 成功
  ▼
进入聊天界面 ←→ 设置页（随时可切换）
  │
  ├─ 输入消息 → SSE 流式返回 → 显示回复
  │
  ├─ 停止生成（中途取消）
  │
  └─ 自动提取记忆 → MySQL + Chroma 双写 → 下次聊天自动检索
```

### 后续扩展流程（规划）

```
屏幕感知定时触发 → VLM 分析 → Agent 决策 → 主动发言 / 保持沉默
情绪系统 → 根据交互更新 → 影响回复语气 + Live2D 表现
```

---

## 七、项目目录结构

```
毕业设计/
│
├── src/                          # 前端（Vue3）
│   ├── views/                    # 页面视图
│   │   ├── ChatView.vue              # 主聊天界面
│   │   ├── InitializationView.vue    # 启动初始化引导页
│   │   └── SettingsView.vue          # 设置页
│   ├── components/               # 可复用组件
│   │   ├── chat/
│   │   │   └── ConversationSidebar.vue
│   │   └── settings/
│   │       ├── ProviderDialog.vue
│   │       ├── ProviderSettings.vue
│   │       ├── ModelSettings.vue
│   │       ├── CharacterSettings.vue
│   │       └── AboutSection.vue
│   ├── stores/                   # Pinia 状态管理
│   │   ├── chat.store.ts
│   │   ├── conversation.store.ts
│   │   ├── bootstrap.store.ts
│   │   ├── character.store.ts
│   │   ├── provider.store.ts
│   │   └── settings.store.ts
│   ├── services/                 # API 请求封装
│   │   ├── chat.api.ts
│   │   ├── conversation.api.ts
│   │   ├── character.api.ts
│   │   ├── provider.api.ts
│   │   └── health.api.ts
│   ├── types/                    # TypeScript 类型定义
│   │   ├── chat.types.ts
│   │   ├── conversation.types.ts
│   │   ├── character.types.ts
│   │   ├── provider.types.ts
│   │   └── settings.types.ts
│   ├── router/                   # Vue Router
│   │   └── index.ts
│   ├── styles/                   # 全局样式
│   │   └── global.scss
│   ├── App.vue
│   ├── env.d.ts
│   └── main.ts
│
├── electron/                     # Electron 主进程
│   ├── main.ts
│   └── preload.ts
│
├── server/                       # 后端（NestJS）
│   └── src/
│       ├── common/               # 公共工具（拦截器、错误格式化）
│       ├── database/             # 数据库迁移（预留）
│       ├── modules/              # 业务模块
│       │   ├── chat/             # 聊天编排
│       │   ├── context-window/   # 上下文窗口管理
│       │   ├── llm/              # LLM 调度
│       │   ├── memory/           # 长期记忆
│       │   ├── vector-memory/    # 向量记忆
│       │   ├── provider/         # Provider 管理
│       │   ├── character/        # 角色管理
│       │   └── conversation/     # 会话管理
│       ├── prompts/              # Prompt 模板
│       ├── app.module.ts
│       ├── app.controller.ts
│       └── main.ts
│
├── shared/                       # 前后端共享类型
│   └── types/
│
└── docs/                         # 项目文档
    ├── PROJECT_DOC.md            # 项目开发文档
    ├── ARCHITECTURE.md           # 系统架构说明
    ├── API_DOC.md                # API 接口规范
    ├── DATABASE.md               # 数据库设计文档
    ├── CHANGELOG.md              # 版本更新记录
    ├── TODO.md                   # 待开发功能列表
    ├── DEVELOPMENT_RULES.md      # 开发规范
    └── MODULES.md                # 模块职责文档
```

---

## 八、系统功能模块

| 模块 | 状态 | 位置 |
|------|------|------|
| Chat 聊天模块 | ✅ 已实现 | `server/src/modules/chat/` |
| LLM 模型调度 | ✅ 已实现 | `server/src/modules/llm/` |
| Context Window 管理 | ✅ 已实现 | `server/src/modules/context-window/context-window.manager.ts` |
| Prompt Context 构建 | ✅ 已实现 | `server/src/modules/chat/prompt-context.service.ts` |
| Character 角色人格 | ✅ 已实现 | `server/src/modules/character/` |
| Memory 长期记忆 | ✅ 已实现 | `server/src/modules/memory/` |
| Vector Memory 向量记忆 | ✅ 已实现 | `server/src/modules/vector-memory/` |
| Provider 管理 | ✅ 已实现 | `server/src/modules/provider/` |
| Conversation 会话管理 | ✅ 已实现 | `server/src/modules/conversation/` |
| Conversation Summary 长会话摘要 | ✅ 已实现 | `server/src/modules/conversation-summary/` |
| Character State 角色状态 | ✅ 已实现 | `server/src/modules/character-state/` |
| Relationship 角色关系系统 | ✅ 已实现 | `relationship_level` + CharacterStateService |
| Vision 视觉感知 | 📋 规划中 | — |
| Emotion 情绪智能层 | ✅ 已实现 | `server/src/modules/emotion/` |
| Agent 主动交互 | 📋 规划中 | — |
| Live2D 角色展示 | 📋 规划中 | — |
| Audio 语音交互 | 📋 规划中 | — |

---

## 九、开发阶段规划

| 阶段 | 内容 | 状态 |
|------|------|------|
| **阶段一：基础聊天** | Vue 聊天界面 + NestJS + LLM + SSE 流式 | ✅ 完成 |
| **阶段二：Provider 系统** | 多 Provider 管理 + API Key 安全 + 参数配置 | ✅ 完成 |
| **阶段三：角色人格** | Persona Prompt + 回复风格控制 | ✅ 完成 |
| **阶段四：记忆系统** | Memory Extractor + MySQL + ChromaDB + 语义检索 | ✅ 完成 |
| **阶段五：Live2D** | 模型加载 + 动作控制 + 表情切换 | 📋 规划中 |
| **阶段六：视觉感知** | 屏幕截图 + VLM 分析 | 📋 规划中 |
| **阶段七：语音交互** | TTS + STT + 口型同步 | 📋 规划中 |
| **阶段八：Agent** | 高阶自主行为与跨模态情绪决策 | 📋 规划中 |

---

## 十、项目创新点

1. **多模态大模型视觉感知** — AI 理解用户桌面环境
2. **长期记忆增强** — MySQL 结构化 + ChromaDB 向量，跨会话记忆保持
3. **人格化 AI 角色** — 稳定的角色设定与表达风格
4. **多 Provider 动态管理** — 支持任意 OpenAI 兼容 API，酒馆风格配置
5. **Live2D 实时表现** — 情绪驱动的可视化反馈（规划中）
6. **Agent 主动交互** — 从被动回答到主动关怀（规划中）
7. **桌面环境深度融合** — Electron 原生能力的充分利用

---

## v0.18.0 通用角色形象与 Live2D 桌宠 ✅

- Electron 新增独立透明桌宠窗口，支持置顶、拖动、缩放、隐藏、配置持久化和聊天窗口聚焦。
- 模型通过 `resources/live2d/<modelId>/model.json` 注册；运行时校验元数据、基础资源和路径，支持内置模型与开发者扩展目录。
- `Character.appearance` 负责角色形象配置，当前支持 `modelId`，并预留表情、动作、背景和主题扩展位。
- Live2D 由通用管理器和渲染适配器承载；模型动作仅通过语义能力映射，加载失败回退头像，不影响聊天。
- 聊天 SSE 通过 `PetEventBus` 映射为桌宠流式气泡；气泡是表现层，不会写入会话、记忆、情绪、关系或通知。
