import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Refactoring Suggester Subagent
 *
 * Identifies opportunities to improve code structure, readability, and
 * maintainability through refactoring suggestions.
 */
export const refactoringSuggester: AgentDefinition = {
  description: 'Identifies refactoring opportunities to improve code structure and maintainability',
  model: 'inherit',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  tools: [
    'Read',      // Read code files
    'Grep',      // Search for patterns
    'Glob',      // Find related files
    'Skill'      // Invoke analysis skills
  ]
};
