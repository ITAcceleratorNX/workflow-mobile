import { Stack } from 'expo-router';

export default function ClientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: 'card' }}>
      <Stack.Screen name="smart-home" />
      <Stack.Screen name="health-screen" />
      <Stack.Screen name="todo-list" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="news" />
      <Stack.Screen name="tasks/task-editor" options={{ presentation: 'card' }} />
      <Stack.Screen name="tasks/details" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
