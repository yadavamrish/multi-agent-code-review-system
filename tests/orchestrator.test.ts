import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReviewReportSchema } from '../src/types/report-types.js';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from '../src/utils/error-handler.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';

// ==============================================================================
// ReviewReportSchema Validation Tests
// ==============================================================================

describe('ReviewReportSchema', () => {
  describe('safeParse()', () => {
    it('should validate a valid complete ReviewReport object', () => {
      const validReport = {
        pullRequest: {
          owner: 'octocat',
          repo: 'Hello-World',
          number: 1
        },
        fileReviews: [
          {
            file: 'README.md',
            codeQuality: {
              file: 'README.md',
              issues: [],
              overallScore: 95,
              summary: 'Good code quality'
            },
            testCoverage: {
              file: 'README.md',
              hasTests: false,
              testFiles: [],
              untestedPaths: [],
              coverageEstimate: 0,
              summary: 'Documentation file, no tests needed'
            },
            refactorings: {
              file: 'README.md',
              suggestions: [],
              summary: 'No refactoring needed'
            }
          }
        ],
        summary: {
          totalFiles: 1,
          overallScore: 95,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [
          {
            priority: 'low',
            category: 'documentation',
            description: 'Add more examples',
            files: ['README.md']
          }
        ],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 5000,
          agentVersions: { 'code-quality': '1.0.0' }
        }
      };

      const result = ReviewReportSchema.safeParse(validReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pullRequest.owner).toBe('octocat');
        expect(result.data.summary.overallScore).toBe(95);
      }
    });

    it('should reject an invalid report object with out-of-range score', () => {
      const invalidReport = {
        pullRequest: {
          owner: 'octocat',
          repo: 'Hello-World',
          number: 1
        },
        fileReviews: [
          {
            file: 'test.ts',
            codeQuality: {
              file: 'test.ts',
              issues: [],
              overallScore: 150, // Invalid: out of range (should be 0-100)
              summary: 'Code quality analysis'
            },
            testCoverage: {
              file: 'test.ts',
              hasTests: true,
              testFiles: ['test.test.ts'],
              untestedPaths: [],
              coverageEstimate: 85,
              summary: 'Good test coverage'
            },
            refactorings: {
              file: 'test.ts',
              suggestions: [],
              summary: 'No refactoring needed'
            }
          }
        ],
        summary: {
          totalFiles: 1,
          overallScore: 150, // Invalid: out of range
          criticalIssues: 0,
          highPriorityTests: 1,
          refactoringOpportunities: 0
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 1000,
          agentVersions: {}
        }
      };

      const result = ReviewReportSchema.safeParse(invalidReport);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject a report with missing required fields', () => {
      const incompletReport = {
        pullRequest: {
          owner: 'octocat',
          repo: 'Hello-World'
          // Missing 'number' field
        },
        fileReviews: [],
        summary: {
          totalFiles: 0,
          overallScore: 0,
          criticalIssues: 0
          // Missing other required fields
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 0
          // Missing 'agentVersions'
        }
      };

      const result = ReviewReportSchema.safeParse(incompletReport);
      expect(result.success).toBe(false);
    });
  });
});

// ==============================================================================
// withRetry Utility Tests
// ==============================================================================

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt if function resolves', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, 3, 100);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry transient failures and succeed on subsequent attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Transient failure'))
      .mockRejectedValueOnce(new Error('Still failing'))
      .mockResolvedValueOnce('success on third attempt');

    const promise = withRetry(fn, 3, 100);

    // Run all timers to allow retries to complete
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('success on third attempt');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw ReviewError with RETRY_EXHAUSTED when all retries fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

    const promise = withRetry(fn, 3, 100);

    // Catch any rejection to prevent unhandled rejection warning
    promise.catch(() => {
      // Intentionally catch to suppress warning
    });

    // Run all timers to allow retries to complete
    await vi.runAllTimersAsync();

    try {
      await promise;
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewError);
      if (error instanceof ReviewError) {
        expect(error.code).toBe(ErrorCodes.RETRY_EXHAUSTED);
        expect(error.message).toContain('after 3 retries');
      }
    }

    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ==============================================================================
// withTimeout Utility Tests
// ==============================================================================

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result if function completes before timeout', async () => {
    const fn = vi.fn().mockResolvedValue('completed');

    const promise = withTimeout(fn, 5000);

    // Function resolves immediately
    vi.advanceTimersByTime(100);

    const result = await promise;
    expect(result).toBe('completed');
  });

  it('should reject with AGENT_TIMEOUT when promise exceeds timeout duration', async () => {
    const fn = vi.fn(
      () =>
        new Promise(() => {
          // Never resolves
        })
    );

    const promise = withTimeout(fn, 2000, 'Review timed out');

    // Advance past the timeout
    vi.advanceTimersByTime(2100);

    try {
      await promise;
      expect.fail('Should have timed out');
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewError);
      if (error instanceof ReviewError) {
        expect(error.code).toBe(ErrorCodes.AGENT_TIMEOUT);
        expect(error.message).toBe('Review timed out');
      }
    }
  });

  it('should reject immediately if timeout is 0', async () => {
    // Create a function that never resolves
    const fn = vi.fn(
      () => new Promise(() => {
        // Never resolves or rejects
      })
    );

    const promise = withTimeout(fn, 0);

    // Catch any rejection to prevent unhandled rejection warning
    promise.catch(() => {
      // Intentionally catch to suppress warning
    });

    // Advance timers to let the 0ms timeout trigger
    await vi.runAllTimersAsync();

    try {
      await promise;
      expect.fail('Should have timed out immediately');
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewError);
      if (error instanceof ReviewError) {
        expect(error.code).toBe(ErrorCodes.AGENT_TIMEOUT);
      }
    }
  });
});

// ==============================================================================
// RateLimiter Tests
// ==============================================================================

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests up to the configured limit', () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 3, maxConcurrent: 2 });

    // First request should proceed
    expect(limiter.canProceed(100)).toBe(true);

    // Add first request to history
    limiter.recordRequest(100);
    expect(limiter.canProceed(100)).toBe(true);

    // Add second request
    limiter.recordRequest(100);
    expect(limiter.canProceed(100)).toBe(true);

    // Add third request (at limit)
    limiter.recordRequest(100);
    expect(limiter.canProceed(100)).toBe(false);
  });

  it('should return false once the limit is reached', () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 2, maxConcurrent: 5 });

    limiter.recordRequest(500);
    limiter.recordRequest(500);

    // At limit, should not allow more requests
    expect(limiter.canProceed(500)).toBe(false);
  });

  it('should reset after the time window advances', () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 2, maxConcurrent: 5 });

    // Record two requests at time 0
    limiter.recordRequest(500);
    limiter.recordRequest(500);

    // At limit
    expect(limiter.canProceed(500)).toBe(false);

    // Advance time beyond the 60-second window
    vi.advanceTimersByTime(61000);

    // Window should have reset, allowing new requests
    expect(limiter.canProceed(500)).toBe(true);
  });

  it('should track token limits correctly', () => {
    const limiter = new RateLimiter({ maxTokensPerMinute: 2000 });

    // Record a request with 1000 tokens
    limiter.recordRequest(1000);
    expect(limiter.canProceed(500)).toBe(true); // 1000 + 500 <= 2000

    // Record another with 500 tokens
    limiter.recordRequest(500);
    expect(limiter.canProceed(600)).toBe(false); // 1500 + 600 > 2000
  });

  it('should respect concurrent request limits', () => {
    const limiter = new RateLimiter({ maxConcurrent: 2 });

    // No active requests, should allow
    expect(limiter.canProceed(100)).toBe(true);

    // Simulate two concurrent requests by incrementing activeRequests directly
    (limiter as any).activeRequests = 2;

    // At concurrent limit, should not allow more
    expect(limiter.canProceed(100)).toBe(false);

    // After releasing one, should allow again
    (limiter as any).activeRequests = 1;
    expect(limiter.canProceed(100)).toBe(true);
  });
});

// Add helper method to RateLimiter for testing (this will be called in tests)
declare module '../src/utils/rate-limiter.js' {
  interface RateLimiter {
    recordRequest(tokens: number): void;
  }
}

// Add recordRequest method to RateLimiter prototype for testing
(RateLimiter.prototype as any).recordRequest = function (tokens: number): void {
  this.requestHistory.push({
    timestamp: Date.now(),
    tokens
  });
};

// ==============================================================================
// CodeReviewOrchestrator Tests
// ==============================================================================

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default options', () => {
    const orchestrator = new CodeReviewOrchestrator();
    expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
  });

  it('should accept custom rate limit configuration', () => {
    const customRateLimiter = new RateLimiter({
      maxRequestsPerMinute: 10,
      maxConcurrent: 3
    });

    const orchestrator = new CodeReviewOrchestrator({
      rateLimiter: customRateLimiter,
      maxTurns: 20,
      timeoutMs: 60000
    });

    expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
  });
});

// ==============================================================================
// Integration Tests (Skipped - for manual testing with real API)
// ==============================================================================

describe('Integration', () => {
  it.skip('should review a real small PR (octocat/Hello-World PR #1)', async () => {
    // NOTE: This test is skipped because it requires:
    // 1. Valid ANTHROPIC_API_KEY in .env
    // 2. Valid GITHUB_TOKEN in .env
    // 3. Network access to Claude API and GitHub API
    // 4. Time to complete the full review (can take 30+ seconds)
    //
    // To run this test manually:
    // 1. Set ANTHROPIC_API_KEY=sk-ant-...
    // 2. Set GITHUB_TOKEN=gh_...
    // 3. Run: npm test -- --run --reporter=verbose
    //
    // Expected behavior:
    // - Should fetch PR #1 from https://github.com/octocat/Hello-World
    // - Should analyze the files in the PR
    // - Should return a valid ReviewReport matching the schema
    // - Should complete within 300 seconds

    // const orchestrator = new CodeReviewOrchestrator({
    //   maxTurns: 30,
    //   timeoutMs: 300000 // 5 minutes
    // });
    //
    // const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
    // expect(report).toBeDefined();
    // expect(ReviewReportSchema.safeParse(report).success).toBe(true);
  });
});
