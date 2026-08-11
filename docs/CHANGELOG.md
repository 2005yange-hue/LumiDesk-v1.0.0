# Changelog

本文件记录项目的所有重要变更。

---

## v0.1.0 — 项目初始化

**日期：** 2026-08-11

### 新增
- 初始化项目架构：Electron + Vue3 + NestJS
- 创建完整目录结构（electron/、src/、server/、shared/、resources/）
- 配置 Vite 构建 + Electron 打包
- 配置 ESLint + Prettier + TypeScript
- 创建开发者文档体系（docs/ 目录 7 份文档）
- NestJS 后端健康检查接口 `GET /api/health`
- Electron 无边框透明窗口 + IPC 通信框架

---

## v0.2.0 — 基础聊天功能

**日期：** 2026-08-11

### 新增
- ChatModule + ChatController：`POST /api/chat/send` SSE 流式接口
- LLM 适配器模块：`ILLMAdapter` 接口 + `OpenAIAdapter` 实现
- 支持 OpenAI / DeepSeek / Qwen 等兼容 API
- Vue3 聊天界面（ChatView）：消息气泡、自动滚动、欢迎页
- Pinia 聊天状态管理（chat.store）
- Fetch + ReadableStream 前端 SSE 解析

### 修改
- `server/src/app.module.ts` — 注册 ChatModule + LLMModule
- `server/src/modules/llm/llm.service.ts` — LLM 调度服务

---

## v0.3.0 — 模型配置与流式优化

**日期：** 2026-08-11

### 新增
- 设置页面（SettingsView）：模型预设选择 + API 配置 + 参数调节
- localStorage 配置持久化（settings.store）
- 5 个预设模型快捷切换（GPT-4o / DeepSeek / Qwen 等）
- 停止生成按钮：AbortController 中断流式请求
- Enter 键智能处理（生成中停止 / 待机中发送）
- RuntimeModelConfig 运行时模型配置（环境变量 + 前端传入合并）

### 修改
- `server/src/modules/llm/llm.service.ts` — 重写，支持运行时配置 + 适配器缓存池
- `server/src/modules/chat/chat.service.ts` — 透传 modelConfig
- `server/src/modules/chat/chat.controller.ts` — Body 接收 modelConfig
- `server/src/modules/chat/dto/send-message.dto.ts` — 新增 ModelConfigDto
- `src/services/chat.api.ts` — 重写，AbortController + modelConfig 传递
- `src/stores/chat.store.ts` — 新增 stopGeneration + 集成 settingsStore
- `src/views/ChatView.vue` — 发送/停止按钮动态切换

---


## v0.4.0 — 角色人格系统

**日期：** 2026-08-11

### 新增
- Character 模块 CRUD 接口（`GET/POST/PUT/DELETE /api/character`）
- `PersonaBuilder` 动态 Prompt 生成器（完整版/精简版）
- 角色数据 JSON 文件持久化（`server/data/characters.json`）
- 前端角色管理界面（设置页新增"角色设置"标签）
- 角色创建/删除/切换功能
- 聊天请求携 characterId 自动使用对应角色人格
- 默认角色"艾莉"自动从 `character.txt` 模板初始化

### 修改
- `server/src/app.module.ts` — 注册 CharacterModule
- `server/src/modules/chat/chat.service.ts` — 集成 CharacterService + PersonaBuilder
- `server/src/modules/chat/chat.controller.ts` — 接收 characterId 参数
- `src/stores/settings.store.ts` — 新增 activeCharacterId
- `src/services/chat.api.ts` — 新增 characterId 参数
- `src/stores/chat.store.ts` — 传递 characterId
- `src/views/SettingsView.vue` — 新增角色管理 + 创建弹窗

---

## 后续版本规划

### v0.5.0 — 记忆系统
- MySQL + TypeORM 数据持久化
- 向量数据库集成（Chroma）
- 聊天记录保存
- 长期记忆提取与检索

### v0.6.0 — Live2D 角色展示
- Live2D 模型加载
- 动作/表情控制
- 情绪-动作映射

### v0.7.0 — 视觉感知
- Electron 截图采集
- VLM 多模态分析
- 环境状态识别

### v0.8.0 — Agent 主动交互
- 行为决策引擎
- 情绪系统动态变化
- 主动提醒与通知
