import { Redirect } from 'expo-router';

export default function Index() {
  // In a real app, we would check if the user is authenticated here
  // For now, we redirect to login as the starting point
  return <Redirect href="/login" />;
}
