#!/usr/bin/env python3
"""CLI tool to validate all templates."""

import sys
from pathlib import Path

# Add parent directory to path to import vibesmith_core
sys.path.insert(0, str(Path(__file__).parent.parent))

from vibesmith_core.templates.validator import TemplateValidator


def main():
    """Validate all templates and print results."""
    print("🔍 Validating all templates...")
    print()

    validator = TemplateValidator()
    result = validator.validate_all_templates()

    if not result["valid"]:
        print("❌ Validation failed!")
        print(f"   Total templates: {result['total_templates']}")
        print(f"   Total errors: {result['total_errors']}")
        print(f"   Total warnings: {result['total_warnings']}")
        print()

        for template_id, template_result in result["results"].items():
            if not template_result["valid"]:
                print(f"❌ {template_id}:")
                for error in template_result["errors"]:
                    print(f"   - {error}")
                if template_result["warnings"]:
                    for warning in template_result["warnings"]:
                        print(f"   ⚠️  {warning}")
                print()

        sys.exit(1)
    else:
        print("✅ All templates validated successfully!")
        print(f"   Total templates: {result['total_templates']}")
        print(f"   Total errors: {result['total_errors']}")
        print(f"   Total warnings: {result['total_warnings']}")
        print()

        # Print warnings if any
        if result["total_warnings"] > 0:
            print("⚠️  Warnings found:")
            for template_id, template_result in result["results"].items():
                if template_result["warnings"]:
                    print(f"   {template_id}:")
                    for warning in template_result["warnings"]:
                        print(f"   - {warning}")
            print()

        sys.exit(0)


if __name__ == "__main__":
    main()
