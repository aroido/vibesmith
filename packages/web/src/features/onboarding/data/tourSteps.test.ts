import { describe, expect, it } from 'vitest';
import { getTourSteps } from './tourSteps';

describe('getTourSteps', () => {
  it('uses only valid selectors for current IA', () => {
    const steps = getTourSteps();
    const selectors = steps
      .map((step) => step.element)
      .filter((element): element is string => typeof element === 'string');

    expect(selectors).toContain('[data-tour="settings-button"]');
    expect(selectors).toContain('[data-tour="components-menu"]');
    expect(selectors).toContain('[data-tour="projects-menu"]');
    expect(selectors).not.toContain('[data-tour="graph-menu"]');
  });
});
