import { query, type Options, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents/index.js';
import { mcpServersConfig } from './config/mcp.config.js';
import { ORCHESTRATOR_PROMPT } from './prompts/orchestrator.prompt.js';
import { RateLimiter, withRetry, withTimeout } from './utils/index.js';
import { logger } from './utils/logger.js';

export interface OrchestratorOptions {
  rateLimiter?: RateLimiter;
  maxTurns?: number;
  timeoutMs?: number;
}

export class CodeReviewOrchestrator {
  private rateLimiter: RateLimiter;
  private maxTurns: number;
  private timeoutMs: number;

  constructor(options: OrchestratorOptions = {}) {
    this.rateLimiter = options.rateLimiter || new RateLimiter();
    this.maxTurns = options.maxTurns || 30;
    this.timeoutMs = options.timeoutMs || 300000;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();

    try {
      logger.info('Starting PR review', { owner, repo, prNumber });

      const result = await withTimeout(
        () =>
          withRetry(async () => {
            await this.rateLimiter.acquire(2000);
            try {
              return await this.executeReview(owner, repo, prNumber, startTime);
            } finally {
              this.rateLimiter.release();
            }
          }),
        this.timeoutMs,
        `Code review timed out after ${this.timeoutMs}ms`
      );

      const duration = Date.now() - startTime;
      logger.info('PR review completed', { owner, repo, prNumber, duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('PR review failed', {
        owner,
        repo,
        prNumber,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async executeReview(
    owner: string,
    repo: string,
    prNumber: number,
    startTime: number
  ): Promise<ReviewReport> {
    const userMessage = `${ORCHESTRATOR_PROMPT}

Please review pull request #${prNumber} in ${owner}/${repo}.

1. Use GitHub MCP tools (e.g., mcp__github__pull_request_read) to fetch the PR details, diff, and changed files.
2. For the changed files, explicitly invoke all three subagents using the Task tool:
   - Use the code-quality-analyzer agent to analyze code quality, security, and performance
   - Use the test-coverage-analyzer agent to analyze test coverage and missing tests
   - Use the refactoring-suggester agent to suggest refactorings and improvements
3. Aggregate all results into a comprehensive ReviewReport matching the required JSON schema.
4. Set metadata.analyzedAt to "${new Date().toISOString()}" and metadata.duration to ${Date.now() - startTime}.`;

    let reviewReport: ReviewReport | null = null;
    let responseText = '';

    const agents: Record<string, AgentDefinition> = {
      'code-quality-analyzer': codeQualityAnalyzer,
      'test-coverage-analyzer': testCoverageAnalyzer,
      'refactoring-suggester': refactoringSuggester
    };

    const options: Options = {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      maxTurns: this.maxTurns,
      permissionMode: 'bypassPermissions',
      allowedTools: [
        'Task',
        'Skill',
        'Read',
        'Grep',
        'Glob',
        'mcp__github__*',
        'mcp__eslint__*'
      ],
      settingSources: ['project'],
      cwd: process.env.PROJECT_ROOT || process.cwd(),
      mcpServers: mcpServersConfig as Options['mcpServers'],
      agents,
      outputFormat: {
        type: 'json_schema',
        schema: ReviewReportJSONSchema
      }
    };

    const stream = query({
      prompt: userMessage,
      options
    });

    for await (const message of stream) {
      if (message.type === 'result') {
        const resultMsg = message as Record<string, unknown>;
        if (resultMsg.structured_output) {
          const validation = ReviewReportSchema.safeParse(resultMsg.structured_output);
          if (validation.success) {
            reviewReport = validation.data;
          } else {
            logger.warn('structured_output failed Zod validation', {
              errors: validation.error.errors.slice(0, 5)
            });
            responseText = JSON.stringify(resultMsg.structured_output);
          }
        }
        if (typeof resultMsg.result === 'string' && resultMsg.result) {
          responseText = resultMsg.result;
        }
      }
    }

    if (!reviewReport && responseText) {
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validation = ReviewReportSchema.safeParse(parsed);
          if (validation.success) {
            reviewReport = validation.data;
          }
        }
      } catch (e) {
        logger.error('Failed to parse response as JSON', {
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    if (!reviewReport) {
      throw new Error(
        `Failed to parse review report from agent response. Response: ${responseText.substring(0, 500)}`
      );
    }

    return reviewReport;
  }
}
