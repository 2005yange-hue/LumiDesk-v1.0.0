import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { join, resolve } from 'node:path'

const dataDir = process.env.LUMIDESK_DATA_DIR || resolve(process.cwd(), 'data')
const databaseType = (process.env.DATABASE_TYPE || 'sqlite').toLowerCase()

export default new DataSource(databaseType === 'mysql'
  ? {
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'ai_companion',
      entities: [resolve(__dirname, 'modules/**/*.entity{.ts,.js}')],
      migrations: [resolve(__dirname, 'database/migrations/*{.ts,.js}')]
    }
  : {
      type: 'better-sqlite3',
      database: process.env.SQLITE_PATH || join(dataDir, 'lumidesk.sqlite'),
      entities: [resolve(__dirname, 'modules/**/*.entity{.ts,.js}')],
      migrations: [resolve(__dirname, 'database/migrations/*{.ts,.js}')]
    })
