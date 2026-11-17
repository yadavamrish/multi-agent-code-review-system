import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Code Quality Analyzer Subagent
 *
 * Analyzes code files for quality issues including security, performance,
 * maintainability, style, bug risks, and best practices.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description: 'Analyzes code for quality issues including security, performance, maintainability, and best practices',
  model: 'inherit',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  tools: [
    'Read',      // Read code files
    'Grep',      // Search for patterns
    'Glob',      // Find files
    'Skill'      // Invoke analysis skills
  ]
};
