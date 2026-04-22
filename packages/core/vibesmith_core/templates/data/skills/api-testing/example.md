# Skill: api-test-generator

## Description
FastAPI 엔드포인트에 대한 pytest 테스트를 자동으로 생성하는 스킬

## Tools
- read
- write
- shell

## Context
- project_structure
- dependencies

## Instructions

1. **Analyze API Endpoints**
   - Review API routes and endpoints
   - Understand request/response schemas
   - Identify authentication requirements

2. **Generate Test Cases**
   - Framework: pytest
   - API Framework: fastapi
   - Test Types: unit, integration

3. **Test Coverage**
   - Happy path scenarios
   - Error handling and edge cases
   - Input validation
   - Authentication and authorization
   - Performance testing (if needed)

## Test Patterns

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_items_success():
    """Test GET /items returns 200 and valid data."""
    response = client.get("/api/items")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)

def test_create_item_success():
    """Test POST /items creates item successfully."""
    payload = {"name": "Test Item", "description": "Test"}
    response = client.post("/api/items", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Item"

def test_create_item_validation_error():
    """Test POST /items with invalid data returns 422."""
    payload = {"name": ""}  # Empty name
    response = client.post("/api/items", json=payload)
    assert response.status_code == 422

@pytest.mark.parametrize("item_id,expected_status", [
    ("valid-uuid", 200),
    ("invalid-uuid", 404),
])
def test_get_item_by_id(item_id, expected_status):
    """Test GET /items/{id} with various inputs."""
    response = client.get(f"/api/items/{item_id}")
    assert response.status_code == expected_status
```

## Best Practices

- **Isolation**: Each test should be independent
- **Fixtures**: Use fixtures or setup/teardown for test data
- **Mocking**: Mock external dependencies
- **Assertions**: Use specific, meaningful assertions
- **Coverage**: Aim for 80%+ code coverage
- **Performance**: Keep tests fast (<5s per test suite)
