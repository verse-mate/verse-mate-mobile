import UIKit

/**
 One decorated character range, mirroring `TextRange` in `../src/types.ts` and `VMRange` in
 `../android/.../VMTextSpec.kt`.

 `start` is inclusive and `end` exclusive, matching `String.slice`, so the offsets JS computes need
 no translation. Offsets are UTF-16 code units on both platforms — the same unit JS strings use and
 the same unit `NSAttributedString` indexes by, so no conversion is needed here either. (Swift's
 native `String.Index` is NOT that unit, which is why everything below works in `NSRange`.)
 */
struct VMRange: Hashable {
  let start: Int
  let end: Int
  /// nil when this range draws no underline.
  let underlineStyle: String?
  let underlineColor: UIColor
  let underlineThicknessPt: CGFloat
  let backgroundColor: UIColor?
  let textColor: UIColor?
  let fontWeight: String?
  /// "italic", or nil for upright. Combined with fontWeight into one font trait set.
  let fontStyle: String?
  /// Font size multiplier relative to the base size. 1.0 = unchanged.
  let fontScale: CGFloat
  /// Baseline offset as a multiple of the base font size; positive raises.
  let baselineShift: CGFloat
  let interactive: Bool
}

/**
 Everything needed to lay out one block of text.

 A value type with structural equality so it can double as the measurement cache key, exactly as on
 Android: adding a field that affects layout automatically participates in cache invalidation, and a
 field that affects layout but is missing here would serve stale heights and clip text.

 Sizes are in points, already resolved by the caller, because the JS side works in
 density-independent units and that conversion should happen once at the boundary rather than in
 both the measure and draw paths.
 */
struct VMTextSpec: Hashable {
  var text: String = ""
  /**
   DECODED ranges, not the encoded string.

   The view receives them encoded (a prop) and measurement receives them as records (a function
   argument), so storing the decoded form is what lets ONE spec type serve both paths — and lets the
   measurement cache key cover decorations structurally. Holding the string instead would make two
   specs with identical decorations but different encodings miss the cache, and worse, an encoded
   string reaching the measure path would be silently ignored: the first version of this port did
   exactly that, so every measured height came back undecorated.
   */
  var ranges: [VMRange] = []
  var fontSizePt: CGFloat = 14
  var fontFamily: String?
  var fontWeight: String?
  /// Explicit line height in points, or 0 to use the font's natural spacing.
  var lineHeightPt: CGFloat = 0
  var letterSpacingPt: CGFloat = 0
  var textAlign: String?
  var colorHex: String?
  /// Available width in points. Layout wraps to this.
  var widthPt: CGFloat = 0
}

/**
 Map a CSS weight to a UIFont weight.

 Deliberately coarser than CSS: iOS exposes named weights and the design only ever asks for regular
 and bold. `isBoldWeight`'s 600 threshold is kept identical to the Kotlin so the two platforms make
 the same decision for the same input.
 */
func vmIsBoldWeight(_ value: String?) -> Bool {
  guard let value else { return false }
  if value == "bold" { return true }
  return (Int(value) ?? 400) >= 600
}

/// Build a font with the requested traits, falling back to the system font when a family is unknown.
func vmFont(family: String?, size: CGFloat, bold: Bool, italic: Bool) -> UIFont {
  let base: UIFont
  if let family, !family.isEmpty, let named = UIFont(name: family, size: size) {
    base = named
  } else {
    base = UIFont.systemFont(ofSize: size, weight: bold ? .bold : .regular)
  }

  var traits: UIFontDescriptor.SymbolicTraits = []
  // A named family needs the bold trait applied explicitly; the system font already carries it via
  // the weight above, but asking twice is harmless and keeps the branches from diverging.
  if bold { traits.insert(.traitBold) }
  if italic { traits.insert(.traitItalic) }
  guard !traits.isEmpty, let descriptor = base.fontDescriptor.withSymbolicTraits(traits) else {
    return base
  }
  return UIFont(descriptor: descriptor, size: size)
}

/**
 Parse a colour string from JS, returning nil rather than throwing.

 A malformed colour is a styling mistake, not a reason to fail a render — the text still has to
 appear. Supports the `rgba(...)` strings the theme uses as well as `#rgb` / `#rrggbb` / `#rrggbbaa`,
 because `UIColor` understands none of them natively. Mirrors `parseColorOrNull` on Android.
 */
func vmParseColor(_ value: String?) -> UIColor? {
  guard let raw = value?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }

  if raw.hasPrefix("#") {
    var hex = String(raw.dropFirst())
    if hex.count == 3 {
      // #rgb -> #rrggbb
      hex = hex.map { "\($0)\($0)" }.joined()
    }
    guard let intVal = UInt64(hex, radix: 16) else { return nil }
    switch hex.count {
    case 6:
      return UIColor(
        red: CGFloat((intVal & 0xFF0000) >> 16) / 255,
        green: CGFloat((intVal & 0x00FF00) >> 8) / 255,
        blue: CGFloat(intVal & 0x0000FF) / 255,
        alpha: 1
      )
    case 8:
      // #rrggbbaa — the CSS order, which is what the theme emits. Note this is NOT
      // Android's #aarrggbb; getting it backwards yields a transparent black instead of
      // a coloured highlight, which reads as "the highlight did not render".
      return UIColor(
        red: CGFloat((intVal & 0xFF00_0000) >> 24) / 255,
        green: CGFloat((intVal & 0x00FF_0000) >> 16) / 255,
        blue: CGFloat((intVal & 0x0000_FF00) >> 8) / 255,
        alpha: CGFloat(intVal & 0x0000_00FF) / 255
      )
    default:
      return nil
    }
  }

  let lower = raw.lowercased()
  if lower.hasPrefix("rgb") {
    let inner = lower
      .replacingOccurrences(of: "rgba(", with: "")
      .replacingOccurrences(of: "rgb(", with: "")
      .replacingOccurrences(of: ")", with: "")
    let parts = inner.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    guard parts.count >= 3,
          let r = Double(parts[0]), let g = Double(parts[1]), let b = Double(parts[2])
    else { return nil }
    let a = parts.count > 3 ? (Double(parts[3]) ?? 1) : 1
    return UIColor(red: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: CGFloat(a))
  }

  if lower == "transparent" { return .clear }
  if lower == "black" { return .black }
  if lower == "white" { return .white }
  return nil
}

/**
 Decode the encoded decoration list.

 Format: ranges separated by `|`, fields by `~`, in this fixed order:

   start ~ end ~ underlineStyle ~ underlineColor ~ underlineThickness ~
   backgroundColor ~ color ~ fontWeight ~ fontScale ~ baselineShift ~ interactive ~ fontStyle

 Byte-identical to `decodeRanges` in VMTextModule.kt, and that is the point: both platforms decode
 what `encodeRanges` in src/VMText.tsx produces, so a field appended for one must be readable by the
 other. `fontStyle` is LAST and read defensively, so a JS bundle that predates it still decodes.

 A string was chosen over a structured prop because the structured path crashed: Expo's pooled
 `Dynamic` converter threw "Already in the pool!" when handed a `List<Record>` per view.
 */
func vmDecodeRanges(_ encoded: String) -> [VMRange] {
  guard !encoded.isEmpty else { return [] }
  var out: [VMRange] = []
  for chunk in encoded.split(separator: "|", omittingEmptySubsequences: true) {
    let f = chunk.components(separatedBy: "~")
    guard f.count >= 11 else { continue }
    func field(_ i: Int) -> String? {
      guard i < f.count, !f[i].isEmpty else { return nil }
      return f[i]
    }
    out.append(
      VMRange(
        start: Int(f[0]) ?? 0,
        end: Int(f[1]) ?? 0,
        underlineStyle: field(2),
        underlineColor: vmParseColor(field(3)) ?? .black,
        underlineThicknessPt: CGFloat(Double(f[4]) ?? 1),
        backgroundColor: vmParseColor(field(5)),
        textColor: vmParseColor(field(6)),
        fontWeight: field(7),
        fontStyle: field(11),
        fontScale: CGFloat(Double(f[8]) ?? 1),
        baselineShift: CGFloat(Double(f[9]) ?? 0),
        interactive: f[10] == "1"
      )
    )
  }
  return out
}

extension VMTextSpec {
  var resolvedColor: UIColor { vmParseColor(colorHex) ?? .label }

  /// Paragraph style shared by measurement and drawing, so the two cannot disagree on line height.
  func paragraphStyle() -> NSParagraphStyle {
    let style = NSMutableParagraphStyle()
    switch textAlign {
    case "center": style.alignment = .center
    case "right": style.alignment = .right
    case "justify": style.alignment = .justified
    default: style.alignment = .natural
    }
    if lineHeightPt > 0 {
      // Both bounds, like Android's ExactLineHeightSpan: setting only the minimum lets a range with
      // a larger font grow the line and the measured height then disagrees with the drawn one.
      style.minimumLineHeight = lineHeightPt
      style.maximumLineHeight = lineHeightPt
    }
    return style
  }

  /**
   Build the styled text.

   Underlines are deliberately NOT attributes. `NSUnderlineStyle` cannot express the design (hairline
   dotted gold, two tiers, fractional thickness), and `.patternDot` is coarse and colour-coupled, so
   they are drawn manually in `VMTextView.draw(_:)` — the same decision the Android side made.
   Everything else maps to an attribute so TextKit handles it during layout.
   */
  func buildAttributedString() -> NSAttributedString {
    let baseBold = vmIsBoldWeight(fontWeight)
    let baseFont = vmFont(family: fontFamily, size: fontSizePt, bold: baseBold, italic: false)
    let attributed = NSMutableAttributedString(
      string: text,
      attributes: [
        .font: baseFont,
        .foregroundColor: resolvedColor,
        .paragraphStyle: paragraphStyle(),
        .kern: letterSpacingPt,
      ]
    )

    let length = (text as NSString).length
    for range in ranges {
      let start = min(max(range.start, 0), length)
      let end = min(max(range.end, start), length)
      if end <= start { continue }
      let nsRange = NSRange(location: start, length: end - start)

      if let background = range.backgroundColor {
        attributed.addAttribute(.backgroundColor, value: background, range: nsRange)
      }
      if let color = range.textColor {
        attributed.addAttribute(.foregroundColor, value: color, range: nsRange)
      }

      // One font per range covering BOTH axes and the scale. Applying weight and slant as separate
      // attributes is not possible here — there is a single `.font` — and computing them separately
      // would let the later write drop the earlier trait, the same failure the Android side hits
      // with two overlapping StyleSpans.
      let bold = range.fontWeight != nil ? vmIsBoldWeight(range.fontWeight) : baseBold
      let italic = range.fontStyle == "italic"
      let scaled = range.fontScale > 0 ? fontSizePt * range.fontScale : fontSizePt
      if bold != baseBold || italic || scaled != fontSizePt {
        attributed.addAttribute(
          .font,
          value: vmFont(family: fontFamily, size: scaled, bold: bold, italic: italic),
          range: nsRange
        )
      }

      if range.baselineShift != 0 {
        // Points, and positive raises — same sign convention as the JS prop, unlike Android's
        // baselineShift where positive moves DOWN.
        attributed.addAttribute(
          .baselineOffset,
          value: fontSizePt * range.baselineShift,
          range: nsRange
        )
      }
    }
    return attributed
  }
}
