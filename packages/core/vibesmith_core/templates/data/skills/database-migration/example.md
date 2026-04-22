# Skill: db-migration-helper

## Description
SQLite 데이터베이스 스키마 변경을 위한 마이그레이션 스크립트를 생성하는 스킬

## Tools
- read
- write
- shell

## Context
- project_structure
- dependencies

## Instructions

1. **Analyze Database Schema**
   - Review current database structure
   - Identify tables, columns, indexes, and constraints
   - Check for existing migrations

2. **Generate Migration**
   - Database: sqlite
   - Tool: raw-sql

3. **Migration Best Practices**
   - Always test migrations on staging first
   - Create reversible migrations (up/down)
   - Back up database before applying
   - Use transactions for atomic operations
   - Add descriptive comments

## SQL Migration Pattern

```sql
-- Migration: Add user authentication
-- Date: 2026-02-18
-- Author: Auto-generated

-- Up Migration
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Down Migration (Rollback)
-- DROP TABLE users;
```

## Best Practices

- **Atomic Operations**: Use transactions
- **Reversibility**: Always provide down migration
- **Testing**: Test on dev/staging before production
- **Backup**: Always backup before migration
- **Documentation**: Add clear comments
