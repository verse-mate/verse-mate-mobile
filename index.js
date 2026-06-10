// App entry point.
//
// Wraps the standard Expo Router entry to also register the Android
// Verse-of-the-Day widget task handler (GH-265). registerWidgetTaskHandler is
// a no-op outside Android, so this is safe on all platforms.
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widgets/widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
