import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface WrappedResponse<T = unknown> {
  success: boolean
  data: T
  message: string
  timestamp: string
}

/**
 * 全局响应拦截器
 * 将普通 REST API 返回值统一包装为 { success, data, message, timestamp }
 * 自动跳过 SSE 流式响应（text/event-stream）
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, WrappedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<WrappedResponse<T>> {
    const response = context.switchToHttp().getResponse()

    return next.handle().pipe(
      map((data) => {
        // SSE 流式响应不包装
        if (response.getHeader('Content-Type') === 'text/event-stream') {
          return data
        }

        return {
          success: true,
          data,
          message: 'success',
          timestamp: new Date().toISOString()
        }
      })
    )
  }
}
