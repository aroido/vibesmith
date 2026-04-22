import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_MASK_TEXT_CLASS,
  ANALYTICS_NO_CAPTURE_CLASS,
} from './privacy';
import { MarkdownRenderer } from '@/features/document-viewer';
import { ComponentDetailMetadata } from '@/features/component-detail/components/ComponentDetailMetadata';

describe('analytics privacy surfaces', () => {
  it('marks markdown rendering as non-capturable replay content', () => {
    const { container } = render(
      <MarkdownRenderer content={'```ts\nconst token = "secret"\n```'} />
    );

    expect(container.firstElementChild).toHaveClass(ANALYTICS_NO_CAPTURE_CLASS);
  });

  it('marks component paths as masked text', () => {
    const { container } = render(
      <MemoryRouter>
        <ComponentDetailMetadata
          component={{
            id: 'comp_1',
            type: 'skill',
            name: 'Skill One',
            description: 'desc',
            enabled: true,
            tags: [],
            project_id: 'proj_1',
            project_name: 'Project One',
            path: '/Users/demo/.claude/skills/one.md',
            content: 'content',
            frontmatter: { owner: 'demo' },
            dependencies: { depends_on: [], depended_by: [] },
            created_at: '2026-03-20T00:00:00.000Z',
            updated_at: '2026-03-20T00:00:00.000Z',
          }}
        />
      </MemoryRouter>
    );

    const maskedPath = container.querySelector(`.${ANALYTICS_MASK_TEXT_CLASS}`);
    const blockedFrontmatter = container.querySelector(`.${ANALYTICS_NO_CAPTURE_CLASS}`);

    expect(maskedPath).toHaveTextContent('/Users/demo/.claude/skills/one.md');
    expect(blockedFrontmatter).not.toBeNull();
  });
});
