---
name: design-system-implementation
description: Use when implementing UI components from design token specifications. Covers Tailwind class usage, spacing scale rules, typography matching, animation maps, the 4 states rule, component state management, and minimalist design principles. Use with design tokens, component specs, and Meta-Architect Stage 4 outputs.
---
## Git Delegation Rule

**HARD RULE**: NEVER run git commands. Delegate ALL git operations to `commit-crafter` or `git-wrangler`.



# Design System Implementation

## Colors

Use exact Tailwind classes from the design tokens. Never use arbitrary color values.

```
design_tokens.colors.primary    → bg-blue-600, text-blue-600, border-blue-600
design_tokens.colors.background → bg-gray-50
design_tokens.colors.error      → text-red-500, bg-red-50, border-red-500
```

Rules:
- Use semantic token names, not color names, in your component logic
- Map tokens to Tailwind classes at the token level, not per-component
- Do not invent new color variants — use only what's in the spec

## Spacing

Use the spacing scale from the design tokens. Never use arbitrary pixel values.

```
xs → p-1 (4px)
sm → p-2 (8px)
md → p-4 (16px)
lg → p-6 (24px)
xl → p-8 (32px)
```

- Use gap-{size} for flex/grid gaps
- Use space-y-{size} and space-x-{size} for list spacing
- Never write `p-[13px]`, `m-[7px]`, or any arbitrary value

## Typography

Match the exact typography classes from the design tokens:

```
h1    → text-3xl font-bold
h2    → text-2xl font-semibold
body  → text-base
small → text-sm text-gray-500
mono  → font-mono text-sm
```

- Do not add extra font-weight or size classes beyond what's specified
- Line heights and letter spacing are implicit in Tailwind's type scale

## Animation Map

Copy animation properties exactly from the design_spec.animation_map:

- **Framer Motion**: Use the exact `initial` and `animate` props specified
  ```tsx
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
  ```
- **CSS transitions**: Use the exact classes specified (e.g., `hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200`)
- Do not add custom animation values — use only what's in the map

## The 4 States Rule

Every UI component MUST implement all 4 states:

| State | Visual | Behavior |
|-------|--------|----------|
| **loading** | Skeleton/pulse | Show while data is fetching (no data yet) |
| **empty** | Placeholder text + icon | Show when fetch succeeded but no data exists |
| **error** | Error message + retry | Show when fetch failed; retry re-fetches |
| **success** | Normal rendered content | Show when data is available |

Implementation pattern:
```tsx
function StatCard({ title, value, isLoading, error }) {
  if (isLoading) return <div className="animate-pulse bg-gray-200 rounded-lg p-4" />;
  if (error) return <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded-lg">Error: {error}</div>;
  if (!value) return <div className="bg-white p-4 rounded-lg shadow-md">—</div>;
  return <div className="bg-white p-4 rounded-lg shadow-md">{value}</div>;
}
```

## Minimalist Design Rules

- No decorative elements that don't serve a purpose
- One primary action per view
- Consistent spacing throughout
- No custom CSS when a Tailwind utility class exists
- Prefer simplicity over visual flair
- Every component must be keyboard-accessible
