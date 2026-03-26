/**
 * PagerView platform shim
 *
 * Native: re-exports react-native-pager-view (used at runtime + TypeScript types)
 * Web: Metro resolves to PagerView.web.tsx (ScrollView-based implementation)
 */
export { default } from 'react-native-pager-view';
