/**
 * Project Selector Component
 * Dropdown to select current project
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import type { Project } from '../types';

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
}

const DROPDOWN_WIDTH = 256;
const VIEWPORT_PADDING = 12;
const DROPDOWN_GAP = 8;
const MAX_DROPDOWN_HEIGHT = 320;
const MIN_DROPDOWN_HEIGHT = 180;
const PORTAL_Z_INDEX = 2147483000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ProjectSelector({
  projects,
  currentProjectId,
  onProjectChange,
}: ProjectSelectorProps) {
  const { t } = useTranslation('dashboard');
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownTop, setDropdownTop] = useState(0);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(MAX_DROPDOWN_HEIGHT);

  const updateDropdownPosition = () => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();

    const left = clamp(
      rect.right - DROPDOWN_WIDTH,
      VIEWPORT_PADDING,
      window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_PADDING
    );

    const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
    const availableAbove = rect.top - VIEWPORT_PADDING;
    const shouldOpenUpward = availableBelow < MIN_DROPDOWN_HEIGHT && availableAbove > availableBelow;

    if (shouldOpenUpward) {
      const maxHeight = clamp(
        Math.min(MAX_DROPDOWN_HEIGHT, availableAbove - DROPDOWN_GAP),
        MIN_DROPDOWN_HEIGHT,
        MAX_DROPDOWN_HEIGHT
      );
      setDropdownTop(Math.max(VIEWPORT_PADDING, rect.top - DROPDOWN_GAP - maxHeight));
      setDropdownMaxHeight(maxHeight);
    } else {
      const maxHeight = clamp(
        Math.min(MAX_DROPDOWN_HEIGHT, availableBelow - DROPDOWN_GAP),
        MIN_DROPDOWN_HEIGHT,
        MAX_DROPDOWN_HEIGHT
      );
      setDropdownTop(rect.bottom + DROPDOWN_GAP);
      setDropdownMaxHeight(maxHeight);
    }

    setDropdownLeft(left);
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => updateDropdownPosition();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const displayName = currentProject
    ? currentProject.isGlobal
      ? 'Global'
      : currentProject.name
    : t('projectSelector.allProjects');

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex h-10 min-h-[40px] items-center gap-2 rounded-lg border border-theme bg-theme-surface px-4 py-2
          hover:bg-theme-hover
          transition-all
          font-mono text-sm
        "
      >
        <span className="max-w-[14rem] truncate text-theme-primary">{displayName}</span>
        <span className="text-theme-secondary">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 isolate pointer-events-none"
          style={{ zIndex: PORTAL_Z_INDEX }}
        >
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="
              fixed pointer-events-auto
              bg-theme-surface backdrop-blur-md
              border border-theme
              rounded-lg
              shadow-xl shadow-black/50
              overflow-hidden overflow-y-auto overscroll-contain
            "
            style={{
              top: dropdownTop,
              left: dropdownLeft,
              width: DROPDOWN_WIDTH,
              maxHeight: dropdownMaxHeight,
            }}
          >
            <button
              onClick={() => {
                onProjectChange('all');
                setIsOpen(false);
              }}
              className={`
                w-full px-4 py-3 text-left
                hover:bg-theme-hover
                transition-colors
                border-b border-theme
                ${!currentProjectId ? 'badge-theme-info' : 'text-theme-primary'}
              `}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{t('projectSelector.allProjects')}</span>
              </div>
            </button>

            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  onProjectChange(project.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-4 py-3 text-left
                  hover:bg-theme-hover
                  transition-colors
                  border-b border-theme last:border-0
                  ${
                    currentProjectId === project.id
                      ? 'badge-theme-info'
                      : 'text-theme-primary'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{project.name}</span>
                  </div>
                  <span className="text-xs text-theme-tertiary font-mono">
                    [{project.componentCount}]
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      , document.body)}
    </div>
  );
}
