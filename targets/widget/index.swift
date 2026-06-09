// Verse-of-the-Day iOS widget (GH-265).
//
// Authored without a local Apple toolchain — NOT compiled/run/device-tested.
// Verify with `expo prebuild -p ios` + Xcode before release.
//
// Behavior:
//  - Reads the user's preferred Bible version from the shared App Group
//    (written by the JS app via react-native-shared-group-preferences).
//  - Fetches GET /bible/verse-of-the-day in that version.
//  - Renders verse + reference, adapting across widget families.
//  - Tapping deep-links to the Universal Link form with the verse range so
//    the app scrolls to the verse and emits WIDGET_TAPPED.
//  - On error, shows the last cached entry (App Group) or a branded fallback.

import WidgetKit
import SwiftUI

private let appGroup = "group.org.versemate.app"
private let versionKeyDefaultsKey = "preferred_bible_version"
private let cacheKey = "votd_last_response"
private let apiBaseURL = "https://api.versemate.org"
// KNOWN PROD-ONLY CONSTANT (GH-265 / L-003): the iOS widget extension is a
// separate process and cannot read the JS `EXPO_PUBLIC_WEB_URL` at runtime, so
// this host is hardcoded to production. It MUST match the deployed web host that
// the JS deep-link parser (parseChapterShareUrl) validates against — on the JS
// side that value comes from EXPO_PUBLIC_WEB_URL. On a non-prod build whose web
// host differs, an iOS widget tap would deep-link to a host the parser rejects
// (falling back to Genesis 1). If non-prod iOS widget taps ever need to work,
// inject the host at build time (e.g. an Info.plist value derived from the same
// env, read here via Bundle.main.object(forInfoDictionaryKey:)).
private let webBaseURL = "https://app.versemate.org"
private let defaultVersion = "NASB1995"

// MARK: - Model

struct VerseOfTheDay: Codable {
  let empty: Bool
  let referenceText: String?
  let verses: [Verse]?
  let date: String?
  let reference: Reference?
  let fallbackMessage: String?

  struct Verse: Codable {
    let verseNumber: Int
    let text: String
  }
  struct Reference: Codable {
    let bookId: Int
    let chapterNumber: Int
    let verseStart: Int
    let verseEnd: Int?
  }
}

// MARK: - Shared helpers

private func sharedDefaults() -> UserDefaults? {
  UserDefaults(suiteName: appGroup)
}

private func preferredVersion() -> String {
  sharedDefaults()?.string(forKey: versionKeyDefaultsKey) ?? defaultVersion
}

private func localDateString() -> String {
  let f = DateFormatter()
  f.dateFormat = "yyyy-MM-dd"
  f.calendar = Calendar.current
  f.timeZone = TimeZone.current
  return f.string(from: Date())
}

private func cacheResponse(_ data: Data) {
  sharedDefaults()?.set(data, forKey: cacheKey)
}

private func cachedResponse() -> VerseOfTheDay? {
  guard let data = sharedDefaults()?.data(forKey: cacheKey) else { return nil }
  return try? JSONDecoder().decode(VerseOfTheDay.self, from: data)
}

private func fetchVerseOfTheDay(completion: @escaping (VerseOfTheDay?) -> Void) {
  let version = preferredVersion()
  let date = localDateString()
  guard
    var components = URLComponents(string: "\(apiBaseURL)/bible/verse-of-the-day")
  else { completion(cachedResponse()); return }
  components.queryItems = [
    URLQueryItem(name: "date", value: date),
    URLQueryItem(name: "bible_version", value: version),
  ]
  guard let url = components.url else { completion(cachedResponse()); return }

  let task = URLSession.shared.dataTask(with: url) { data, _, _ in
    guard let data = data,
      let decoded = try? JSONDecoder().decode(VerseOfTheDay.self, from: data)
    else {
      completion(cachedResponse())  // stale-cache fallback
      return
    }
    if !decoded.empty { cacheResponse(data) }
    completion(decoded)
  }
  task.resume()
}

private func deepLinkURL(_ ref: VerseOfTheDay.Reference) -> URL? {
  var s = "\(webBaseURL)/bible/\(ref.bookId)/\(ref.chapterNumber)?verseStart=\(ref.verseStart)"
  if let end = ref.verseEnd { s += "&verseEnd=\(end)" }
  s += "&src=widget"
  return URL(string: s)
}

// MARK: - Timeline

struct VerseEntry: TimelineEntry {
  let date: Date
  let verse: VerseOfTheDay?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> VerseEntry {
    VerseEntry(date: Date(), verse: cachedResponse())
  }

  func getSnapshot(in context: Context, completion: @escaping (VerseEntry) -> Void) {
    completion(VerseEntry(date: Date(), verse: cachedResponse()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<VerseEntry>) -> Void) {
    fetchVerseOfTheDay { verse in
      let entry = VerseEntry(date: Date(), verse: verse)
      // Refresh at the next local midnight.
      let nextMidnight =
        Calendar.current.nextDate(
          after: Date(),
          matching: DateComponents(hour: 0, minute: 1),
          matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(3600)
      completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }
  }
}

// MARK: - View

struct VerseOfTheDayWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: VerseEntry

  private var verseText: String {
    guard let v = entry.verse, v.empty == false, let verses = v.verses else {
      return entry.verse?.fallbackMessage ?? "Open VerseMate to see today's verse"
    }
    return verses.map { $0.text }.joined(separator: " ")
  }

  private var reference: String {
    entry.verse?.referenceText ?? "VerseMate"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(verseText)
        .font(family == .systemSmall ? .caption : .body)
        .lineLimit(family == .systemSmall ? 4 : 6)
        .minimumScaleFactor(0.8)
      Spacer(minLength: 2)
      HStack {
        Text(reference)
          .font(.caption2.weight(.semibold))
          .foregroundColor(.secondary)
        Spacer()
        Text("VerseMate")
          .font(.caption2)
          .foregroundColor(.secondary.opacity(0.7))
      }
    }
    .padding(12)
    .widgetURL(entry.verse?.reference.flatMap(deepLinkURL))
  }
}

// MARK: - Widget

@main
struct VerseOfTheDayWidget: Widget {
  let kind = "VerseOfTheDayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      VerseOfTheDayWidgetView(entry: entry)
    }
    .configurationDisplayName("Verse of the Day")
    .description("Today's Bible verse from VerseMate.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
