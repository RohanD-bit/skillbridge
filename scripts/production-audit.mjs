import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

// Read-only, value-redacting heuristic audit. It never reads ignored .env files,
// contacts a remote service, changes Git, or prints matched credential values.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
})
const findings = []
const reviewedSyntheticFixtures = []
// Manually reviewed negative configuration test, explicitly labeled "fixture"
// and "not_a_real_key". A different value or file will still be reported.
const fixtureFingerprint = '02fbfeb8ac5d25d9183ab5e49151bdc062ed84d0386f55998f906edd7bd00d16'
const patterns = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{20,}/g],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['database credential URL', /postgres(?:ql)?:\/\/[^\s'"<>]+:[^\s'"<>]+@/g],
  ['AWS access key identifier', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
]
function scan(source, text) {
  for (const [kind, pattern] of patterns) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      if (kind === 'Supabase secret key' && source.endsWith('src/auth/supabase-config.test.ts') &&
        createHash('sha256').update(match[0]).digest('hex') === fixtureFingerprint) {
        reviewedSyntheticFixtures.push({ source, kind: 'Reviewed dummy negative-test key' })
      } else findings.push({ source, kind })
    }
  }
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)) {
    try {
      const claims = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString())
      if (claims.role !== 'anon') findings.push({ source, kind: 'JWT requiring secret review' })
    } catch { /* An arbitrary dotted string is not necessarily a JWT. */ }
  }
}
const tracked = git('ls-files', '-z').split('\0').filter(Boolean)
const working = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
const trackedEnvironmentFiles = tracked.filter((file) =>
  /(^|\/)\.env(?:\.|$)/.test(file) && path.basename(file) !== '.env.example',
)
for (const file of working) scan(`working:${file}`, fs.readFileSync(path.join(root, file), 'utf8'))

const objects = git('rev-list', '--objects', '--all').trim().split('\n').filter(Boolean)
const paths = new Map(objects.map((line) => {
  const split = line.indexOf(' ')
  return [split === -1 ? line : line.slice(0, split), split === -1 ? '(object)' : line.slice(split + 1)]
}))
const descriptions = execFileSync('git', ['cat-file', '--batch-check'], {
  cwd: root, input: [...paths.keys()].join('\n') + '\n', encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
}).trim().split('\n')
const blobs = descriptions.filter((line) => line.split(' ')[1] === 'blob').map((line) => line.split(' ')[0])
// Read each unique blob once across every local ref, including deleted content.
for (const hash of blobs) scan(`history:${hash.slice(0, 12)}:${paths.get(hash)}`, git('cat-file', 'blob', hash))
const historyPaths = [...new Set(git('log', '--all', '--format=', '--name-only', '-z').split(/[\0\r\n]+/).filter(Boolean))]
const historicalEnvironmentFiles = historyPaths.filter((file) =>
  /(^|\/)\.env(?:\.|$)/.test(file) && path.basename(file) !== '.env.example',
)
const authors = [...new Set(git('log', '--all', '--format=%ae%n%ce').trim().split('\n').filter(Boolean))]
const nonNoreplyAuthorEmailCount = authors.filter((email) => !email.endsWith('@users.noreply.github.com')).length
const bundleFiles = []
function walk(directory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else {
      bundleFiles.push(file)
      const contents = fs.readFileSync(file, 'utf8')
      scan(`bundle:${path.relative(root, file)}`, contents)
      if (/\bcorrect_answer\b/.test(contents)) findings.push({ source: `bundle:${path.relative(root, file)}`, kind: 'answer-key field name in browser output' })
    }
  }
}
walk(path.join(root, 'dist'))
const report = {
  scope: 'Tracked working files, all history reachable from local refs, current dist output. Heuristic patterns; not a guarantee against all secrets or personal data.',
  commits: Number(git('rev-list', '--all', '--count').trim()),
  trackedFiles: tracked.length, nonIgnoredWorkingFiles: working.length, uniqueHistoricalBlobs: blobs.length,
  trackedEnvironmentFiles, historicalEnvironmentFiles,
  nonNoreplyAuthorEmailCount, bundleFiles: bundleFiles.length,
  reviewedSyntheticFixtures, findings,
}
console.log(JSON.stringify(report, null, 2))
if (findings.length || trackedEnvironmentFiles.length || historicalEnvironmentFiles.length) process.exitCode = 1
