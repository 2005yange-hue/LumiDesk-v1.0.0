import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe } from '@nestjs/common'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppModule } from './app.module'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { CHARACTER_AVATAR_DIR } from './modules/character/character.service'

async function bootstrap() {
  const dataDir = process.env.LUMIDESK_DATA_DIR || resolve(process.cwd(), 'data')
  mkdirSync(dataDir, { recursive: true })
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // 启用 CORS（允许 Electron 渲染进程访问）
  app.enableCors({
    origin: (origin, callback) => {
      // Electron file pages serialize their origin as file:// (or null). A
      // wildcard is the only interoperable response for these opaque origins.
      if (origin === 'null' || (origin && /^file:/i.test(origin))) {
        callback(null, '*')
        return
      }
      if (!origin || /^(https?:\/\/(localhost|127\.0\.0\.1):\d+|app:\/\/[^/]+)$/i.test(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin not allowed'))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false
  })

  app.useStaticAssets(CHARACTER_AVATAR_DIR, {
    prefix: '/uploads/avatars/'
  })

  // 全局前缀
  app.setGlobalPrefix('api')

  // 全局参数校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  )

  // 全局响应拦截器
  app.useGlobalInterceptors(new ResponseInterceptor())

  const port = Number(process.env.SERVER_PORT || 3000)
  const host = process.env.SERVER_HOST || '127.0.0.1'
  await app.listen(port, host)
  console.log(`LumiDesk server running on http://${host}:${port}`)
}
bootstrap()
