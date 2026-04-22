/**
 * VisuallyHidden Component
 * WCAG 2.1 AA - 스크린 리더용으로만 표시되는 컨텐츠
 */

import * as React from 'react';

interface VisuallyHiddenProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  VisuallyHiddenProps
>(({ children, asChild = false, ...props }, ref) => {
  if (asChild) {
    return <>{children}</>;
  }

  return (
    <span
      ref={ref}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
      {...props}
    >
      {children}
    </span>
  );
});

VisuallyHidden.displayName = 'VisuallyHidden';
