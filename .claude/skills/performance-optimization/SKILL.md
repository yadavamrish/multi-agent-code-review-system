---
description: Identifies performance bottlenecks and optimization opportunities
---

# Performance Optimization

Expert in identifying performance bottlenecks, analyzing time complexity, and recommending optimizations.

## Algorithm & Data Structure Efficiency

- **Time Complexity**: Identify O(n²), O(n³) loops that should be O(n log n) or O(n)
- **Space Complexity**: Unnecessary memory allocation, large intermediate arrays
- **Algorithm Selection**: Use appropriate algorithms (binary search, hashing, etc.)
- **Data Structures**: Choose optimal structures (Set vs Array for lookups, Map for key-value)
- **Caching/Memoization**: Cache expensive computations, avoid recalculation

## JavaScript/TypeScript Performance

- **Unnecessary Loops**: Loops iterating multiple times over same data
- **DOM Manipulation**: Batch DOM updates instead of one-by-one
- **String Concatenation**: Use template literals or arrays.join() instead of repeated concat
- **Regex Compilation**: Compile once, reuse instead of creating in loop
- **Function Calls**: Excessive function call overhead
- **Garbage Collection**: Create many temporary objects forcing GC pauses
- **Bundle Size**: Unused dependencies or large libraries

## Async Performance

- **Parallel Operations**: Use `Promise.all()` instead of sequential awaits
- **Lazy Loading**: Load resources on-demand, not upfront
- **Stream Processing**: For large data, use streams not arrays
- **Rate Limiting**: Throttle expensive operations

## Network Performance

- **API Calls**: Batch requests, use caching
- **Polling vs Webhooks**: Webhooks are more efficient than polling
- **Request Deduplication**: Cache in-flight requests

## Common Patterns

- **Debounce**: For high-frequency events (resize, input, scroll)
- **Throttle**: Rate-limit function execution
- **Pagination**: Load data in chunks
- **Virtual Scrolling**: Render visible items only

## Measurement

- Identify hot paths with profiling
- Use actual metrics (not guesses)
- Measure before and after optimization
- Monitor in production

## Common Mistakes

- Premature optimization
- Over-optimizing non-critical paths
- Trading readability for small performance gains
- Not measuring impact of changes
- Using synchronous operations where async is better
- Ignoring blocking operations

## Output:

For each performance issue provide:
1. Description of the bottleneck
2. Impact severity (critical/high/medium/low)
3. Current complexity (time/space)
4. Suggested optimization
5. Estimated improvement
6. Code example of the fix
