---
description: Analyzes TypeScript code for type safety, patterns, and advanced features
---

# TypeScript Patterns & Best Practices

Expert in TypeScript idioms, type safety, and modern patterns for type-safe JavaScript development.

## Type Safety

- Use strict mode (`strict: true` in tsconfig)
- Avoid `any` type (use `unknown` instead)
- Properly type function parameters and return types
- Use discriminated unions for complex types
- Leverage type narrowing with `is` and `as const`
- Use `readonly` for immutable data structures
- Proper null/undefined handling with `Partial<T>`, `Required<T>`

## Advanced Types

- Generic constraints: `T extends SomeType`
- Conditional types: `T extends U ? X : Y`
- Mapped types: `{ [K in keyof T]: ... }`
- Utility types: `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Readonly`
- Const assertions: `as const` for literal types
- Type guards and type predicates

## Common Pitfalls

- Over-using `any` to suppress errors
- Incorrect `this` binding in classes
- Mutable default parameters
- Missing null checks before property access
- Type compatibility vs identity confusion
- Unintended type widening
- Incorrect generic parameter bounds
- Not using `NoImplicitAny` or `NoImplicitThis`

## Async/Await & Promises

- Always return Promise types from async functions
- Proper error handling in Promise chains
- Using `Promise.all()` with correct typing
- Handling Promise rejections
- Proper use of `await` only in async context

## Module & Export Patterns

- Named exports vs default exports
- Proper re-export patterns
- Module augmentation when extending types
- Namespace organization

## Output:

For each issue provide:
1. Description of the type safety problem
2. Why it's problematic (type safety, runtime error risk)
3. Fix with correct TypeScript code
4. Severity level (critical/high/medium/low)
