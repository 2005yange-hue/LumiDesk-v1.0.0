import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const buildRoot = join(root, '.build', 'release')
const unpacked = join(buildRoot, 'win-unpacked')
const portable = join(root, 'LumiDesk Portable')
const installer = join(buildRoot, 'LumiDesk Setup 0.1.0.exe')
const rootInstaller = join(root, 'LumiDesk Setup 0.1.0.exe')

if (process.platform !== 'win32') {
  throw new Error('便携版导出当前只支持 Windows')
}
if (!existsSync(join(unpacked, 'LumiDesk.exe'))) {
  throw new Error(`找不到完整便携版输入目录：${unpacked}`)
}
if (!existsSync(installer)) {
  throw new Error(`找不到安装包：${installer}`)
}

rmSync(portable, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
mkdirSync(portable, { recursive: true })
const copy = spawnSync('robocopy', [unpacked, portable, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' })
if ((copy.status ?? 16) > 7) throw new Error(`便携版复制失败（robocopy code=${copy.status ?? 'unknown'}）`)
cpSync(installer, rootInstaller)

console.log(`便携版已导出：${portable}`)
console.log(`安装包已复制：${rootInstaller}`)
