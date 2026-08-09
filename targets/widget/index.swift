// Verse-of-the-Day iOS widget (GH-265).
//
// Verified on an iPhone 17 Pro simulator (iOS 26.5): all three families render
// and were checked in light and dark appearance. Type-checks against the iOS
// SDK with `xcrun -sdk iphoneos swiftc -typecheck -parse-as-library -target
// arm64-apple-ios15.1 targets/widget/index.swift`.
//
// NOTE: a clean `expo prebuild -p ios` + simulator build currently fails in the
// PostHog pod (`underlying Objective-C module 'PostHog' not found`, built from
// its .swiftinterface). Pass BUILD_LIBRARY_FOR_DISTRIBUTION=NO to xcodebuild to
// get through it — unrelated to this widget.
//
// Behavior:
//  - Reads the user's preferred Bible version from the shared App Group
//    (written by the JS app via react-native-shared-group-preferences).
//  - Fetches GET /bible/verse-of-the-day in that version.
//  - Renders verse + reference, adapting across widget families.
//  - Tapping deep-links to the Universal Link form with the verse range so
//    the app scrolls to the verse and emits WIDGET_TAPPED.
//  - On error, shows the last cached entry (App Group) or a branded fallback.
//
// Layout follows the "Verse of the Day — home-screen widget" design doc
// (turn 2, panel 2A — iOS): progressive disclosure by size, so each family
// shows only what fits.
//   - systemSmall  (170×170): reference first, verse clamped to 5 lines, no note.
//   - systemMedium (364×170): gold rail, eyebrow + version, verse clamped to 3.
//   - systemLarge  (364×382): verse zone + a "Why it matters" zone, each its own
//     tap target (verse → the chapter, note → the reader's summary tab).
// Type is clamped, never scaled (design rule: "clamp lines, never shrink the
// type"), so every day's verse occupies the same slots.
//
// Two deliberate deviations from the design doc, both noted there as open:
//  - Typeface: the design calls for bundled Literata. Nothing is bundled in this
//    repo, so this uses the system serif (New York) via `design: .serif` — the
//    same reasoning the design applies to Android's `fontFamily="serif"`.
//    Bundling Literata is an asset + Info.plist (UIAppFonts) change.
//  - The note zone needs a short summary the API does not serve yet; when it is
//    absent, systemLarge falls back to a verse-only composition.

import WidgetKit
import SwiftUI

private let appGroup = "group.org.versemate.app"
private let versionKeyDefaultsKey = "preferred_bible_version"
// Personalization id (the logged-in user's own id) mirrored from the app via
// the App Group; sent as `pid` so the widget shows the user's personal verse
// (PD-7). Empty/absent when logged out → the endpoint serves the global verse.
private let userIdDefaultsKey = "widget_user_id"
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
  let versionKey: String?
  /// Short "why it matters" summary for systemLarge (design: ≤220 chars).
  /// NOT served by /bible/verse-of-the-day yet — decoded optionally so the note
  /// zone lights up the day the API starts returning it.
  let explanation: String?

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

private func personalizationId() -> String? {
  let id = sharedDefaults()?.string(forKey: userIdDefaultsKey)
  return (id?.isEmpty == false) ? id : nil
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
  var items = [
    URLQueryItem(name: "date", value: date),
    URLQueryItem(name: "bible_version", value: version),
  ]
  if let pid = personalizationId() {
    items.append(URLQueryItem(name: "pid", value: pid))
  }
  components.queryItems = items
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

/// Insight tab the note zone opens — the reader's short overview, the in-app
/// counterpart of the widget's "Why it matters" panel.
private let noteTab = "summary"

private func deepLinkURL(_ ref: VerseOfTheDay.Reference, tab: String? = nil) -> URL? {
  var s = "\(webBaseURL)/bible/\(ref.bookId)/\(ref.chapterNumber)?verseStart=\(ref.verseStart)"
  if let end = ref.verseEnd { s += "&verseEnd=\(end)" }
  s += "&src=widget"
  if let tab = tab { s += "&tab=\(tab)" }
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

/// Design 2A palette. Dark values are the design's verbatim; light is the same
/// structure resolved against the app's light tokens — gold drops to #b09a6d
/// there, the only gold that clears WCAG AA on white.
private struct Palette {
  let surface: Color
  let verseText: Color
  let gold: Color
  let eyebrow: Color
  let version: Color
  let wordmark: Color
  let explanation: Color
  let hairline: Color
  let footerHairline: Color
  let largeHeaderTop: Color
  let largeHeaderBottom: Color
  let largeEyebrow: Color

  static let dark = Palette(
    surface: Color(hex: 0x16_16_18),
    verseText: Color(hex: 0xF4_F2_EE),
    gold: Color(hex: 0xD8_A8_5F),
    eyebrow: Color(hex: 0x8A_8A_93),
    version: Color(hex: 0x6E_6E_77),
    wordmark: Color(hex: 0x7D_7D_86),
    explanation: Color(hex: 0xC1_BF_B9),
    hairline: Color(hex: 0x26_26_2A),
    footerHairline: Color(hex: 0x21_21_25),
    largeHeaderTop: Color(hex: 0x1D_1C_1A),
    largeHeaderBottom: Color(hex: 0x16_16_18),
    largeEyebrow: Color(hex: 0x9C_7F_4E)
  )

  static let light = Palette(
    surface: Color(hex: 0xFF_FF_FF),
    verseText: Color(hex: 0x1A_1A_1A),
    gold: Color(hex: 0xB0_9A_6D),
    eyebrow: Color(hex: 0x6E_6E_77),
    version: Color(hex: 0x8A_8A_8A),
    wordmark: Color(hex: 0x9B_9B_9B),
    explanation: Color(hex: 0x4A_4A_4A),
    hairline: Color(hex: 0xE8_E4_DC),
    footerHairline: Color(hex: 0xEE_EA_E2),
    largeHeaderTop: Color(hex: 0xFA_F8_F4),
    largeHeaderBottom: Color(hex: 0xFF_FF_FF),
    largeEyebrow: Color(hex: 0x8A_73_45)
  )
}

extension Color {
  /// 0xRRGGBB literal → Color, so the design's hex values stay readable.
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }
}

extension View {
  /// Paint the widget surface. From iOS 17 WidgetKit requires the background to
  /// come from `containerBackground` (it also draws edge-to-edge, which the
  /// design's full-bleed large header needs); earlier versions take a plain
  /// background. @ViewBuilder keeps the two branch types legal.
  @ViewBuilder
  func widgetSurface(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(color, for: .widget)
    } else {
      self.background(color)
    }
  }
}

/// Serif body face — see the header note on Literata.
private func serif(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
  .system(size: size, weight: weight, design: .serif)
}

/// Uppercase eyebrow label ("VERSE OF THE DAY" / "WHY IT MATTERS").
private struct Eyebrow: View {
  let text: String
  let color: Color

  var body: some View {
    Text(text)
      .font(.system(size: 9, weight: .bold))
      .tracking(1.26)  // design: .14em at 9pt
      .foregroundColor(color)
      .lineLimit(1)
  }
}

/// "✦ VerseMate" wordmark.
private struct Wordmark: View {
  let palette: Palette

  var body: some View {
    HStack(spacing: 4) {
      Text("✦").foregroundColor(palette.gold)
      Text("VerseMate").foregroundColor(palette.wordmark)
    }
    .font(.system(size: 10, weight: .medium))
  }
}

struct VerseOfTheDayWidgetView: View {
  @Environment(\.widgetFamily) var family
  @Environment(\.colorScheme) var colorScheme
  let entry: VerseEntry

  private var palette: Palette { colorScheme == .dark ? .dark : .light }

  private var isFallback: Bool {
    guard let v = entry.verse, v.empty == false, let verses = v.verses else { return true }
    return verses.isEmpty
  }

  private var verseText: String {
    guard let v = entry.verse, v.empty == false, let verses = v.verses, !verses.isEmpty else {
      return entry.verse?.fallbackMessage ?? "Open VerseMate to see today's verse"
    }
    return verses.map { $0.text }.joined(separator: " ")
  }

  private var reference: String { entry.verse?.referenceText ?? "" }

  private var versionLabel: String { entry.verse?.versionKey ?? "" }

  /// "Jul 27 · NASB1995" for the large header; version alone if the date is unset.
  private var dateAndVersion: String {
    guard let raw = entry.verse?.date else { return versionLabel }
    let parser = DateFormatter()
    parser.dateFormat = "yyyy-MM-dd"
    guard let parsed = parser.date(from: raw) else { return versionLabel }
    let out = DateFormatter()
    out.dateFormat = "MMM d"
    let day = out.string(from: parsed)
    return versionLabel.isEmpty ? day : "\(day) · \(versionLabel)"
  }

  /// The note zone needs both room and copy; without a summary systemLarge
  /// paints a verse-only composition rather than an empty zone.
  private var explanation: String? {
    guard !isFallback, let text = entry.verse?.explanation, !text.isEmpty else { return nil }
    return text
  }

  private var chapterURL: URL? { entry.verse?.reference.flatMap { deepLinkURL($0) } }
  private var noteURL: URL? { entry.verse?.reference.flatMap { deepLinkURL($0, tab: noteTab) } }

  var body: some View {
    content
      .widgetSurface(palette.surface)
      // Whole-surface tap → the chapter. systemLarge's note zone overrides this
      // for its own region with a Link (design: "Android allows a few regions,
      // iOS uses Link").
      .widgetURL(chapterURL)
  }

  @ViewBuilder
  private var content: some View {
    switch family {
    case .systemSmall: small
    case .systemLarge: large
    default: medium
    }
  }

  // MARK: Small — reference first, verse trimmed to its core clause.

  private var small: some View {
    VStack(alignment: .leading, spacing: 0) {
      if !isFallback {
        Text(reference)
          .font(serif(12, .semibold))
          .tracking(0.24)
          .foregroundColor(palette.gold)
          .lineLimit(1)
      }
      Spacer(minLength: 8)
      Text(verseText)
        .font(serif(14))
        .lineLimit(5)
        .truncationMode(.tail)
        .foregroundColor(palette.verseText)
      Spacer(minLength: 8)
      HStack {
        Text(versionLabel)
          .font(.system(size: 10))
          .foregroundColor(palette.version)
          .lineLimit(1)
        Spacer()
        Text("✦")
          .font(.system(size: 10))
          .foregroundColor(palette.gold)
      }
    }
    .padding(16)
  }

  // MARK: Medium — the current widget, tightened.

  private var medium: some View {
    HStack(spacing: 0) {
      LinearGradient(
        gradient: Gradient(colors: [Color(hex: 0xE4_BE_7C), Color(hex: 0x8A_6B_36)]),
        startPoint: .top,
        endPoint: .bottom
      )
      .frame(width: 3)

      VStack(alignment: .leading, spacing: 0) {
        HStack {
          Eyebrow(text: "VERSE OF THE DAY", color: palette.eyebrow)
          Spacer()
          Text(versionLabel)
            .font(.system(size: 10))
            .foregroundColor(palette.version)
            .lineLimit(1)
        }
        Spacer(minLength: 8)
        Text(verseText)
          .font(serif(15))
          .lineLimit(3)
          .truncationMode(.tail)
          .foregroundColor(palette.verseText)
        Spacer(minLength: 8)
        HStack {
          Text(reference)
            .font(serif(12, .semibold))
            .foregroundColor(palette.gold)
            .lineLimit(1)
          Spacer()
          Wordmark(palette: palette)
        }
      }
      .padding(.vertical, 16)
      .padding(.horizontal, 18)
    }
  }

  // MARK: Large — verse + explanation, one tap target each.

  private var large: some View {
    VStack(alignment: .leading, spacing: 0) {
      verseZone

      if let explanation = explanation {
        Rectangle()
          .fill(palette.hairline)
          .frame(height: 1)

        if let noteURL = noteURL {
          Link(destination: noteURL) { noteZone(explanation) }
        } else {
          noteZone(explanation)
        }
      }
    }
  }

  private var verseZone: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Eyebrow(text: "VERSE OF THE DAY", color: palette.largeEyebrow)
        Spacer()
        Text(dateAndVersion)
          .font(.system(size: 10))
          .foregroundColor(palette.version)
          .lineLimit(1)
      }
      Text(verseText)
        // Without the note zone the verse owns the freed rows.
        .lineLimit(explanation == nil ? 12 : 4)
        .font(serif(17))
        .truncationMode(.tail)
        .foregroundColor(palette.verseText)
      if !isFallback {
        Text(reference)
          .font(serif(13, .semibold))
          .foregroundColor(palette.gold)
          .lineLimit(1)
      }
      if explanation == nil { Spacer(minLength: 0) }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.top, 18)
    .padding(.horizontal, 20)
    .padding(.bottom, 16)
    .background(
      LinearGradient(
        gradient: Gradient(colors: [palette.largeHeaderTop, palette.largeHeaderBottom]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
  }

  private func noteZone(_ explanation: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Eyebrow(text: "WHY IT MATTERS", color: palette.eyebrow)
      Text(explanation)
        .font(serif(13, .light))
        .lineLimit(6)
        .truncationMode(.tail)
        .foregroundColor(palette.explanation)
      Spacer(minLength: 0)
      VStack(spacing: 0) {
        Rectangle()
          .fill(palette.footerHairline)
          .frame(height: 1)
        HStack {
          Text("Read the full note →")
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(palette.gold)
            .lineLimit(1)
          Spacer()
          Wordmark(palette: palette)
        }
        .padding(.top, 10)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(.top, 16)
    .padding(.horizontal, 20)
    .padding(.bottom, 14)
  }
}

extension WidgetConfiguration {
  /// From iOS 17 WidgetKit insets widget content with its own default margins.
  /// The design's large family is drawn edge-to-edge — a full-bleed gradient
  /// header and a divider spanning the full width — and the view already supplies
  /// the design's own paddings (16/18/20), so the OS margins both double them and
  /// float the divider away from the edges. Confirmed on a simulator: with the
  /// margins left on, the header and divider are visibly inset from the rounded
  /// corners and the verse loses a line to the narrower text column.
  func edgeToEdgeIfAvailable() -> some WidgetConfiguration {
    if #available(iOS 17.0, *) {
      return self.contentMarginsDisabled()
    } else {
      return self
    }
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
    .edgeToEdgeIfAvailable()
  }
}
