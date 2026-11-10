# Command: perplex

Analyze a complex or ambiguous problem by breaking it into sub-questions, retrieving relevant context for each, and synthesizing an answer.

Usage: `/perplex <problem> [depth]`

Behavior:
- Decomposes `<problem>` into constituent questions.
- Runs recall searches for each sub-question.
- Aggregates and synthesizes a coherent response.
- `[depth]` controls recursion/sub-question count (default: 2).

Arguments:
- `<problem>` — the complex problem to analyze (required)
- `[depth]` — analysis depth (default: 2)

Example:
```
/perplex "Why did the macOS automation fail on the second run?" 3
```
