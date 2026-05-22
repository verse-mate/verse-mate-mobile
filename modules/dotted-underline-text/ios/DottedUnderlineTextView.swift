import ExpoModulesCore
import UIKit

/**
 * One decoration range. Mirrors `UnderlineRange` on the JS side. `style`
 * is "dotted" or "solid"; `thickness` is honoured on Android only (iOS has
 * no per-range underline-stroke-width attribute on NSAttributedString).
 */
public struct UnderlineRangeSpec {
  public var start: Int
  public var end: Int
  /// `nil` = no underline. `"dotted"` or `"solid"` when underline is desired.
  public var style: String?
  public var color: UIColor?
  public var backgroundColor: UIColor?
  public var fontWeight: String?
  public var textColor: UIColor?
}

/**
 * UILabel-backed native view that renders text with a CSS-style dotted or
 * solid underline using NSAttributedString. We expose an `onPress`
 * EventDispatcher that fires when the user taps anywhere on the label,
 * plus `onRangeTap` (with the matched range index) when the tap lands
 * inside one of the `ranges`.
 *
 * Using NSUnderlineStyle.single.union(.patternDot) gives us a true dotted
 * underline that matches the web (`text-decoration-style: dotted`).
 *
 * Tap detection inside a specific range is done by reconstructing an
 * `NSLayoutManager` whose geometry matches the label and asking it for the
 * character index at the touch point. (We use the label's intrinsic frame
 * because that's what RN sized the underlying view to.)
 */
public final class DottedUnderlineTextView: ExpoView {
  let onPress = EventDispatcher()
  let onRangeTap = EventDispatcher()

  // Backing label; configured for selectable interaction below.
  private let label: UILabel = {
    let l = UILabel()
    l.numberOfLines = 0
    l.translatesAutoresizingMaskIntoConstraints = false
    l.isUserInteractionEnabled = true
    return l
  }()

  // Stored prop values; we rebuild the attributed string whenever any of
  // these change so the native view stays in sync with the JS props.
  var text: String = "" { didSet { updateAttributedText() } }
  var fontSize: CGFloat = 17 { didSet { updateAttributedText() } }
  var textColor: UIColor = .label { didSet { updateAttributedText() } }
  var fontFamily: String? { didSet { updateAttributedText() } }
  var fontWeight: String? { didSet { updateAttributedText() } }
  var letterSpacing: CGFloat = 0 { didSet { updateAttributedText() } }
  var lineHeight: CGFloat = 0 { didSet { updateAttributedText() } }
  var textAlign: NSTextAlignment = .natural { didSet { updateAttributedText() } }
  var underlineColor: UIColor? { didSet { updateAttributedText() } }
  var underlineStyle: String = "dotted" { didSet { updateAttributedText() } }
  var underlineThickness: CGFloat = 1 { didSet { updateAttributedText() } }
  var ranges: [UnderlineRangeSpec]? { didSet { updateAttributedText() } }
  var selectable: Bool = true {
    didSet {
      // Enabling selection requires swapping to a UITextView; we keep the
      // simple UILabel path for now and rely on iOS long-press copy via
      // the menu controller (added below). Most callers just need tap +
      // long-press, which UILabel + tap recognizer provides.
    }
  }

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    addSubview(label)
    NSLayoutConstraint.activate([
      label.topAnchor.constraint(equalTo: topAnchor),
      label.leadingAnchor.constraint(equalTo: leadingAnchor),
      label.trailingAnchor.constraint(equalTo: trailingAnchor),
      label.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    addGestureRecognizer(tap)

    let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress))
    addGestureRecognizer(longPress)
  }

  @objc private func handleTap(_ gr: UITapGestureRecognizer) {
    // Resolve the character index under the tap and check whether it lies
    // inside any underlined range. If so, fire onRangeTap with the index of
    // the matched range; otherwise fall through to the generic onPress.
    let point = gr.location(in: label)
    if let attr = label.attributedText, let rs = ranges, !rs.isEmpty {
      let charIndex = characterIndex(at: point, in: attr)
      if charIndex >= 0 {
        for (i, r) in rs.enumerated() {
          if charIndex >= r.start && charIndex < r.end {
            onRangeTap(["index": i])
            return
          }
        }
      }
    }
    onPress()
  }

  /**
   * Find the character index in `attr` that sits under `point` in label's
   * coordinate space. Returns -1 when the point is outside the layout area.
   *
   * We build a one-shot NSLayoutManager whose container size matches the
   * label so the layout we measure is exactly what's drawn on screen.
   */
  private func characterIndex(at point: CGPoint, in attr: NSAttributedString) -> Int {
    let storage = NSTextStorage(attributedString: attr)
    let layoutManager = NSLayoutManager()
    let container = NSTextContainer(size: label.bounds.size)
    container.lineFragmentPadding = 0
    container.maximumNumberOfLines = label.numberOfLines
    container.lineBreakMode = label.lineBreakMode
    layoutManager.addTextContainer(container)
    storage.addLayoutManager(layoutManager)

    // Adjust point for label vertical centering: UILabel centers text
    // vertically when its bounds are taller than the rendered text.
    var adjusted = point
    let usedRect = layoutManager.usedRect(for: container)
    let dy = (label.bounds.height - usedRect.height) * 0.5
    if dy > 0 {
      adjusted.y -= dy
    }

    guard adjusted.x >= 0,
          adjusted.y >= 0,
          adjusted.x <= label.bounds.width,
          adjusted.y <= usedRect.height else {
      return -1
    }

    let charIndex = layoutManager.characterIndex(
      for: adjusted,
      in: container,
      fractionOfDistanceBetweenInsertionPoints: nil
    )
    return charIndex
  }

  // Long-press shows the standard copy menu so users can grab the verse text,
  // matching RN <Text selectable> behaviour.
  @objc private func handleLongPress(_ gr: UILongPressGestureRecognizer) {
    guard selectable, gr.state == .began else { return }
    becomeFirstResponder()
    let menu = UIMenuController.shared
    if #available(iOS 13.0, *) {
      menu.showMenu(from: self, rect: bounds)
    } else {
      menu.setTargetRect(bounds, in: self)
      menu.setMenuVisible(true, animated: true)
    }
  }

  public override var canBecomeFirstResponder: Bool { selectable }

  public override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    return action == #selector(copy(_:))
  }

  public override func copy(_ sender: Any?) {
    UIPasteboard.general.string = text
  }

  // MARK: - Attributed string build

  private func weightFromString(_ value: String?) -> UIFont.Weight {
    switch value {
    case "100": return .ultraLight
    case "200": return .thin
    case "300": return .light
    case "400", "normal", nil: return .regular
    case "500": return .medium
    case "600": return .semibold
    case "700", "bold": return .bold
    case "800": return .heavy
    case "900": return .black
    default: return .regular
    }
  }

  private func font(forWeight weightString: String?) -> UIFont {
    let weight = weightFromString(weightString)
    if let family = fontFamily, !family.isEmpty,
       let descriptor = UIFont(name: family, size: fontSize)?.fontDescriptor {
      let traits: [UIFontDescriptor.TraitKey: Any] = [.weight: weight]
      let merged = descriptor.addingAttributes([.traits: traits])
      return UIFont(descriptor: merged, size: fontSize)
    }
    return UIFont.systemFont(ofSize: fontSize, weight: weight)
  }

  private func resolvedFont() -> UIFont {
    return font(forWeight: fontWeight)
  }

  private func updateAttributedText() {
    let font = resolvedFont()

    // Base attributes — applied to the entire string.
    var baseAttrs: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: textColor,
    ]

    if letterSpacing != 0 {
      baseAttrs[.kern] = letterSpacing
    }

    if lineHeight > 0 {
      let paragraph = NSMutableParagraphStyle()
      paragraph.minimumLineHeight = lineHeight
      paragraph.maximumLineHeight = lineHeight
      paragraph.alignment = textAlign
      baseAttrs[.paragraphStyle] = paragraph
    } else if textAlign != .natural {
      let paragraph = NSMutableParagraphStyle()
      paragraph.alignment = textAlign
      baseAttrs[.paragraphStyle] = paragraph
    }

    let mutable = NSMutableAttributedString(string: text, attributes: baseAttrs)

    if let rs = ranges, !rs.isEmpty {
      // Per-range mode — apply underline + background + per-range font/color
      // only on the specified sub-strings. No whole-text underline in this
      // mode. A range with no `style` (nil) but a `backgroundColor` is a
      // pure highlight; a range with both gets an underline AND a highlight.
      let nsstring = text as NSString
      for r in rs {
        let safeStart = max(0, min(r.start, nsstring.length))
        let safeEnd = max(safeStart, min(r.end, nsstring.length))
        if safeEnd <= safeStart { continue }
        let nsRange = NSRange(location: safeStart, length: safeEnd - safeStart)
        var rangeAttrs: [NSAttributedString.Key: Any] = [:]

        // Underline (optional)
        if let style = r.style {
          let baseStyle = NSUnderlineStyle.single
          let raw: Int = style == "dotted"
            ? baseStyle.union(.patternDot).rawValue
            : baseStyle.rawValue
          rangeAttrs[.underlineStyle] = raw
          if let c = r.color {
            rangeAttrs[.underlineColor] = c
          } else if let c = underlineColor {
            rangeAttrs[.underlineColor] = c
          }
        }

        // Background fill (highlight)
        if let bg = r.backgroundColor {
          rangeAttrs[.backgroundColor] = bg
        }

        // Per-range text color (e.g. theme tier brightening)
        if let fg = r.textColor {
          rangeAttrs[.foregroundColor] = fg
        }

        // Per-range font weight (e.g. theme tier semibold)
        if let weight = r.fontWeight {
          rangeAttrs[.font] = font(forWeight: weight)
        }

        if !rangeAttrs.isEmpty {
          mutable.addAttributes(rangeAttrs, range: nsRange)
        }
      }
    } else {
      // Whole-text mode — add a single underline attribute across the string.
      let baseStyle = NSUnderlineStyle.single
      let underlineRaw: Int = underlineStyle == "dotted"
        ? baseStyle.union(.patternDot).rawValue
        : baseStyle.rawValue
      let length = (text as NSString).length
      if length > 0 {
        var underlineAttrs: [NSAttributedString.Key: Any] = [
          .underlineStyle: underlineRaw,
          .underlineColor: underlineColor ?? textColor,
        ]
        mutable.addAttributes(underlineAttrs, range: NSRange(location: 0, length: length))
      }
    }

    // Note: iOS does NOT expose a dedicated underline-stroke-width attribute,
    // so `underlineThickness` is mostly honoured on Android. The dot density
    // of .patternDot is implicit. We document this in the JS types.

    label.attributedText = mutable
  }
}
