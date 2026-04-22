# Skill: security-scanner

## Description
OWASP Top 10 기준으로 보안 취약점을 자동으로 검사하는 스킬

## Tools
- read
- search

## Context
- project_structure
- dependencies
- git_history

## Instructions

1. **Security Analysis**
   - Scan for common vulnerabilities
   - Check authentication and authorization
   - Review sensitive data handling

2. **Audit Scope**
   - SQL INJECTION
   - XSS
   - AUTH

3. **Severity Threshold**
   - Report: high and above

## Security Checklist

**SQL Injection:**
- Check for string concatenation in queries
- Verify parameterized queries usage
- Review ORM usage patterns

**Cross-Site Scripting (XSS):**
- Check for unescaped user input
- Review HTML/JavaScript generation
- Verify Content-Security-Policy headers

**Authentication & Authorization:**
- Review password storage (hashing)
- Check for weak authentication
- Verify access control logic
- Review session management

## Report Format

```markdown
## Security Audit Report

### Summary
- Total Issues: X
- Critical: X
- High: X
- Medium: X
- Low: X

### Critical Issues

#### Issue 1: SQL Injection in User Login
**Severity**: Critical  
**Location**: `app/auth.py:45`  
**Description**: User input directly concatenated into SQL query

**Vulnerable Code**:
```python
query = f"SELECT * FROM users WHERE email = '{email}'"
```

**Fix**:
```python
query = "SELECT * FROM users WHERE email = ?"
cursor.execute(query, (email,))
```
```

## Best Practices

- Regular security audits
- Keep dependencies updated
- Follow OWASP Top 10
- Use security linters (bandit, eslint-plugin-security)
- Implement defense in depth
