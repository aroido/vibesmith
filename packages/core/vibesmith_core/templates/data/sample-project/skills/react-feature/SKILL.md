# React Feature Implementation

Guide for implementing React features following modern best practices.

## Key Principles

1. **Component Structure**
   - Functional components with hooks
   - Clear prop types with TypeScript
   - Proper error boundaries

2. **State Management**
   - Use React Query for server state
   - Context for global UI state
   - Local state with useState/useReducer

3. **Performance**
   - Memoization when needed
   - Code splitting
   - Lazy loading

## Example Component

```tsx
interface UserProfileProps {
  userId: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const { data, isLoading } = useUser(userId);
  
  if (isLoading) return <Skeleton />;
  
  return (
    <Box>
      <Avatar src={data.avatar} />
      <Text>{data.name}</Text>
    </Box>
  );
};
```
