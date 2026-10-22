import type { LearningResource } from './catalog'

// Synthetic educational content only; no production resource or student data.
export const resourceFixtures: LearningResource[] = [
  [
    'Budgeting basics',
    'Make a spending plan.',
    'budgeting',
    'beginner',
    'lesson',
  ],
  [
    'Build a buffer',
    'Learn about emergency savings.',
    'saving',
    'beginner',
    'article',
  ],
  [
    'Credit scores',
    'Understand a credit report.',
    'credit',
    'intermediate',
    'video',
  ],
  [
    'Investing foundations',
    'Explore stocks and funds.',
    'investing',
    'beginner',
    'lesson',
  ],
  [
    'A spending plan',
    'Practice managing expenses.',
    'budgeting',
    'intermediate',
    'workshop',
  ],
  ['Saving for a goal', 'Set a savings target.', 'saving', 'beginner', 'video'],
  [
    'Borrowing wisely',
    'Understand interest charges.',
    'credit',
    'beginner',
    'article',
  ],
  [
    'Investing risk',
    'Compare investment risks.',
    'investing',
    'advanced',
    'article',
  ],
  [
    'Budget challenges',
    'Try a complex budget.',
    'budgeting',
    'advanced',
    'video',
  ],
  [
    'Compound growth',
    'Explore compound savings.',
    'saving',
    'intermediate',
    'lesson',
  ],
].map(([title, description, topic, difficulty, resource_type], index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  title,
  description,
  topic: topic as LearningResource['topic'],
  difficulty: difficulty as LearningResource['difficulty'],
  resource_type: resource_type as LearningResource['resource_type'],
  provider: 'Example Learning',
  url: `https://learning.example.test/resources/${index + 1}`,
}))
