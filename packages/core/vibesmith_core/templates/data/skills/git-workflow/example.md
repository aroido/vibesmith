# Skill: git-commit-helper

## Description
Conventional Commits 규격에 따라 Git 커밋 메시지를 자동으로 생성하는 스킬

## Tools
- read
- shell

## Context
- git_history
- project_structure

## Instructions

1. **Analyze Git Context**
   - Review recent commits
   - Check current branch
   - Identify staged changes

2. **Generate Commit-Message**
   - Follow: conventional-commits

3. **Git Workflow Standards**
   - Use imperative mood ("Add feature" not "Added feature")
   - Keep first line under 72 characters
   - Add detailed description in body if needed
   - Reference issue numbers

## Conventional Commits Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Tests
- chore: Maintenance

**Example**:
```
feat(auth): add JWT authentication

Implement JWT-based authentication system with refresh tokens.

Closes #123
```

## Best Practices

- Clear and concise messages
- Reference related issues
- Explain "why" not just "what"
- Follow team conventions
