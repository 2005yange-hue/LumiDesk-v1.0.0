# LumiDesk

LumiDesk 是一个基于 Electron 的 AI 桌面虚拟伙伴。它将多模态聊天、长期记忆、角色状态、情绪与关系系统、Live2D 桌宠和语音能力整合到一个本地桌面应用中。

## 功能

- OpenAI 兼容 Provider 的流式 AI 聊天和多会话管理。
- 角色人格、角色状态、用户情绪、关系成长和主动通知。
- 结构化长期记忆，可选 Chroma 语义检索；单机版默认使用 SQLite，Chroma 默认关闭。
- Live2D 模型注册、角色切换、桌宠拖动、缩放、穿透和右键操作菜单。
- 表现层支持聊天阶段、情绪、动作、表达式、Eye Tracking、Breathing、Timeline 和快照调试。
- TTS/STT 语音模块，支持 OpenAI 兼容语音 Provider 和本地 GPT-SoVITS v2ProPlus。
- AI 回复完成后自动朗读，并与 Live2D speaking 动作联动；不支持口型同步的模型会安全降级。

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Pinia、Element Plus
- 桌面：Electron
- 后端：NestJS、TypeORM
- 数据库：SQLite（默认）、MySQL（可选）
- 视觉：Live2D Cubism、Pixi Runtime
- AI：OpenAI 兼容 LLM/VLM Provider、可选 ChromaDB
- 语音：OpenAI 兼容 TTS/STT、GPT-SoVITS v2ProPlus

## 环境要求

开发环境需要：

- Windows 10/11（桌面和 Electron 打包主要面向 Windows）。
- Node.js 22 或兼容的 LTS 版本。
- npm。
- 运行源码时不要求 MySQL、Docker 或 Chroma；默认 SQLite 会自动创建。
- GPT-SoVITS 语音需要单独安装其运行环境和模型。推荐使用 NVIDIA GPU；没有本地语音时，文字聊天和 Live2D 仍可使用。

普通用户使用安装包时不需要安装 Node.js、MySQL、Docker Desktop 或 Python。Electron 会自动启动内置 NestJS 后端，并在用户数据目录创建 SQLite 数据库。

## 开发环境安装

```bash
# 克隆仓库
git clone https://github.com/2005yange-hue/AI-Virtual-Companion.git
cd AI-Virtual-Companion

# 安装前端和 Electron 依赖
npm install

# 安装 NestJS 后端依赖
cd server
npm install
cd ..

# 创建本地配置
copy .env.example .env
```

编辑 `.env`，至少配置一个可用的 LLM Provider。API Key 只保存在本机 `.env` 或应用设置中，不要提交到 Git、截图或公开日志。

## 开发命令

```bash
npm run dev          # 启动 Vite 前端，默认端口 5173
npm run dev:server   # 启动 NestJS 后端，默认端口 3000
npm run dev:all      # 同时启动前端和后端

npm run build        # 类型检查和前端生产构建
npm run build:server # 编译 NestJS 后端
npm run build:electron # 生成 .build/release 中间产物
npm run build:portable # 生成安装包和完整便携版
```

开发时也可以使用根目录的 `Start.bat` 启动前端、后端和 Electron。它只用于开发调试，不是普通用户的运行入口。

## 配置说明

`.env.example` 只包含配置模板和占位符，不包含任何真实密钥。常用配置包括：

- `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`：聊天模型。
- `VLM_API_KEY`、`VLM_BASE_URL`、`VLM_MODEL`：视觉模型，可选。
- `DATABASE_TYPE=sqlite`：默认单机数据库模式。
- `DATABASE_TYPE=mysql` 和 `MYSQL_*`：需要外部 MySQL 时使用。
- `VECTOR_DB_PROVIDER=disabled`：默认不连接 Chroma；主动配置为 `chroma` 后才启用语义检索。
- `GPT_SOVITS_ROOT`：本地 GPT-SoVITS 模型目录。

SQLite 数据默认位于开发目录的 `server/data/`，打包版位于 Electron 用户数据目录。数据库文件、用户头像、运行时 JSON 和音频缓存均不会提交到仓库。

## GPT-SoVITS 本地语音

GPT-SoVITS 模型和 Python Runtime 体积较大，出于仓库体积和许可管理原因，不随 LumiDesk Git 仓库发布，也不打进安装包。

将完整的 GPT-SoVITS 目录放在项目根目录：

```text
LumiDesk/
└─ GPT-SoVITS-v2pro-20250604/
```

或在 `.env` 中设置：

```env
GPT_SOVITS_ROOT=D:/path/to/GPT-SoVITS-v2pro-20250604
```

目录应包含 `runtime/python.exe`、`api_v2.py`、GPT/SoVITS 权重、BERT、HuBERT、v2ProPlus 基础模型和 `yinpin` 参考音频。模型缺失时，语音功能会显示错误并降级，不会阻塞文字聊天。

## Windows 运行方式

### 安装版

运行 `LumiDesk Setup 0.1.0.exe`，按安装向导选择目录。安装版会自动启动内置后端，普通用户不需要手动运行 `.bat`、Node.js 或数据库服务。

### 便携版

运行：

```text
LumiDesk Portable/LumiDesk.exe
```

`LumiDesk Portable/` 必须整体保留。不能只复制 `LumiDesk.exe`，因为它还依赖同目录的 Electron DLL、`locales/`、`resources/app.asar`、Live2D 运行库和内置后端。

## 项目文档

| 文档 | 内容 |
| --- | --- |
| [项目开发文档](./docs/PROJECT_DOC.md) | 项目概述、目录结构和开发约定 |
| [系统架构](./docs/ARCHITECTURE.md) | 前后端、Electron、Live2D 和 AI 链路 |
| [API 文档](./docs/API_DOC.md) | REST、SSE、音频和健康检查接口 |
| [数据库设计](./docs/DATABASE.md) | SQLite/MySQL 表结构和迁移说明 |
| [模块说明](./docs/MODULES.md) | 各业务模块职责和边界 |
| [迁移文件](./docs/migrations/) | 生产环境数据库迁移参考 |
| [更新记录](./docs/CHANGELOG.md) | 版本变更历史 |
| [待办事项](./docs/TODO.md) | 已知限制和后续计划 |
| [开发规范](./docs/DEVELOPMENT_RULES.md) | 代码和协作规范 |

## 隐私与安全

- 不要提交 `.env`、API Key、Cookie、数据库、用户头像、聊天记录或本地音频。
- 不要将 `GPT-SoVITS-v2pro-20250604/`、`node_modules/`、`dist/`、`.build/` 或便携版目录上传到 Git。
- 提交前使用 `git status` 和 `git diff --cached --name-only` 检查暂存区。
- 如果密钥曾经误提交，应立即在 Provider 平台撤销并重新生成；删除文件本身不能消除 Git 历史中的泄露。

## v1.0.0

v1.0.0 是 LumiDesk 的首个完整桌面发布版本，包含 SQLite 默认运行、Electron 内置后端、Live2D 桌宠、表现调试、聊天上下文、记忆/情绪/关系系统以及可选语音能力。

已知限制：GPT-SoVITS 模型需要用户单独下载和配置；没有签名证书的 Windows 安装包可能被 SmartScreen 显示未识别发布者提示。
