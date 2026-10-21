import {
  parseSubmission,
  publicQuestions,
  RequestFailure,
  scoreSubmission,
} from './assessment.ts'
import type { Score } from './assessment.ts'

export interface AssessmentDependencies {
  authenticate: (token: string) => Promise<string | null>
  getPublicQuestions: () => Promise<unknown>
  getScoringQuestions: () => Promise<unknown>
  saveAttempt: (
    studentId: string,
    score: Score,
  ) => Promise<{ id: string; completed_at: string }>
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function handler(
  kind: 'questions' | 'submit',
  dependencies: () => AssessmentDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST')
      return json(
        { code: 'method_not_allowed', message: 'Use POST for this endpoint.' },
        405,
      )
    try {
      const authorization = request.headers.get('Authorization') ?? ''
      const match = /^Bearer\s+(\S+)$/i.exec(authorization)
      if (!match || match[1].length > 8192)
        throw new RequestFailure(
          401,
          'unauthorized',
          'Please log in again to use the assessment.',
        )
      const repository = dependencies()
      const studentId = await repository.authenticate(match[1])
      if (!studentId)
        throw new RequestFailure(
          401,
          'unauthorized',
          'Please log in again to use the assessment.',
        )
      if (kind === 'questions')
        return json({
          questions: publicQuestions(await repository.getPublicQuestions()),
        })
      if (
        !request.headers
          .get('Content-Type')
          ?.toLowerCase()
          .startsWith('application/json')
      )
        throw new RequestFailure(
          415,
          'invalid_submission',
          'Send the assessment answers as JSON.',
        )
      if (Number(request.headers.get('Content-Length') ?? 0) > 16384)
        throw new RequestFailure(
          413,
          'invalid_submission',
          'The submission is too large.',
        )
      // Bound reads even when Content-Length is missing or untrusted.
      const reader = request.body?.getReader()
      if (!reader)
        throw new RequestFailure(
          400,
          'invalid_submission',
          'Submit all 10 answers.',
        )
      const chunks: Uint8Array[] = []
      let length = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > 16384) {
          await reader.cancel()
          throw new RequestFailure(
            413,
            'invalid_submission',
            'The submission is too large.',
          )
        }
        chunks.push(value)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      let body: unknown
      try {
        body = JSON.parse(new TextDecoder().decode(bytes))
      } catch {
        throw new RequestFailure(
          400,
          'invalid_submission',
          'Submit valid JSON with all 10 answers.',
        )
      }
      const answers = parseSubmission(body)
      const score = scoreSubmission(
        await repository.getScoringQuestions(),
        answers,
      )
      const saved = await repository.saveAttempt(studentId, score)
      if (!saved?.id || !saved.completed_at)
        throw new Error('Attempt was not confirmed')
      return json({
        attempt_id: saved.id,
        completed_at: saved.completed_at,
        ...score,
      })
    } catch (error) {
      if (error instanceof RequestFailure)
        return json({ code: error.code, message: error.message }, error.status)
      // Never serialize database errors, credentials, tokens, or question keys.
      return json(
        {
          code: 'request_failed',
          message:
            'The assessment request could not be completed. Please try again.',
        },
        500,
      )
    }
  }
}
export const createQuestionsHandler = (
  dependencies: () => AssessmentDependencies,
) => handler('questions', dependencies)
export const createSubmissionHandler = (
  dependencies: () => AssessmentDependencies,
) => handler('submit', dependencies)
