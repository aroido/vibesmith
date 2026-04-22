# Code Review Command

Automated code review focusing on best practices, potential bugs, and improvements.

## Usage

```bash
/code-review [file-or-directory]
```

## Review Criteria

### 1. Code Quality
- [ ] Clear variable and function names
- [ ] Proper error handling
- [ ] No duplicate code
- [ ] Follows project conventions

### 2. Performance
- [ ] No unnecessary re-renders
- [ ] Efficient data structures
- [ ] Proper memoization

### 3. Security
- [ ] Input validation
- [ ] No XSS vulnerabilities
- [ ] Secure API calls
- [ ] Environment variables for secrets

### 4. Testing
- [ ] Tests exist and pass
- [ ] Edge cases covered
- [ ] Mock data appropriately

### 5. Accessibility
- [ ] Semantic HTML
- [ ] ARIA labels
- [ ] Keyboard navigation

## Output Format

```
[PASS] Passed: 12 checks
[WARN] Warnings: 3 issues
[FAIL] Failed: 1 critical issue

Issues:
1. [CRITICAL] Missing error boundary in UserProfile.tsx
2. [WARNING] Consider memoizing expensive calculation in useFilter hook
3. [WARNING] Add loading state for async operation
```

## Integration

Works with Git hooks to run automatically on pre-commit.
