import { Stack } from 'expo-router';

export default function ClientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="smart-home" />
      <Stack.Screen name="health-screen" />
      <Stack.Screen name="todo-list" />
    </Stack>
  );
}
