import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

const NATIVE_MODULE = 'ExpoStoreReview';

type StoreReviewApi = {
  isAvailableAsync: () => Promise<boolean>;
  requestReview: () => Promise<void>;
};

function loadStoreReview(): StoreReviewApi | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (!requireOptionalNativeModule(NATIVE_MODULE)) return null;
  return require('expo-store-review') as StoreReviewApi;
}

export async function isStoreReviewAvailable(): Promise<boolean> {
  const storeReview = loadStoreReview();
  return storeReview ? storeReview.isAvailableAsync() : false;
}

export async function showStoreReview(): Promise<void> {
  await loadStoreReview()?.requestReview();
}
