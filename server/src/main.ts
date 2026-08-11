import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 启用 CORS（允许 Electron 渲染进程访问）
  app.enableCors({
    origin: ['http://localhost:5173', 'app://.'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
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

  const port = process.env.SERVER_PORT || 3000
  await app.listen(port)
  console.log(`🚀 Server running on http://localhost:${port}`)
}
bootstrap()
