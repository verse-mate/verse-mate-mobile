/**
 * Index Route
 *
 * Redirects to Genesis 1 on app launch
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/bible/1/1" />;
}
