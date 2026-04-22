# Skill: api-doc-generator

## Description
API 엔드포인트에 대한 OpenAPI/마크다운 문서를 자동으로 생성하는 스킬

## Tools
- read
- write

## Context
- project_structure
- git_history

## Instructions

1. **Analyze Code**
   - Review function/class definitions
   - Understand parameters and return values
   - Check for existing documentation

2. **Generate Documentation**
   - Format: markdown
   - Include code examples
   - Add clear descriptions
   - Document edge cases and errors

3. **Documentation Standards**
   - Be concise but complete
   - Use consistent terminology
   - Include type information
   - Add usage examples
   - Document exceptions/errors

## Markdown Documentation Pattern

```markdown
# Function Name

## Description
Clear, concise description of what this function does.

## Parameters
- `param1` (type): Description
- `param2` (type, optional): Description

## Returns
- `type`: Description of return value

## Examples
```python
result = function_name(param1, param2)
```

## Errors
- `ValueError`: When input is invalid
```
