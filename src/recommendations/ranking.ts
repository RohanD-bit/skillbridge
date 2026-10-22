import {
  resourceDifficulties,
  resourceTopics,
  safeResourceUrl,
} from '../resources/catalog'
import type { LearningResource } from '../resources/catalog'

type Topic = LearningResource['topic']
type Level = LearningResource['difficulty']
export const recommendationWeights = {
  knowledgeGap: 0.45,
  difficulty: 0.35,
  alignment: 0.2,
} as const

// Rows are the student's experience; columns are resource difficulty.
const compatibility: Record<Level, Record<Level, number>> = {
  beginner: { beginner: 1, intermediate: 0.35, advanced: 0 },
  intermediate: { beginner: 0.8, intermediate: 1, advanced: 0.45 },
  advanced: { beginner: 0.5, intermediate: 0.85, advanced: 1 },
}
const levelOrder: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
}
const goalTopicWords: Record<Topic, readonly string[]> = {
  budgeting: [
    'budget',
    'budgeting',
    'spending',
    'expenses',
    'expense',
    'income',
    'paycheck',
  ],
  saving: ['save', 'saving', 'savings', 'emergency'],
  credit: ['credit', 'borrow', 'borrowing', 'loan', 'loans', 'debt'],
  investing: [
    'invest',
    'investing',
    'investment',
    'investments',
    'stock',
    'stocks',
    'retirement',
  ],
}
const stopWords = new Set([
  'the',
  'and',
  'for',
  'with',
  'about',
  'from',
  'that',
  'this',
  'how',
  'want',
  'would',
  'like',
  'learn',
  'learning',
  'understand',
  'improve',
  'money',
  'financial',
  'better',
  'more',
  'can',
  'will',
  'have',
  'make',
  'build',
])
export interface RecommendationComponents {
  knowledgeGapRelevance: number
  difficultyCompatibility: number
  interestGoalAlignment: number
}
export interface Recommendation extends LearningResource {
  score: number
  components: RecommendationComponents
  explanation: string
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function experienceLevel(value: unknown): Level | null {
  return typeof value === 'string' && Object.hasOwn(resourceDifficulties, value)
    ? (value as Level)
    : null
}

// null means unknown, never evidence of poor knowledge. Reject inconsistent
// values instead of clamping them into a fabricated assessment result.
export function knowledgeGap(value: unknown): number | null {
  if (!isRecord(value)) return null
  const { correct, total } = value
  if (
    typeof correct !== 'number' ||
    typeof total !== 'number' ||
    !Number.isSafeInteger(correct) ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    correct < 0 ||
    correct > total
  )
    return null
  return 1 - correct / total
}
export function topicKnowledgeGaps(
  value: unknown,
): Record<Topic, number | null> {
  return Object.fromEntries(
    Object.keys(resourceTopics).map((topic) => [
      topic,
      knowledgeGap(
        isRecord(value) && Object.hasOwn(value, topic) ? value[topic] : null,
      ),
    ]),
  ) as Record<Topic, number | null>
}
export function difficultyCompatibility(
  resourceLevel: Level,
  studentLevel: unknown,
): number {
  return compatibility[experienceLevel(studentLevel) ?? 'beginner'][
    resourceLevel
  ]
}
function words(value: string): string[] {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .match(/[a-z]+/g) ?? []
  )
}
function goalKeywords(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return [...new Set(words(value.slice(0, 300)))].filter(
    (word) => word.length >= 3 && !stopWords.has(word),
  )
}
export function interestGoalAlignment(
  resource: LearningResource,
  profile: unknown,
) {
  const preferences = isRecord(profile) ? profile : {}
  const interestMatch =
    Array.isArray(preferences.interests) &&
    preferences.interests.includes(resource.topic)
  const content = new Set(words(`${resource.title} ${resource.description}`))
  const matchedKeywords = goalKeywords(preferences.learning_goal)
    .filter(
      (word) =>
        goalTopicWords[resource.topic].includes(word) || content.has(word),
    )
    .sort()
  // The alignment weight is split equally: 10 points for an interest match,
  // 10 for at least one whole-word goal match. Repetition cannot boost a score.
  return {
    score: (Number(interestMatch) + Number(matchedKeywords.length > 0)) / 2,
    interestMatch,
    matchedKeywords,
  }
}
function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function rankResources(
  resources: readonly LearningResource[],
  profile: unknown,
  topicScores: unknown,
): Recommendation[] {
  const preferences = isRecord(profile) ? profile : {}
  const level = experienceLevel(preferences.experience_level)
  const gaps = topicKnowledgeGaps(topicScores)
  const ranked: Recommendation[] = []
  for (const resource of resources) {
    const url = safeResourceUrl(resource.url)
    if (!url) continue
    const gap = gaps[resource.topic]
    const alignment = interestGoalAlignment(resource, preferences)
    const components: RecommendationComponents = {
      knowledgeGapRelevance: gap ?? 0.5,
      difficultyCompatibility: difficultyCompatibility(
        resource.difficulty,
        level,
      ),
      interestGoalAlignment: alignment.score,
    }
    const explanation = [
      gap === null
        ? `No usable assessment score for ${resourceTopics[resource.topic]}; no knowledge gap is assumed.`
        : `Your latest assessment score for ${resourceTopics[resource.topic]} was ${Math.round((1 - gap) * 100)}%; this resource covers that topic.`,
      !level
        ? 'Your experience level is not set; beginner compatibility is used as an accessible default.'
        : resource.difficulty === level
          ? `Matches your ${level} experience level.`
          : levelOrder[resource.difficulty] > levelOrder[level]
            ? `Above your ${level} level; this may be a stretch.`
            : `Below your ${level} level, offering a review of the basics.`,
      alignment.interestMatch
        ? `${resourceTopics[resource.topic]} is one of your selected interests.`
        : 'No selected interest matched this topic.',
      alignment.matchedKeywords.length
        ? `Learning-goal keyword match: ${alignment.matchedKeywords.join(', ')}.`
        : 'No learning-goal keywords matched.',
    ].join(' ')
    ranked.push({
      ...resource,
      url,
      components,
      explanation,
      score:
        recommendationWeights.knowledgeGap * components.knowledgeGapRelevance +
        recommendationWeights.difficulty * components.difficultyCompatibility +
        recommendationWeights.alignment * components.interestGoalAlignment,
    })
  }
  // Use ordinal comparisons, not locale-dependent collation or input order.
  return ranked
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareText(left.title.toLowerCase(), right.title.toLowerCase()) ||
        compareText(left.id, right.id),
    )
    .slice(0, 5)
}
