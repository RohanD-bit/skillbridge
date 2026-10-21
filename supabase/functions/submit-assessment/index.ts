import { createSubmissionHandler } from '../_shared/handlers.ts'
import { createDependencies } from '../_shared/supabase.ts'
import { edgeRuntime } from '../_shared/runtime.ts'

edgeRuntime.serve(createSubmissionHandler(createDependencies))
