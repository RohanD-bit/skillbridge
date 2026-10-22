import type { SupabaseClient } from '@supabase/supabase-js'

export const resourceTopics = {
  budgeting: 'Budgeting',
  saving: 'Saving',
  credit: 'Credit',
  investing: 'Investing',
} as const
export const resourceDifficulties = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const
export const resourceTypes = {
  lesson: 'Lesson',
  workshop: 'Workshop',
  video: 'Video',
  article: 'Article',
} as const

export interface LearningResource {
  id: string
  title: string
  description: string
  provider: string
  topic: keyof typeof resourceTopics
  difficulty: keyof typeof resourceDifficulties
  resource_type: keyof typeof resourceTypes
  url: string
}
export interface ResourceFilters {
  keyword: string
  topic: string
  difficulty: string
  resourceType: string
}
export const emptyFilters: ResourceFilters = {
  keyword: '',
  topic: '',
  difficulty: '',
  resourceType: '',
}
export class ResourceCatalogError extends Error {}

// Keep malformed, insecure, and credentialed URLs out of href attributes.
export function safeResourceUrl(value: string): string | null {
  try {
    if (!/^https:\/\//i.test(value.trim())) return null
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function parseResources(value: unknown): LearningResource[] {
  const invalid = () =>
    new ResourceCatalogError(
      'The resource library returned unexpected data. Please retry or contact the project administrator.',
    )
  if (!Array.isArray(value)) throw invalid()
  const ids = new Set<string>()
  const resources: LearningResource[] = []
  for (const row of value) {
    if (!isObject(row)) throw invalid()
    if (row.is_active === false) continue
    if (
      row.is_active !== true ||
      typeof row.id !== 'string' ||
      !row.id ||
      ids.has(row.id) ||
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      (row.description !== null && typeof row.description !== 'string') ||
      (row.provider !== null && typeof row.provider !== 'string') ||
      typeof row.topic !== 'string' ||
      !Object.hasOwn(resourceTopics, row.topic) ||
      typeof row.difficulty !== 'string' ||
      !Object.hasOwn(resourceDifficulties, row.difficulty) ||
      typeof row.resource_type !== 'string' ||
      !Object.hasOwn(resourceTypes, row.resource_type) ||
      (row.url !== null && typeof row.url !== 'string')
    )
      throw invalid()
    ids.add(row.id)
    resources.push({
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      provider: row.provider ?? '',
      topic: row.topic as LearningResource['topic'],
      difficulty: row.difficulty as LearningResource['difficulty'],
      resource_type: row.resource_type as LearningResource['resource_type'],
      url: row.url ?? '',
    })
  }
  return resources
}
export async function loadResources(
  client: SupabaseClient,
  signal: AbortSignal,
): Promise<LearningResource[]> {
  try {
    const { data, error } = await client
      .from('learning_resources')
      .select(
        'id, title, description, provider, topic, difficulty, resource_type, url, is_active',
      )
      .eq('is_active', true)
      .order('title')
      .order('id')
      .abortSignal(signal)
    if (error) throw error
    return parseResources(data)
  } catch (error) {
    if (error instanceof ResourceCatalogError) throw error
    throw new ResourceCatalogError(
      'The resource library could not be loaded. Check your connection and try again. If your session expired, sign in again.',
    )
  }
}
export function filterResources(
  resources: LearningResource[],
  filters: ResourceFilters,
): LearningResource[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return resources.filter(
    (resource) =>
      (!keyword ||
        resource.title.toLowerCase().includes(keyword) ||
        resource.description.toLowerCase().includes(keyword)) &&
      (!filters.topic || resource.topic === filters.topic) &&
      (!filters.difficulty || resource.difficulty === filters.difficulty) &&
      (!filters.resourceType ||
        resource.resource_type === filters.resourceType),
  )
}
