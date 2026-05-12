import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Required for full-screen React Native Web layouts. Without this,
          html/body/#root collapse to height 0 and `flex: 1` containers
          (onboarding pager, chapter reader, etc.) render blank in the
          static web export served at mobile.versemate.org.
        */}
        <ScrollViewStyleReset />

        {/* Primary Meta */}
        <meta
          name="description"
          content="Read the Bible with AI-powered explanations, commentary, and study tools. Available on web, iOS, and Android."
        />
        <meta name="theme-color" content="#000000" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="VerseMate" />
        <meta property="og:title" content="VerseMate — AI-Powered Bible Reading" />
        <meta
          property="og:description"
          content="Read the Bible with AI-powered explanations, commentary, and study tools."
        />
        <meta property="og:url" content="https://app.versemate.org" />
        <meta property="og:image" content="https://app.versemate.org/assets/images/icon.png" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="VerseMate — AI-Powered Bible Reading" />
        <meta
          name="twitter:description"
          content="Read the Bible with AI-powered explanations, commentary, and study tools."
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
