---
name: react-patterns
description: Use when discussing React component design, hooks, state management, or rendering patterns. Covers hooks patterns, component composition, performance optimization (useMemo/useCallback), Context vs Redux vs Zustand, custom hooks, render props, compound components, and error boundaries.
---
## Git Delegation Rule

**HARD RULE**: NEVER run git commands. Delegate ALL git operations to `commit-crafter` or `git-wrangler`.



# React Patterns

## Component Composition

### Compound Components
```tsx
// Parent manages shared state implicitly via React.Children
<Select>
  <Select.Option value="a">Option A</Select.Option>
  <Select.Option value="b">Option B</Select.Option>
</Select>
```
Use `React.Children.map` + `cloneElement` or Context to pass shared state.

### Render Props
```tsx
<MouseTracker render={(pos) => <Dot x={pos.x} y={pos.y} />} />
```

### Controlled vs Uncontrolled
- **Uncontrolled**: DOM manages its own state, use `ref` to read values.
- **Controlled**: React state is the single source of truth. Prefer this for form validation or conditional UI.
- **Mixed**: Pass `value` + `onChange` but allow internal default state — use `useControlledState` pattern.

## Hooks Patterns

### Custom Hook Naming
- `use` prefix, PascalCase after (e.g., `useLocalStorage`, `useDebounce`).
- Return a tuple for 2 values (`[value, setter]`), an object for 3+.

### Custom Hook Structure
```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
```

### Effect Cleanup
Every `useEffect` that subscribes, polls, or sets intervals **must** return a cleanup function. Missing cleanup is the #1 React memory leak.

## State Management Decision Tree

```
Simple useState → enough for 90% of cases
Prop drilling pain → lift state or compose children
Sibling/remote shared state → Context (for low-frequency updates)
Frequent updates (auth, theme) → Context is fine
Complex global state → Zustand or Jotai (NOT Redux by default)
Heavy server state → TanStack Query (React Query)
Form state → React Hook Form or Formik
```

### Avoid Over-Engineering
❌ Don't add Redux for a boolean toggle.
❌ Don't wrap every value in Context — it causes unnecessary re-renders.
✅ Default to `useState`. Extract to `useReducer` when state logic is complex (3+ related values with interdependent updates).

## Performance

### Memoization — Only When Needed
```tsx
// Profile first. Then memoize.
const sorted = useMemo(() => expensiveSort(items), [items]);
const handleClick = useCallback(() => doThing(id), [id]);
```

Rules:
- `useMemo` for **computed values** from arrays/objects that trigger downstream effects.
- `useCallback` when passing callbacks to memoized children.
- `React.memo` on components that re-render with the same props frequently.
- **Don't** wrap everything — the overhead of comparison can exceed the render cost.

### List Rendering
```tsx
// Always use a stable, unique key
{items.map((item) => <ListItem key={item.id} item={item} />)}

// For static lists, key=index is acceptable. For dynamic lists, never.
// Extract list item into a memoized component if re-renders are expensive.
```

## Error Boundaries
Class component only (React <19). Catch render-phase errors. Cannot catch:
- Event handlers (use try/catch)
- Async code (use try/catch)
- SSR errors
- Errors in the boundary itself

```tsx
class ErrorBoundary extends React.Component<{ fallback: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
```

React 19 introduces `useError` hook as an alternative.

## Directory Structure Convention

```
components/        → shared/reusable UI
  ui/              → primitive atoms (Button, Input, Modal)
  layout/          → Shell, Sidebar, Header
features/          → domain-specific modules (auth/, dashboard/)
  auth/
    components/    → feature-scoped components
    hooks/         → feature-scoped hooks
    api/           → API calls for this feature
lib/               → pure utilities, no React
hooks/             → truly global hooks (useMediaQuery)
pages/ or app/     → routing layer (Next.js / React Router entries)
types/             → global TypeScript types
```

## Accessibility (A11y)
- All interactive elements need `role` and `aria-label` or visible text.
- Use `button` not `div onClick` unless `role="button" tabIndex={0} onKeyDown`.
- Form inputs always have `<label htmlFor="id">` or `aria-label`.
- Images need `alt` text (empty `alt=""` is OK for decorative).
- Test with keyboard navigation before writing any logic.
