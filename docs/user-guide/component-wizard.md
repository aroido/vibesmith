# Unified Component Creation Wizard User Guide

**Version**: 1.0.0
**Last Updated**: 2026-02-16
**Audience**: VibeSmith users

---

## Table of Contents

1. [Overview](#overview)
2. [5 Component Types](#5-component-types)
3. [Getting Started](#getting-started)
4. [Step-by-Step Usage](#step-by-step-usage)
5. [FAQ](#faq)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### What Is the Unified Component Creation Wizard?

VibeSmith's **Unified Component Creation Wizard** is an interactive tool that makes it easy to create AI agent components (Skills, Agents, Commands, Hooks, Rules).

### Key Features

- **5 types unified**: Create all components from a single wizard
- **Template-based**: Provides verified best-practice templates
- **Step-by-step guide**: Easy creation through a 6-step flow
- **Real-time preview**: Review and edit content before creation
- **Auto-save**: Automatically saved and activated in the project

### When Should I Use It?

- When you want to add a new AI skill
- When you want to create a custom subagent
- When you want to save frequently used commands
- When you want to set up Git hooks
- When you want to define project rules

---

## 5 Component Types

### 1. Skill

**Definition**: A knowledge document that tells the AI agent how to perform specific tasks

**Use Cases**:
- Auto-generate tests with pytest
- Refactor React components
- Auto-generate API documentation
- Code review checklists

**File Format**: `SKILL.md`

**Example Paths**:
```
.cursor/skills/pytest-write/SKILL.md
.cursor/skills/react-refactor/SKILL.md
```

---

### 2. Agent (Subagent)

**Definition**: An independent AI agent that performs a specific role

**Use Cases**:
- Code review specialist agent
- Test writing specialist agent
- Documentation writing specialist agent
- Architecture verification agent

**File Format**: `AGENT.md`

**Example Paths**:
```
.cursor/agents/code-reviewer.md
.cursor/agents/test-writer.md
```

---

### 3. Command

**Definition**: Saves frequently used tasks as commands

**Use Cases**:
- Project initialization (`/init-project`)
- Auto implementation workflow (`/auto-implement`)
- Work session start (`/work-session`)
- Daily report generation (`/daily-report`)

**File Format**: `.md`

**Example Paths**:
```
.cursor/commands/init-project.md
.cursor/commands/auto-implement.md
```

---

### 4. Hook (Event Hook)

**Definition**: Scripts that automatically execute when specific events occur

**Use Cases**:
- pre-commit: Lint check before commit
- post-merge: Install dependencies after merge
- pre-push: Run tests before push
- post-checkout: Configure environment after branch switch

**File Format**: `.md`

**Example Paths**:
```
.cursor/hooks/pre-commit.md
.cursor/hooks/post-merge.md
```

---

### 5. Rule

**Definition**: Coding rules applied to the entire project or specific files

**Use Cases**:
- Coding conventions (naming, formatting)
- Architecture rules (layer separation)
- Security rules (API key prohibition)
- Performance rules (bundle size limits)

**File Format**: `RULE.md`

**Example Paths**:
```
.cursor/rules/CODING_CONVENTION.md
.cursor/rules/packages/web/RULE.md
```

---

## Getting Started

### 1. Start from Dashboard

1. Open the VibeSmith dashboard
2. Click the **"Component Wizard"** button in the **Quick Actions** area

![Component Wizard Button](../assets/wizard-button.png)

### 2. Start with Keyboard Shortcut (Coming Soon)

- **macOS**: `Cmd + Shift + N`
- **Windows/Linux**: `Ctrl + Shift + N`

---

## Step-by-Step Usage

### Step 1: Select Type

**Purpose**: Select the component type to create.

**Screen Layout**:
- 5 type cards (Skill, Agent, Command, Hook, Rule)
- Each card displays icon, name, and description

**How to Use**:
1. Click the desired type card
2. Selected card is highlighted with a blue border
3. Click **"Next"** button

**Tips**:
- If unsure about the differences between types, click the **"View Guide"** link
- If you selected the wrong type, simply click another card

![Type Select Step](../assets/wizard-step1.png)

---

### Step 2: Select Template

**Purpose**: Select a template matching the chosen type.

**Screen Layout**:
- Template card list by type
- Each card includes:
  - Template name
  - Description
  - Difficulty (beginner/intermediate/advanced)
  - Estimated time
  - Tags

**How to Use**:
1. Click a template card to select
2. Click **"Next"** button

**Template Examples**:

#### Skill Templates
- **pytest Auto-Generation**: Test code auto-generation skill
- **React Component Refactoring**: React code improvement skill
- **API Documentation Generation**: OpenAPI documentation auto-generation skill

#### Agent Templates
- **Code Reviewer**: Code quality verification agent
- **Test Writer**: Test code generation agent
- **Documentation Writer**: Technical documentation writing agent

#### Command Templates
- **Project Initialization**: New project setup command
- **Auto Implementation**: Feature auto-implementation workflow
- **Daily Report**: Work log auto-generation

#### Hook Templates
- **pre-commit**: Pre-commit verification hook
- **post-merge**: Post-merge automation hook
- **pre-push**: Pre-push testing hook

#### Rule Templates
- **Coding Conventions**: Naming and formatting rules
- **Architecture Rules**: Layer separation rules
- **Security Rules**: Security checklist

![Template Select Step](../assets/wizard-step2.png)

---

### Step 3: Enter Basic Information

**Purpose**: Enter the basic information needed for the template.

**Screen Layout**:
- Dynamic form (varies by template)
- Required fields marked with red asterisk (*)
- Help text provided

**Common Fields**:
- **Name** (required): Component name
- **Description** (required): Brief description
- **Tags** (optional): Tags for search

**Additional Fields by Template**:

#### pytest Auto-Generation (Skill)
- **Test Framework**: pytest, unittest
- **Coverage Target**: 80%, 90%, 100%
- **Use Fixtures**: Yes/No

#### Code Reviewer (Agent)
- **Review Focus**: Security, performance, readability
- **Severity Level**: Critical, High, Medium, Low
- **Auto Fix**: Yes/No

#### pre-commit (Hook)
- **Run Command**: `npm run lint`, `pytest`
- **On Failure**: Abort, Warn
- **Timeout**: 30s, 60s, 120s

**How to Use**:
1. Fill in all required fields
2. Fill in optional fields as needed
3. Click **"Next"** button

**Validation**:
- Error message displayed when required fields are empty
- Help message shown for format errors

![Basic Info Step](../assets/wizard-step3.png)

---

### Step 4: Preview and Edit

**Purpose**: Review the generated component content and modify if needed.

**Screen Layout**:
- Left: Markdown editor
- Right: Real-time preview
- Top: Filename display

**Features**:
- **Real-time preview**: Input content reflected immediately
- **Markdown support**: Headings, lists, code blocks, etc.
- **Auto-save**: Edit content auto-saved
- **Undo**: Ctrl+Z / Cmd+Z

**How to Use**:
1. Review generated content
2. Edit in the editor if needed
3. Verify results in preview
4. Click **"Next"** button

**Editing Tips**:
- If unfamiliar with Markdown syntax, click the **"Markdown Guide"** link
- Recommended to maintain the template structure
- Do not delete comments (`<!-- -->`)

![Preview Step](../assets/wizard-step4.png)

---

### Step 5: Save and Activate

**Purpose**: Save the component to the project and activate it.

**Screen Layout**:
- Save path display
- Activation options
- Completion message

**Save Options**:
- **Select Project**: Choose which project to save to
- **Auto-activate**: Activate immediately after saving (recommended)
- **Add Tags**: Add tags for search

**How to Use**:
1. Select project
2. Choose activation option (default: activated)
3. Click **"Save"** button
4. Verify completion message

**After Saving**:
- Verify created component on dashboard
- Immediately usable (if activated)
- Manage in Component List

![Save Step](../assets/wizard-step5.png)

---

## FAQ

### Q1. What happens if I close the wizard midway?

**A**: If there's work in progress, a confirmation dialog will appear.

- **"Continue Working"**: Return to the wizard
- **"Close"**: Discard work and exit

### Q2. Can I customize templates?

**A**: Yes, you can freely edit in Step 4 (Preview).

- Edit content in the Markdown editor
- Verify with real-time preview
- Recommended to maintain the template structure

### Q3. How do I edit a created component?

**A**: You can edit it from the Component List.

1. Dashboard → Component List
2. Click the component to edit
3. Click **"Edit"** button
4. Edit content and save

### Q4. Can I create my own templates?

**A**: Currently only provided templates are available. Custom template functionality is planned for Phase 2.

### Q5. Can I save to multiple projects at once?

**A**: Currently only one project at a time. To copy to another project:

1. Select component in Component List
2. Click **"Copy to Project"** button
3. Select target project

### Q6. Can I create components manually without the wizard?

**A**: Yes, you can create files directly.

- Create `SKILL.md` in `.cursor/skills/` directory
- Create `AGENT.md` in `.cursor/agents/` directory
- etc.

However, using the wizard gives you access to verified templates and auto-save functionality.

### Q7. My created component isn't working

**A**: Check the following:

1. **Activation status**: Verify the toggle is on in Component List
2. **Path check**: Verify it was saved in the correct directory
3. **Syntax errors**: Verify Markdown syntax is correct
4. **Rescan**: Settings → Scan → Click "Rescan Now"

### Q8. I don't like the templates

**A**: Please send us feedback!

- GitHub Issues: https://github.com/aroido/vibesmith/issues
- Email: admin@aroido.com

---

## Troubleshooting

### Issue 1: "Cannot load templates" Error

**Cause**: Backend API connection failure

**Solution**:
1. Verify the backend server is running
   ```bash
   cd packages/api
   make dev
   ```
2. Refresh browser (F5)
3. Check logs if problem persists
   ```bash
   tail -f packages/api/logs/app.log
   ```

---

### Issue 2: "Cannot save" Error

**Cause**: Filesystem permissions or path error

**Solution**:
1. Verify project path is correct
   - Settings → Projects → Check path
2. Check filesystem permissions
   ```bash
   ls -la .cursor/
   ```
3. Create directories if they don't exist
   ```bash
   mkdir -p .cursor/skills .cursor/agents .cursor/commands .cursor/hooks .cursor/rules
   ```

---

### Issue 3: Wizard is Slow

**Cause**: Large number of templates or network latency

**Solution**:
1. Clear browser cache
2. Check backend logs (slow queries)
3. Check template count
   ```bash
   curl http://localhost:8000/api/templates | jq 'length'
   ```

---

### Issue 4: Preview is Broken

**Cause**: Markdown syntax error

**Solution**:
1. Check for syntax errors in the editor
2. Escape special characters (`\*`, `\[`, `\]`)
3. Verify code block closings (` ``` `)

---

### Issue 5: Created Component Not Showing in List

**Cause**: Rescan needed

**Solution**:
1. Settings → Scan → Click "Rescan Now"
2. Wait a few seconds then return to dashboard
3. Refresh Component List

---

## Additional Resources

### Documentation
- [Developer Guide](../developer-guide/component-wizard-architecture.md)
- [API Documentation](../api/spec.md)
- [Unified Wizard Proposal](../features/component-wizard-unified-proposal.md)

### Community
- [GitHub Discussions](https://github.com/aroido/vibesmith/discussions)
- [Discord](https://discord.gg/vibesmith)

### Support
- [Submit an Issue](https://github.com/aroido/vibesmith/issues/new)
- Email: admin@aroido.com

---

**Last Updated**: 2026-02-16
**Next Update Planned**: On Phase 2 release (custom template feature)
