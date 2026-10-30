import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const packages = new Map()
function collect(name, parent) {
  const require = createRequire(parent)
  // Resolve manifest files directly so type-only packages and restrictive
  // package exports do not require a JavaScript entrypoint.
  for (const search of require.resolve.paths(name) ?? []) {
    const manifest = path.join(search, name, 'package.json')
    if (fs.existsSync(manifest)) {
      const actualManifest = fs.realpathSync(manifest)
      const directory = path.dirname(actualManifest)
      const info = JSON.parse(fs.readFileSync(actualManifest, 'utf8'))
      if (info.name === name) {
        const key = `${name}@${info.version}`
        if (packages.has(key)) return
        const files = fs.readdirSync(directory).filter((file) => /^(licen[cs]e|copying)(?:\.|$)/i.test(file))
        if (!files.length) throw new Error(`Missing license text for ${key}`)
        const text = files.sort().map((file) => fs.readFileSync(path.join(directory, file), 'utf8').trim()).join('\n\n')
        packages.set(key, { license: info.license, text })
        for (const dependency of Object.keys(info.dependencies ?? {})) collect(dependency, actualManifest)
        return
      }
    }
  }
  throw new Error(`Could not locate ${name}`)
}
const parent = path.join(root, 'package.json')
for (const name of Object.keys(project.dependencies)) collect(name, parent)
// Tailwind supplies preflight CSS; Vite supplies the generated preload helper.
for (const name of ['tailwindcss', 'vite']) collect(name, parent)
const output = [
  'SkillBridge — third-party software notices',
  'Generated from the installed locked dependencies. Retain these notices when redistributing this build.',
  'Includes runtime dependencies and the Tailwind/Vite build components. This does not assign a license to SkillBridge itself.',
  ...[...packages.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) =>
    `\n${'='.repeat(72)}\n${name}\nDeclared license: ${value.license}\n${'='.repeat(72)}\n\n${value.text}`,
  ),
  '',
].join('\n\n')
const target = path.join(root, 'public', 'third-party-notices.txt')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, output)
console.log(`Wrote public/third-party-notices.txt for ${packages.size} dependency versions`)
