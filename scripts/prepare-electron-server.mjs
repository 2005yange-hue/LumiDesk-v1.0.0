import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const source = join(root, 'server')
const staging = join(root, '.electron-server')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function copyDirectory(from, to) {
  if (process.platform === 'win32') {
    const copy = spawnSync('robocopy', [from, to, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' })
    if ((copy.status ?? 16) > 7) {
      console.error(`复制服务端目录失败（robocopy code=${copy.status ?? 'unknown'}）：${from}`)
      process.exit(copy.status || 1)
    }
    return
  }
  cpSync(from, to, { recursive: true })
}

// Windows Defender and a just-exited Electron process can briefly retain files
// in the staging directory. Retry transient filesystem failures before aborting
// a release build.
rmSync(staging, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
mkdirSync(staging, { recursive: true })
copyDirectory(join(source, 'dist'), join(staging, 'dist'))
cpSync(join(source, 'package.json'), join(staging, 'package.json'))
cpSync(join(source, 'package-lock.json'), join(staging, 'package-lock.json'))
copyDirectory(join(source, 'node_modules'), join(staging, 'node_modules'))

const npmOptions = { cwd: staging, stdio: 'inherit', shell: process.platform === 'win32' }
const prune = spawnSync(npm, ['prune', '--omit=dev', '--ignore-scripts'], npmOptions)
if (prune.status !== 0) {
  console.error(`清理服务端开发依赖失败（npm prune code=${prune.status ?? 'unknown'} signal=${prune.signal ?? 'none'} error=${prune.error?.message ?? 'none'}）`)
  process.exit(prune.status || 1)
}

const rebuild = spawnSync(npm, [
  'rebuild', 'better-sqlite3',
  '--runtime=electron',
  '--target=33.3.1',
  '--dist-url=https://electronjs.org/headers'
], npmOptions)
if (rebuild.status !== 0) {
  console.error(`重建 better-sqlite3 失败（npm rebuild code=${rebuild.status ?? 'unknown'}）`)
  process.exit(rebuild.status || 1)
}

const sqliteBinary = join(staging, 'node_modules', 'better-sqlite3', 'build', 'Release', process.platform === 'win32' ? 'better_sqlite3.node' : 'better_sqlite3.node')
if (!existsSync(sqliteBinary)) {
  console.error('Electron server staging 缺少 better-sqlite3')
  process.exit(1)
}

// A normal Node install can load better-sqlite3 while the packaged Electron
// process still fails with an ABI mismatch. Verify it with the exact Electron
// runtime that electron-builder will package.
const electronBinary = process.platform === 'win32'
  ? join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
  : join(root, 'node_modules', 'electron', 'dist', 'electron')
if (!existsSync(electronBinary)) {
  console.error(`找不到 Electron runtime，无法验证 native module：${electronBinary}`)
  process.exit(1)
}
const verify = spawnSync(electronBinary, ['-e', "const Database = require('./node_modules/better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); console.log('Electron better-sqlite3 ABI ok')"], {
  cwd: staging,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit'
})
if (verify.status !== 0) {
  console.error('better-sqlite3 未按 Electron ABI 构建，停止打包')
  process.exit(verify.status || 1)
}

console.log(`Electron server staging ready: ${staging}`)
