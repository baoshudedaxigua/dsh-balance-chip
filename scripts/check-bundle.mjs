#!/usr/bin/env node
// Offline contract self-test for the dsh-balance-chip client bundle.
//
// It runs without installing anything: evaluate lib/client.js in a VM with a
// fake window.__ModuleLoader__, then assert the plugin contract the DSH web
// shell depends on. Also validates package.json declarations and the absence of
// cross-package value imports (the "bundle purity" rule).
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`)
    console.log(`  FAIL ${name}${detail ? `: ${detail}` : ''}`)
  }
}

// ---- package declarations
const pkgPath = path.join(root, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
console.log('package.json')
check('name is dsh-balance-chip', pkg.name === 'dsh-balance-chip', pkg.name)
check('dsh.client.platform is web', pkg.dsh?.client?.platform === 'web')
check('dsh.bundle.patch declared', typeof pkg.dsh?.bundle?.patch === 'string')
check('exports["./client"] points at an existing bundle', (() => {
  const target = path.join(root, pkg.exports?.['./client'] ?? '')
  return typeof pkg.exports?.['./client'] === 'string' && fs.existsSync(target)
})())
check('exports["."] points at an existing host half', (() => {
  const target = path.join(root, pkg.exports?.['.'] ?? '')
  return typeof pkg.exports?.['.'] === 'string' && fs.existsSync(target)
})())
check('bundle patch file exists', fs.existsSync(path.join(root, pkg.dsh.bundle.patch)))

// ---- client bundle: register, exports, no platform require()
const bundlePath = path.join(root, 'lib/client.js')
const code = fs.readFileSync(bundlePath, 'utf8')
console.log('lib/client.js')
check('bundle is non-empty', code.length > 0)
check('bundle source is ASCII (escaped non-ASCII keeps it portable)', /^[\x00-\x7F]*$/.test(code))
check('bundle performs no require() of host modules', !/\brequire\s*\(/.test(code.replace(/factory:\s*\(require\)/, '')))
check('bundle calls window.__ModuleLoader__.load', code.includes('window.__ModuleLoader__.load('))

let registered
const sandbox = {
  window: {
    __ModuleLoader__: { load: (options) => { registered = options } },
    setTimeout,
    setInterval,
    clearInterval,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  document: undefined,
  MutationObserver: undefined,
  console,
  setTimeout,
  setInterval,
  clearInterval,
  Date,
  Number,
  Math,
  isFinite,
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(code, sandbox)

check('bundle registered through __ModuleLoader__.load', Boolean(registered))
if (registered) {
  check('bundle id is dsh-balance-chip', registered.id === 'dsh-balance-chip', registered.id)
  check('factory is a function', typeof registered.factory === 'function')
  const mod = registered.factory((specifier) => {
    throw new Error(`bundle must not require platform module "${specifier}"`)
  })
  check('exports name', mod.name === 'dsh-balance-chip', mod.name)
  check('exports inject array', Array.isArray(mod.inject), JSON.stringify(mod.inject))
  check('injects remote.account', Array.isArray(mod.inject) && mod.inject.includes('remote.account'))
  check('exports apply function', typeof mod.apply === 'function')
  // Applying without a DOM must be a no-op, never a throw: client boot is
  // all-or-nothing, so an exception here would freeze the whole shell.
  try {
    mod.apply({ effect: (fn) => fn(), locale: { getSnapshot: () => ({ active: 'zh' }) }, remote: {} })
    check('apply() survives an environment without DOM', true)
  } catch (error) {
    check('apply() survives an environment without DOM', false, error.message)
  }
}

// ---- host half
console.log('lib/index.js')
const hostCode = fs.readFileSync(path.join(root, 'lib/index.js'), 'utf8')
check('host half exports apply', /export\s+function\s+apply\s*\(/.test(hostCode))
check('host half exports name', /export\s+const\s+name\s*=/.test(hostCode))

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
