import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // Validate command line arguments
  if (!owner || !repo || !prStr) {
    console.error('Usage: npm run dev <owner> <repo> <pr-number>');
    console.error('Example: npm run dev octocat Hello-World 1');
    process.exit(1);
  }

  // Parse and validate PR number
  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    console.error('Error: pr-number must be a positive integer');
    process.exit(1);
  }

  // Validate authentication method
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const hasAwsCredentials =
    !!process.env.AWS_ACCESS_KEY_ID &&
    !!process.env.AWS_SECRET_ACCESS_KEY;

  if (!hasApiKey && !hasAwsCredentials) {
    console.error('Authentication Error: Missing required credentials');
    console.error('Please provide ONE of the following:');
    console.error('  Option 1 (Anthropic API):');
    console.error('    - ANTHROPIC_API_KEY');
    console.error('  Option 2 (AWS Bedrock):');
    console.error('    - AWS_ACCESS_KEY_ID');
    console.error('    - AWS_SECRET_ACCESS_KEY');
    console.error('    - AWS_REGION');
    process.exit(1);
  }

  // Validate model is set
  if (!process.env.ANTHROPIC_MODEL) {
    console.error('Configuration Error: ANTHROPIC_MODEL is required');
    console.error('For Anthropic API: claude-sonnet-4-5-20250929');
    console.error('For AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    process.exit(1);
  }

  // Log authentication method
  if (hasAwsCredentials) {
    if (!process.env.AWS_REGION) {
      console.error('Configuration Error: AWS_REGION is required for AWS Bedrock');
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else {
    console.log('🔐 Using Anthropic API authentication');
  }

  try {
    console.log(`\n🔍 Starting code review for ${owner}/${repo} PR #${prNumber}\n`);

    // Create orchestrator and run review
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    // Create reports directory if it doesn't exist
    const reportsDir = './reports';
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate filename (safe repo name)
    const safeRepoName = `${owner}_${repo}`;
    const fileNameBase = `${safeRepoName}_${prNumber}`;

    // Generate and save all three report formats
    const reportGenerator = new ReportGenerator();

    // JSON Report
    const jsonReport = reportGenerator.generateJSONReport(report);
    const jsonPath = path.join(reportsDir, `${fileNameBase}.json`);
    fs.writeFileSync(jsonPath, jsonReport);
    console.log(`✅ JSON report saved to ${jsonPath}`);

    // Markdown Report
    const mdReport = reportGenerator.generateMarkdownReport(report);
    const mdPath = path.join(reportsDir, `${fileNameBase}.md`);
    fs.writeFileSync(mdPath, mdReport);
    console.log(`✅ Markdown report saved to ${mdPath}`);

    // HTML Report
    const htmlReport = reportGenerator.generateHTMLReport(report);
    const htmlPath = path.join(reportsDir, `${fileNameBase}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    console.log(`✅ HTML report saved to ${htmlPath}`);

    console.log(`\n✨ Code review completed successfully!\n`);
    console.log(`Summary:`);
    console.log(`  Overall Score: ${report.summary.overallScore}/100`);
    console.log(`  Files Reviewed: ${report.summary.totalFiles}`);
    console.log(`  Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`  High Priority Tests: ${report.summary.highPriorityTests}`);
    console.log(`  Refactoring Opportunities: ${report.summary.refactoringOpportunities}`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      logger.error('Detailed error', { stack: error.stack });
    }
    process.exit(1);
  }
}

main();
