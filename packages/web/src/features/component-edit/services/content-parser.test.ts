/**
 * Content parser unit tests
 * Spec Appendix B - extractBody, assembleContent
 */

import { describe, it, expect } from 'vitest';
import {
  extractBody,
  parseFrontmatter,
  assembleContent,
} from './content-parser';

describe('extractBody', () => {
  it('should extract body after frontmatter', () => {
    const content = `---
name: fastapi-route
description: FastAPI 스캐폴딩
---
# FastAPI Route

본문 내용입니다.`;
    expect(extractBody(content)).toBe('# FastAPI Route\n\n본문 내용입니다.');
  });

  it('should return full content when no frontmatter', () => {
    const content = '# Plain content\n\nNo frontmatter.';
    expect(extractBody(content)).toBe(content);
  });

  it('should handle empty body', () => {
    const content = `---
name: test
---
`;
    expect(extractBody(content)).toBe('');
  });

  it('should handle CRLF line endings', () => {
    const content = '---\r\nname: test\r\n---\r\nbody';
    expect(extractBody(content)).toBe('body');
  });
});

describe('parseFrontmatter', () => {
  it('should parse frontmatter key-value pairs', () => {
    const content = `---
name: fastapi-route
description: "FastAPI 라우트"
---
body`;
    expect(parseFrontmatter(content)).toEqual({
      name: 'fastapi-route',
      description: 'FastAPI 라우트',
    });
  });

  it('should return empty object when no frontmatter', () => {
    expect(parseFrontmatter('plain content')).toEqual({});
  });
});

describe('assembleContent', () => {
  it('should assemble frontmatter and body', () => {
    const result = assembleContent(
      { 'allowed-tools': ['Read', 'Write'] },
      'fastapi-route',
      'FastAPI 라우트 스캐폴딩',
      '# Usage\n\n본문'
    );
    expect(result).toContain('name: "fastapi-route"');
    expect(result).toContain('description: "FastAPI 라우트 스캐폴딩"');
    expect(result).toContain('allowed-tools: ["Read","Write"]');
    expect(result).toMatch(/# Usage\n\n본문$/);
  });

  it('should work with null existing frontmatter', () => {
    const result = assembleContent(null, 'new-skill', 'Desc', 'body');
    expect(result).toBe('---\nname: "new-skill"\ndescription: "Desc"\n---\nbody');
  });
});
