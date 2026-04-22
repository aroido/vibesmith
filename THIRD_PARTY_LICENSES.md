# Third-Party Licenses

VibeSmith uses the following open-source libraries and frameworks. We are grateful to their authors and contributors.

## Summary

### Frontend (JavaScript/TypeScript)
- **MIT License**: 294 packages
- **ISC License**: 14 packages
- **Apache-2.0 License**: 3 packages
- **BSD-2-Clause License**: 3 packages
- **BSD-3-Clause License**: 2 packages
- **0BSD License**: 1 package
- **MIT OR CC0-1.0**: 1 package

### Backend (Python)
- **Apache Software License**: 39 packages
- **BSD-3-Clause License**: 1 package (Anaconda)

All listed dependencies use licenses that are compatible with VibeSmith's MIT distribution model.

---

## License Compatibility

VibeSmith is distributed under the **MIT License**. All third-party dependencies use permissive open-source licenses that allow:

- ✅ Commercial use
- ✅ Distribution
- ✅ Modification
- ✅ Private use

### Compatible Licenses
- **MIT License**: Most permissive, allows commercial use
- **Apache License 2.0**: Patent grant, allows commercial use
- **BSD-2-Clause & BSD-3-Clause**: Permissive, allows commercial use
- **ISC License**: Functionally equivalent to MIT
- **0BSD License**: Public domain equivalent
- **CC0-1.0**: Public domain dedication

---

## Major Dependencies

### Frontend

#### UI Framework & Core
- **React** (MIT) - UI library
- **Vite** (MIT) - Build tool & dev server
- **TypeScript** (Apache-2.0) - Type system
- **Chakra UI** (MIT) - Component library
- **Radix UI** (MIT) - Headless UI primitives

#### Data & State Management
- **TanStack Query** (MIT) - Server state management
- **React Hook Form** (MIT) - Form management
- **Zod** (MIT) - Schema validation
- **Immer** (MIT) - Immutable state

#### Visualization & UI
- **D3** (ISC) - Data visualization
- **React Flow** (MIT) - Node-based UI
- **React Joyride** (MIT) - User onboarding
- **Framer Motion** (MIT) - Animation library

#### Testing & Development
- **Vitest** (MIT) - Unit testing
- **Playwright** (Apache-2.0) - E2E testing
- **ESLint** (MIT) - Linting
- **Prettier** (MIT) - Code formatting

### Backend

#### Web Framework & Core
- **FastAPI** (MIT) - Web framework
- **Uvicorn** (BSD-3-Clause) - ASGI server
- **Pydantic** (MIT) - Data validation
- **Starlette** (BSD-3-Clause) - ASGI toolkit

#### Utilities
- **Jinja2** (BSD-3-Clause) - Template engine
- **PyYAML** (MIT) - YAML parser
- **structlog** (MIT/Apache-2.0) - Structured logging
- **watchdog** (Apache-2.0) - File system monitoring
- **slowapi** (MIT) - Rate limiting

#### Testing & Development
- **pytest** (MIT) - Testing framework
- **pytest-cov** (MIT) - Coverage reporting
- **ruff** (MIT) - Linting & formatting

---

## Full License Texts

Full license texts for all dependencies can be found in:

### Frontend
- `packages/web/node_modules/{package}/LICENSE`
- Generate full list: `cd packages/web && npx license-checker --production`

### Backend
- Python packages typically install licenses in site-packages
- Generate full list: `cd packages/api && pip-licenses --format=markdown`

---

## Generating Updated Lists

To regenerate third-party license information:

### Frontend
```bash
cd packages/web

# Summary
npx license-checker --summary --production

# Detailed list (Markdown)
npx license-checker --markdown --production > licenses-frontend.md

# Check for incompatible licenses
npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;CC0-1.0' --summary
```

### Backend
```bash
cd packages/api

# Summary
pip-licenses --summary

# Detailed list (Markdown)
pip-licenses --format=markdown --order=license > licenses-backend.md
```

---

## License Compliance

VibeSmith complies with all third-party license requirements:

1. **Attribution**: All third-party licenses are acknowledged in this document
2. **Copyright Notices**: Preserved in node_modules and site-packages
3. **License Texts**: Available in dependency directories
4. **No Modifications**: Dependencies used as-is, not modified
5. **Distribution**: Binary distribution only (no source redistribution of dependencies)

---

## Questions or Concerns

If you have questions about third-party licenses or believe there is a compliance issue,
open a GitHub issue with the `legal` label.

---

**Last Updated**: February 18, 2026  
**Generated For**: VibeSmith v0.1.0
