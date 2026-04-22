# Skill: chakra-form-builder

## Description
Chakra UI를 사용하여 폼 컴포넌트를 생성하고 유효성 검증을 추가하는 스킬

## Tools
- read
- write

## Context
- project_structure
- dependencies

## Instructions

1. **Analyze Requirements**
   - Understand the component purpose and props
   - Check existing component patterns in the project
   - Review the project's UI library setup

2. **Generate React Component**
   - Component Type: functional
   - UI Library: chakra-ui
   - Features: typescript, hooks, props-validation

3. **Follow Best Practices**
   - Use TypeScript for type safety
   - Define proper interfaces for props
   - Use React Hooks (useState, useEffect, etc.)
   - Create custom hooks when needed
   - Add prop types or TypeScript interfaces
   - Keep components small and focused
   - Extract reusable logic into custom hooks
   - Add proper accessibility attributes

## Component Structure

```tsx
import React, { useState, useEffect } from 'react';
import { Box, Button, Text } from '@chakra-ui/react';

interface ChakraFormBuilderProps {
  // Define your props here
  title?: string;
  onAction?: () => void;
}

export const ChakraFormBuilder: React.FC<ChakraFormBuilderProps> = ({
  title = 'Default Title',
  onAction,
}) => {
  const [state, setState] = useState<string>('');

  useEffect(() => {
    // Side effects here
  }, []);

  return (
    <Box>
      <Text>{title}</Text>
      <Button onClick={onAction}>Click Me</Button>
    </Box>
  );
};
```

## Best Practices

- **TypeScript**: Use strict type checking
- **Interfaces**: Define clear prop interfaces
- **Generic Types**: Use generics for reusable components

- **Hooks Rules**: Follow React Hooks rules
- **Custom Hooks**: Extract complex logic into custom hooks
- **Dependencies**: Always specify hook dependencies correctly

- **Composition**: Prefer composition over inheritance
- **Props**: Keep props interface simple and focused
- **Accessibility**: Add ARIA labels and proper semantic HTML
- **Error Handling**: Handle edge cases gracefully

## Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraFormBuilder } from './ChakraFormBuilder';

describe('ChakraFormBuilder', () => {
  it('renders with default props', () => {
    render(<ChakraFormBuilder />);
    expect(screen.getByText('Default Title')).toBeInTheDocument();
  });

  it('calls onAction when button is clicked', () => {
    const mockAction = jest.fn();
    render(<ChakraFormBuilder onAction={mockAction} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
});
```
