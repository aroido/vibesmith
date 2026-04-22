# Skill: security-code-reviewer

## Description
보안 취약점을 중심으로 코드를 리뷰하고 개선사항을 제안하는 스킬

## Tools
- read
- search

## Context
- project_structure
- git_history
- dependencies

## Instructions

1. **Code Analysis**
   - Review code structure and patterns
   - Check for common anti-patterns
   - Analyze complexity and maintainability

2. **Review Focus Areas**
   - Security
   - Code-Quality

3. **Severity Level**
   - Report issues at: all level and above

4. **Review Checklist**

**Security:**
- Check for SQL injection vulnerabilities
- Verify input validation and sanitization
- Check for XSS vulnerabilities
- Review authentication and authorization
- Check for sensitive data exposure

**Code Quality:**
- Check code readability and maintainability
- Review function/class size and complexity
- Check for code duplication (DRY principle)
- Review naming conventions
- Check for proper error handling

## Review Format

For each issue found, provide:
1. **Location**: File path and line number
2. **Severity**: Critical/High/Medium/Low
3. **Category**: Security/Performance/Quality/etc
4. **Description**: Clear explanation of the issue
5. **Recommendation**: How to fix it
6. **Example**: Code snippet showing the fix

## Example Output

```markdown
### Issue 1: SQL Injection Vulnerability

**Location**: `app/db.py:45`  
**Severity**: Critical  
**Category**: Security

**Description**: User input is directly interpolated into SQL query without sanitization.

**Current Code**:
```python
query = f"SELECT * FROM users WHERE email = '{email}'"
```

**Recommendation**: Use parameterized queries.

**Fixed Code**:
```python
query = "SELECT * FROM users WHERE email = ?"
cursor.execute(query, (email,))
```
```
