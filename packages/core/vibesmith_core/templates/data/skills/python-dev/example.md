# Skill: pytest-helper

## Description
pytest 테스트 코드를 자동으로 생성하는 스킬입니다. 함수나 클래스를 분석하여 적절한 테스트 케이스를 작성합니다.

## Tools
- read
- write

## Context
- project_structure
- test_files

## Instructions

1. **Analyze Python Code Structure**
   - Understand the project architecture
   - Identify key modules and functions
   - Check for existing tests

2. **Generate High-Quality Code**
   - Follow PEP 8 style guide
   - Use type hints for better code clarity
   - Write comprehensive docstrings

3. **Apply Best Practices**
   - Write testable code
   - Handle errors gracefully
   - Keep functions small and focused

## Custom Instructions

Focus on edge cases and error handling in tests. Always include positive and negative test cases.

## Examples

```python
# Example: pytest test generation
def test_calculate_total_success():
    """Test calculate_total with valid input."""
    items = [10, 20, 30]
    result = calculate_total(items)
    assert result == 60
    assert isinstance(result, int)

def test_calculate_total_empty_list():
    """Test calculate_total with empty list."""
    result = calculate_total([])
    assert result == 0

def test_calculate_total_invalid_input():
    """Test calculate_total with invalid input."""
    with pytest.raises(TypeError):
        calculate_total("invalid")
```

## Best Practices

- **Type Hints**: Always use type hints for function parameters and return values
- **Docstrings**: Write clear, concise docstrings following Google or NumPy style
- **Testing**: Aim for high test coverage (>80%)
- **Error Handling**: Use specific exception types and provide helpful error messages
- **Code Organization**: Keep related functionality together in modules

## Common Patterns

```python
from typing import Optional, List, Dict

def process_data(
    input_data: List[str],
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Process input data and return results.
    
    Args:
        input_data: List of strings to process
        options: Optional configuration dictionary
        
    Returns:
        Dictionary containing processed results
        
    Raises:
        ValueError: If input_data is empty
    """
    if not input_data:
        raise ValueError("input_data cannot be empty")
    
    # Processing logic here
    results = {}
    
    return results
```
