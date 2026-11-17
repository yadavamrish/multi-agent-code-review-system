import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Test Coverage Analyzer Subagent
 *
 * Analyzes code for test coverage gaps and identifies areas where tests
 * should be added or improved.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description: 'Analyzes code for test coverage gaps and identifies untested code paths',
  model: 'inherit',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  tools: [
    'Read',      // Read code and test files
    'Grep',      // Search for test patterns
    'Glob',      // Find test files
    'Skill'      // Invoke analysis skills
  ]
};
