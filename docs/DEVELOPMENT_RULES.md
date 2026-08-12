# 开发规范

> AI 辅助开发环境下的代码规范与协作约定
> 适用对象：开发者 + AI 编程助手

---

## 一、架构红线

以下规则**绝对不可违反**：

1. **不允许随意修改项目架构** — 新增模块必须遵循已有的模块划分方式
2. **禁止删除已有功能模块** — 只允许扩展，不允许删除
3. **不允许重写已有架构** — 在现有结构上增量开发
4. **保持模块独立性** — Chat / LLM / Memory / Vision 等模块解耦，互不直接依赖各自内部实现

---

## 二、修改代码前的必要步骤

### 必须顺序执行：

1. **阅读相关文档**
   - [PROJECT_DOC.md](./PROJECT_DOC.md) — 了解项目全貌
   - [ARCHITECTURE.md](./ARCHITECTURE.md) — 了解模块关系
   - [TODO.md](./TODO.md) — 确认不重复实现

2. **分析影响范围**
   - 列出需要修改的文件
   - 确认不破坏已有功能
   - 如修改超过 5 个文件，必须先说明原因，等待确认

3. **阅读目标文件**
   - 修改前必须完整阅读目标文件
   - 理解现有代码逻辑后再修改

---

## 三、修改后的必要步骤

1. **更新对应文档**
   - API 变更 → 更新 [API_DOC.md](./API_DOC.md)
   - 数据库变更 → 更新 [DATABASE.md](./DATABASE.md)
   - 架构变更 → 更新 [ARCHITECTURE.md](./ARCHITECTURE.md)

2. **更新 [CHANGELOG.md](./CHANGELOG.md)**
   - 记录所有新增、修改、删除

3. **更新 [TODO.md](./TODO.md)**
   - 标记已完成功能
   - 添加新规划任务

4. **说明修改文件**
   - 每次对话结束时列出所有修改过的文件

---

## 四、代码规范

### 4.1 TypeScript

- 保持严格类型声明（`strict: true`）
- 禁止使用 `any`（除非确实无法推断）
- 接口和类型定义统一放在 `types/` 或 `dto/` 目录中
- 枚举类型使用 `enum`（共享常量）或 `const` 对象字面量

### 4.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `chat.service.ts` |
| 类名 | PascalCase | `ChatService` |
| 函数/方法 | camelCase | `sendMessage()` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_MODEL_SETTINGS` |
| Vue 组件 | PascalCase | `ChatView.vue` |
| 目录名 | kebab-case | `chat/dto/` |
| 接口 | I 前缀（后端）或无前缀（前端） | `ILLMAdapter` / `ChatMessage` |

### 4.3 Vue 风格

- 使用 `<script setup>` 语法
- 样式使用 `<style scoped lang="scss">`
- 组件按功能分子目录（`chat/`、`settings/`、`live2d/`）
- Store 使用 Pinia Composition API（`defineStore` + `setup` 写法）

### 4.4 NestJS 规范

- 每个模块包含：`module.ts`、`controller.ts`、`service.ts`
- DTO 使用 `class-validator` 装饰器校验
- Prompt 模板单独存放于 `server/src/prompts/`
- 不在 Controller 中写业务逻辑

### 4.5 错误处理

- LLM 调用必须有 try-catch，并分类错误信息
- 前端 API 调用必须处理网络异常
- 敏感信息（API Key）不在日志中输出

---

## 五、Git 提交规范

### 提交格式

```
<type>: <描述>
```

### Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新增功能 | `feat: 实现 SSE 流式聊天` |
| `fix` | 修复 Bug | `fix: 修复聊天历史丢失问题` |
| `refactor` | 代码重构 | `refactor: 重构 LLM 适配器` |
| `docs` | 文档更新 | `docs: 创建开发规范文档` |
| `style` | 代码格式 | `style: 统一缩进格式` |
| `chore` | 构建/工具 | `chore: 升级依赖版本` |
| `test` | 测试 | `test: 添加聊天模块单元测试` |

### 提交示例

```
feat: 添加 Live2D 角色渲染组件

fix: 修复 SSE 流中断后无法恢复的问题

refactor: 将 LLM 配置从 env 迁移到运行时传入

docs: 新增 API_DOC.md 和 DATABASE.md
```

---

## 六、文档维护规则

### 必须同步更新的文档

| 变更类型 | 需要更新的文档 |
|----------|---------------|
| 新增/修改 API | `API_DOC.md` |
| 新增/修改数据表 | `DATABASE.md` |
| 模块关系变化 | `ARCHITECTURE.md` |
| 新增/删除功能 | `PROJECT_DOC.md` + `TODO.md` |
| 任何代码变更 | `CHANGELOG.md` |

### 文档编写规范

- 使用 Markdown 格式
- 文档语言：中文
- 已完成功能标注 `✅`
- 规划中功能标注 `📋`
- 禁止在文档中标记虚假的已完成状态

---

## 七、隐私与安全

1. **API Key 绝不硬编码** — 运行时从 localStorage 或环境变量读取
2. **屏幕截图默认关闭** — 需要用户授权
3. **聊天数据本地存储** — 不上传至第三方服务器
4. **环境变量文件加入 .gitignore** — 不提交 `.env`

---

## 八、AI 助手协作约定

AI 编程助手（如当前助手）在进行开发时需要遵循：

1. **先读后写** — 修改文件前先用 Read 工具读取
2. **不改无关代码** — 只修改与任务直接相关的文件
3. **不创建非必要文件** — 避免文件膨胀
4. **保持简洁** — 不做过度设计，满足当前需求即可
5. **汇报修改** — 每次完成后列出所有变更文件
6. **类型安全** — 不破坏 TypeScript 类型系统
7. **构建验证** — 修改后端代码后执行 `npm run build` 确认无错误

---
## 九、NestJS 模块依赖规范

新增业务模块时必须：

1. 创建 xxx.module.ts

2. Service 如果需要被其他模块调用，必须加入 exports

```
exports: [XxxService]
```

3. 使用该 Service 的模块，必须 imports 对应 Module

```
imports: [XxxModule]
```

4. 修改完成后检查：Module 注册 / Provider 注入 / Service 依赖 / Controller 路由

---

## 十、模块开发规范

### 10.1 模块边界原则

**一个业务能力 = 一个 NestJS Module。**

禁止将不相关的功能堆积到已有模块，尤其是 ChatService。

| 功能 | 所属模块 | 禁止 |
|------|----------|------|
| 对话流程编排 | ChatModule | 不要放记忆/语音/视觉逻辑 |
| 记忆提取与存储 | MemoryModule | 不要放向量检索逻辑 |
| 向量化与语义搜索 | VectorMemoryModule | 不要放记忆提取逻辑 |
| Provider 管理 | ProviderModule | 不要放聊天配置解析 |

### 10.2 新功能开发流程

1. 在 `MODULES.md` 中确认模块职责
2. 定义接口（interface / DTO）
3. 编写 NestJS Module → Service → Controller
4. 编写前端 Component + Store
5. 补充 API 文档 → `API_DOC.md`
6. 更新 CHANGELOG → `CHANGELOG.md`
7. 更新 TODO → `TODO.md`

### 10.3 Vue 开发规范

- 页面组件和业务逻辑分离
- Settings 页面按功能分区
- 组件按功能分子目录（`chat/`、`settings/`、`live2d/`）

---

## 十一、AI Prompt 管理规范

1. **Prompt 不硬编码** — 所有模板存放在 `server/src/prompts/`
2. **文件名语义化** — `system.txt`、`character.txt`、`memory-extraction.txt`
3. **加载方式** — 通过 `loadPrompt(fileName)` 读取，失败降级为空字符串
4. **构建保障** — `nest-cli.json` 配置 assets 自动复制到 `dist/prompts/`
5. **修改后重启** — Prompt 文件修改后需重启服务才能生效

禁止在代码中硬编码角色人格或系统指令。