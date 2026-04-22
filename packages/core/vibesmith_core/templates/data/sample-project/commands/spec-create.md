# Spec Create Command

Generate feature specification documents following the project template.

## Usage

```bash
/spec-create [feature-name]
```

## Generated Spec Includes

1. **Feature Overview**
   - Purpose and goals
   - User stories
   - Acceptance criteria

2. **Technical Design**
   - Component structure
   - API requirements
   - State management

3. **Implementation Plan**
   - Tasks breakdown
   - Dependencies
   - Timeline estimate

4. **Test Strategy**
   - Unit tests
   - Integration tests
   - E2E scenarios

## Example Output

```markdown
# Feature: User Dashboard

## Overview
Display personalized dashboard for logged-in users.

## User Stories
- As a user, I want to see my recent projects
- As a user, I want quick access to common actions

## Components
- DashboardPage
- ProjectList
- QuickActions

## API Endpoints
- GET /api/dashboard/summary
- GET /api/projects?user_id={id}

## Test Coverage
- Dashboard renders with mock data
- Projects load and display
- Quick actions trigger correct events
```
