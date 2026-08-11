import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHello(): string {
    return 'AI Desktop Companion API is running!'
  }
}
