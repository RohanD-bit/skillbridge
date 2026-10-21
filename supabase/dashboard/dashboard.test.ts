// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

const bank = [
  'budgeting',
  'budgeting',
  'budgeting',
  'saving',
  'saving',
  'credit',
  'credit',
  'credit',
  'investing',
  'investing',
].map((topic, index) => ({
  id: '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
  topic,
  question_text: 'Synthetic question',
  options: { A: 'One', B: 'Two', C: 'Three', D: 'Four' },
  difficulty: 'beginner',
  correct_answer: 'A',
}))
const answers = bank.map(({ id }, index) => ({
  question_id: id,
  answer: [0, 1, 3, 5, 6, 8].includes(index) ? 'A' : 'B',
}))
const expected = {
  total_questions: 10,
  correct_answers: 6,
  topic_scores: {
    budgeting: { correct: 2, total: 3 },
    saving: { correct: 1, total: 2 },
    credit: { correct: 2, total: 3 },
    investing: { correct: 1, total: 2 },
  },
}

type FunctionName = 'assessment-questions' | 'submit-assessment'

function boot(
  name: FunctionName | 'assessment-questions-diagnostic',
  configuration?: Record<string, string>,
) {
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8')
  const queries: { table: string; projection?: string; inserted?: unknown }[] =
    []
  const result = { data: bank as unknown, error: null as unknown }
  const saved = {
    data: { id: 'fixture-attempt', completed_at: '2026-10-20T12:00:00Z' },
    error: null as unknown,
  }
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'verified-student', role: 'authenticated' } },
    error: null,
  })
  const from = vi.fn((table: string) => {
    const query: (typeof queries)[number] = { table }
    queries.push(query)
    const chain = {
      select: vi.fn((projection: string) => {
        query.projection = projection
        return chain
      }),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      insert: vi.fn((value: unknown) => {
        query.inserted = value
        return chain
      }),
      single: vi.fn(async () => saved),
      then: (resolve: (value: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve),
    }
    return chain
  })
  const createClient = vi.fn(() => ({ auth: { getUser }, from }))
  const env = configuration ?? {
    SUPABASE_URL: 'https://fixture.example.test',
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'synthetic-server-key' }),
  }
  let handler: ((request: Request) => Promise<Response>) | undefined
  const log = vi.fn()
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    {
      exports: {},
      require: (specifier: string) => {
        expect(specifier).toBe('npm:@supabase/supabase-js@2.118.0')
        return { createClient }
      },
      Deno: {
        env: { get: (key: string) => env[key] },
        serve: (callback: typeof handler) => {
          handler = callback
        },
      },
      Request,
      Response,
      TextDecoder,
      Uint8Array,
      AbortSignal,
      console: { error: log },
      fetch: () => {
        throw new Error('Tests must never contact a real service')
      },
    },
  )
  if (!handler) throw new Error('Generated function did not register a handler')
  return {
    handler,
    getUser,
    createClient,
    from,
    queries,
    result,
    saved,
    source,
    log,
  }
}

function request(body: unknown = { answers }, authenticated = true) {
  return new Request('https://fixture.example.test/function', {
    method: 'POST',
    headers: {
      ...(authenticated ? { Authorization: 'Bearer synthetic-session' } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe.each<FunctionName>(['assessment-questions', 'submit-assessment'])(
  'standalone Dashboard %s',
  (name) => {
    it('has one explicit npm import and no local dependencies', () => {
      const { source } = boot(name)
      const parsed = ts.createSourceFile(
        'index.ts',
        source,
        ts.ScriptTarget.Latest,
      )
      const imports = parsed.statements.filter(ts.isImportDeclaration)
      expect(imports).toHaveLength(1)
      expect(imports[0].moduleSpecifier.getText(parsed)).toBe(
        "'npm:@supabase/supabase-js@2.118.0'",
      )
    })
    it('answers CORS preflight before constructing a privileged client', async () => {
      const service = boot(name)
      const response = await service.handler(
        new Request('https://fixture.example.test', { method: 'OPTIONS' }),
      )
      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
        'authorization',
      )
      expect(service.createClient).not.toHaveBeenCalled()
    })
    it('rejects missing credentials without any database access', async () => {
      const service = boot(name)
      const response = await service.handler(request({}, false))
      expect(response.status).toBe(401)
      expect(service.createClient).not.toHaveBeenCalled()
    })
    it('verifies tokens with Auth and rejects invalid sessions before querying', async () => {
      const service = boot(name)
      service.getUser.mockResolvedValue({
        data: { user: null },
        error: { status: 401 },
      })
      expect((await service.handler(request())).status).toBe(401)
      expect(service.getUser).toHaveBeenCalledWith('synthetic-session')
      expect(service.from).not.toHaveBeenCalled()
    })
    it('rejects a user without the authenticated role', async () => {
      const service = boot(name)
      service.getUser.mockResolvedValue({
        data: { user: { id: 'other-user', role: 'anon' } },
        error: null,
      })
      expect((await service.handler(request())).status).toBe(401)
      expect(service.from).not.toHaveBeenCalled()
    })
    it('reports missing server configuration safely', async () => {
      const service = boot(name, {})
      expect((await service.handler(request())).status).toBe(503)
      expect(service.createClient).not.toHaveBeenCalled()
    })
    it('supports the existing legacy server-key fallback', async () => {
      const service = boot(name, {
        SUPABASE_URL: 'https://fixture.example.test',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-legacy-key',
      })
      expect((await service.handler(request())).status).toBe(200)
      expect(service.createClient.mock.calls).toHaveLength(1)
    })
    it('sanitizes database failures and includes CORS on errors', async () => {
      const service = boot(name)
      service.result.error = new Error('private database diagnostic')
      const response = await service.handler(request())
      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('private database diagnostic')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
    it('handles Auth network failures without accessing the database', async () => {
      const service = boot(name)
      service.getUser.mockResolvedValue({
        data: { user: null },
        error: { status: 503, message: 'private Auth diagnostic' },
      })
      const response = await service.handler(request())
      expect(response.status).toBe(503)
      expect(await response.text()).not.toContain('private Auth diagnostic')
      expect(service.from).not.toHaveBeenCalled()
    })
  },
)

it('returns only public question fields from the standalone questions endpoint', async () => {
  const service = boot('assessment-questions')
  const response = await service.handler(request({}))
  expect(response.status).toBe(200)
  const { questions } = await response.json()
  expect(questions).toHaveLength(10)
  expect(JSON.stringify(questions)).not.toContain('correct_answer')
  expect(service.queries).toEqual([
    {
      table: 'assessment_questions',
      projection: 'id, topic, question_text, options, difficulty',
    },
  ])
  expect(response.headers.get('Cache-Control')).toBe('no-store')
})

it('scores server-side and saves using only the verified student ID', async () => {
  const service = boot('submit-assessment')
  const response = await service.handler(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    ...expected,
    attempt_id: 'fixture-attempt',
    completed_at: '2026-10-20T12:00:00Z',
  })
  expect(service.queries).toEqual([
    { table: 'assessment_questions', projection: 'id, topic, correct_answer' },
    {
      table: 'assessment_attempts',
      projection: 'id, completed_at',
      inserted: { student_id: 'verified-student', ...expected },
    },
  ])
})

it.each([
  { answers: [...answers.slice(1), answers[1]] },
  { answers: answers.slice(1) },
  { answers, student_id: 'forged-student' },
  { answers, correct_answers: 10 },
  { answers: answers.map((answer) => ({ ...answer, answer: 'E' })) },
  {
    answers: answers.map((answer) => ({
      ...answer,
      question_id: '20000000-0000-4000-8000-000000000001',
    })),
  },
])(
  'rejects invalid or forged submission %# without inserting',
  async (body) => {
    const service = boot('submit-assessment')
    expect((await service.handler(request(body))).status).toBe(400)
    expect(service.queries.some((query) => query.inserted)).toBe(false)
  },
)

it('bounds request bodies even without a Content-Length header', async () => {
  const service = boot('submit-assessment')
  expect(
    (await service.handler(request({ padding: 'x'.repeat(17000) }))).status,
  ).toBe(413)
  expect(service.from).not.toHaveBeenCalled()
})

it('does not report success when the attempt insert fails', async () => {
  const service = boot('submit-assessment')
  service.saved.error = new Error('private insert diagnostic')
  const response = await service.handler(request())
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain('private insert diagnostic')
})

describe('safe questions diagnostics', () => {
  it('preserves successful questions responses and does not log student data', async () => {
    const service = boot('assessment-questions-diagnostic')
    const baseline = boot('assessment-questions')
    const response = await service.handler(request({}))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      await (await baseline.handler(request({}))).json(),
    )
    expect(service.log).not.toHaveBeenCalled()
  })
  it('logs only a fixed stage and an allowlisted database error code', async () => {
    const service = boot('assessment-questions-diagnostic')
    service.result.error = {
      code: '42703',
      message: 'private database diagnostic, key, token and answer',
      details: { student_id: 'private-student' },
    }
    const response = await service.handler(request({}))
    expect(response.status).toBe(500)
    expect(service.log).toHaveBeenCalledExactlyOnceWith(
      '[assessment-diagnostic]',
      { stage: 'read_public_questions', code: '42703' },
    )
    expect(await response.text()).not.toContain('private')
  })
  it('does not log arbitrary error codes or error messages', async () => {
    const service = boot('assessment-questions-diagnostic')
    service.result.error = { code: 'private-secret', message: 'private-token' }
    expect((await service.handler(request({}))).status).toBe(500)
    expect(service.log).toHaveBeenCalledExactlyOnceWith(
      '[assessment-diagnostic]',
      { stage: 'read_public_questions', code: 'UNCLASSIFIED' },
    )
  })
  it('identifies invalid server configuration without logging its contents', async () => {
    const service = boot('assessment-questions-diagnostic', {
      SUPABASE_URL: 'https://fixture.example.test',
      SUPABASE_SECRET_KEYS: 'synthetic-invalid-json',
    })
    expect((await service.handler(request({}))).status).toBe(500)
    expect(service.log).toHaveBeenCalledExactlyOnceWith(
      '[assessment-diagnostic]',
      { stage: 'server_configuration', code: 'UNCLASSIFIED' },
    )
    expect(service.from).not.toHaveBeenCalled()
  })
  it('continues rejecting unauthenticated requests without constructing a client', async () => {
    const service = boot('assessment-questions-diagnostic')
    expect((await service.handler(request({}, false))).status).toBe(401)
    expect(service.createClient).not.toHaveBeenCalled()
    expect(service.log).not.toHaveBeenCalled()
  })
})
