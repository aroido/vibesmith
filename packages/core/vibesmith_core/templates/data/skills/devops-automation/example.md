# Skill: docker-deploy-helper

## Description
Docker 기반 애플리케이션 배포를 자동화하는 스킬

## Tools
- read
- write
- shell

## Context
- project_structure
- dependencies

## Instructions

1. **Analyze Infrastructure**
   - Review existing configuration
   - Check dependencies and requirements
   - Identify deployment targets

2. **Generate Automation Scripts**
   - Platform: docker
   - Automation: build, deploy

3. **DevOps Best Practices**
   - Use infrastructure as code
   - Implement CI/CD pipelines
   - Add health checks and monitoring
   - Use environment variables for secrets
   - Document deployment procedures

## Docker Pattern

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///./app.db
```

## Best Practices

- **Security**: Never commit secrets
- **Versioning**: Pin dependency versions
- **Monitoring**: Add health checks
- **Logging**: Centralized logging
- **Rollback**: Have rollback strategy
