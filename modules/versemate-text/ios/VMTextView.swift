import ExpoModulesCore
import UIKit

/**
 One native text view for a whole block of decorated text.

 Counterpart to `../android/.../VMTextView.kt`. The contract it has to honour is the JS one, not the
 Kotlin one: same props, same events, same character-offset semantics, so `lib/text`'s compiler and
 every consumer work unchanged across platforms.

 ## Why UITextView rather than UILabel or raw CoreText

 Selection. Android got it from `setTextIsSelectable`, and the equivalent on iOS is a
 non-editable-but-selectable `UITextView` — which brings the loupe, the grab handles and the Copy
 menu for free. A `UILabel` has none of that and a CoreText-drawing `UIView` would mean
 reimplementing text interaction from scratch.

 It costs some care in setup: `UITextView` owns an internal scroll view and default insets, so
 `isScrollEnabled`, `textContainerInset` and `lineFragmentPadding` all have to be neutralised or the
 drawn text sits at a different origin than the measured text, and every line geometry the JS side
 anchors popovers to is off by the inset.

 It is still ONE view per block, which is the entire point — the React path emitted one `Text` per
 styled run.
 */
final class VMTextView: ExpoView {
  private let textView = UITextView()

  /// Populated by the module's Prop setters; a single `spec` keeps measure and draw from diverging.
  private(set) var spec = VMTextSpec()

  /// Set while reporting layout, so the reported geometry cannot re-enter and loop.
  private var isReportingLayout = false

  /// Last selection dispatched to JS, so an unchanged selection is not re-emitted.
  /// See `handleSelectionChanged()` for the measurement behind this; mirrors Android's
  /// `lastSelStart`/`lastSelEnd`.
  private var lastSelStart = Int.min
  private var lastSelEnd = Int.min

  private let onPress = EventDispatcher()
  private let onRangeTap = EventDispatcher()
  private let onTextLayout = EventDispatcher()
  private let onSelectionChange = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    textView.isEditable = false
    textView.isSelectable = true
    textView.isScrollEnabled = false
    textView.backgroundColor = .clear
    // Zeroed so the text's origin matches what `measure` computed. Left at their defaults, the text
    // is inset by 8pt vertically and 5pt horizontally and every measured height is short by 16pt.
    textView.textContainerInset = .zero
    textView.textContainer.lineFragmentPadding = 0
    textView.textContainer.lineBreakMode = .byWordWrapping
    // Underlines are custom-drawn on this view, beneath the text, so the text view must not paint
    // over them with its own opaque background.
    textView.isOpaque = false
    textView.delegate = self
    // Taps are ours; selection gestures stay the text view's. A tap recogniser added to the text view
    // would fight its own; adding it to the container and forwarding the point avoids that.
    textView.isUserInteractionEnabled = true

    addSubview(textView)

    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    // Do NOT cancel the text view's own recognisers: long-press must still start a selection.
    tap.cancelsTouchesInView = false
    addGestureRecognizer(tap)

    // Selection changes arrive via the DELEGATE, not NotificationCenter.
    //
    // `UITextView.textDidChangeSelectionNotification` DOES NOT EXIST. UITextView publishes
    // textDidBeginEditing / textDidChange / textDidEndEditing; selection is reported only through
    // `UITextViewDelegate.textViewDidChangeSelection(_:)`. Writing this port from memory of the API
    // invented that notification and it cost an EAS build:
    //   XCODE_BUILD_ERROR: type 'UITextView' has no member 'textDidChangeSelectionNotification'
    // The delegate is already assigned above, so the correct version is strictly less code — no
    // observer to register, none to tear down.
  }

  // MARK: - Spec

  func updateSpec(_ transform: (inout VMTextSpec) -> Void) {
    var next = spec
    transform(&next)
    guard next != spec else { return }
    spec = next
    textView.attributedText = next.buildAttributedString()
    // New content means any selection JS knew about is gone, and this view may be reused for a
    // different piece of text. Clearing the dedup state guarantees the first selection event after a
    // change is always delivered, so suppressing duplicates can never suppress news. Matches Android.
    lastSelStart = Int.min
    lastSelEnd = Int.min
    setNeedsLayout()
    // Underlines are drawn from `ranges`, so a range change has to repaint even when the text did
    // not change — a highlight toggling colour is exactly that case.
    setNeedsDisplay()
  }

  // MARK: - Layout

  override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    reportTextLayout()
  }

  /**
   Report per-line geometry by character offset, for anchoring popovers and tooltips.

   Shape matches the Android payload exactly (`start`, `end`, `x`, `y`, `width`, `height`,
   `baseline`) because `TextLineLayout` in src/types.ts is what both feed, and the lexicon popover's
   positioning code is shared.
   */
  private func reportTextLayout() {
    guard !isReportingLayout, bounds.width > 0, !spec.text.isEmpty else { return }
    isReportingLayout = true
    defer { isReportingLayout = false }

    let layoutManager = textView.layoutManager
    let container = textView.textContainer
    layoutManager.ensureLayout(for: container)

    var lines: [[String: Any]] = []
    var glyphIndex = 0
    let glyphCount = layoutManager.numberOfGlyphs

    while glyphIndex < glyphCount {
      var lineRange = NSRange(location: 0, length: 0)
      let rect = layoutManager.lineFragmentUsedRect(
        forGlyphAt: glyphIndex, effectiveRange: &lineRange
      )
      let charRange = layoutManager.characterRange(forGlyphRange: lineRange, actualGlyphRange: nil)
      // Baseline as a distance from the line's TOP, matching Android, rather than iOS's
      // ascender-relative convention — otherwise a shared popover anchor lands a line off.
      let baseline = layoutManager.location(forGlyphAt: lineRange.location).y

      lines.append([
        "start": charRange.location,
        "end": charRange.location + charRange.length,
        "x": rect.origin.x,
        "y": rect.origin.y,
        "width": rect.width,
        "height": rect.height,
        "baseline": baseline,
      ])
      glyphIndex = NSMaxRange(lineRange)
    }

    onTextLayout(["lines": lines])
  }

  // MARK: - Drawing

  /**
   Draw the custom underlines.

   Beneath the text, in `draw(_:)` on the container rather than the text view, so the text view's own
   rendering composites on top without the underline being clipped to a glyph run.

   `NSUnderlineStyle` is not used for the reason given in VMTextSpec: it cannot do hairline dotted
   gold at a fractional thickness, and the lexicon design needs exactly that.
   */
  override func draw(_ rect: CGRect) {
    super.draw(rect)
    guard let context = UIGraphicsGetCurrentContext(), !spec.text.isEmpty else { return }

    let layoutManager = textView.layoutManager
    let container = textView.textContainer
    layoutManager.ensureLayout(for: container)
    let nsText = spec.text as NSString

    for range in spec.ranges {
      guard let style = range.underlineStyle, !style.isEmpty else { continue }
      let start = min(max(range.start, 0), nsText.length)
      let end = min(max(range.end, start), nsText.length)
      if end <= start { continue }

      let charRange = NSRange(location: start, length: end - start)
      let glyphRange = layoutManager.glyphRange(forCharacterRange: charRange, actualCharacterRange: nil)

      context.saveGState()
      context.setStrokeColor(range.underlineColor.cgColor)
      context.setLineWidth(range.underlineThicknessPt)
      if style == "dotted" {
        // Phase 0 with a dot/gap pair scaled to thickness, so a hairline reads as dots rather than
        // as a dashed line at small sizes.
        context.setLineDash(phase: 0, lengths: [range.underlineThicknessPt, range.underlineThicknessPt * 2])
      } else if style == "dashed" {
        context.setLineDash(phase: 0, lengths: [range.underlineThicknessPt * 4, range.underlineThicknessPt * 3])
      }

      // A range can wrap, so stroke per line fragment rather than one rect for the whole range.
      layoutManager.enumerateLineFragments(forGlyphRange: glyphRange) { _, usedRect, _, lineGlyphRange, _ in
        let intersection = NSIntersectionRange(glyphRange, lineGlyphRange)
        guard intersection.length > 0 else { return }
        let segment = layoutManager.boundingRect(forGlyphRange: intersection, in: container)
        // Just below the used rect's baseline area; half the thickness keeps a fractional width
        // centred on a device pixel rather than straddling two.
        let y = usedRect.maxY - range.underlineThicknessPt
        context.move(to: CGPoint(x: segment.minX, y: y))
        context.addLine(to: CGPoint(x: segment.maxX, y: y))
        context.strokePath()
      }
      context.restoreGState()
    }
  }

  // MARK: - Interaction

  @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
    // A tap that lands while text is selected should dismiss the selection rather than be reported
    // as a fresh tap — the same "tap away to dismiss" behaviour the operator asked for on Android.
    if let selected = textView.selectedTextRange, !selected.isEmpty {
      textView.selectedTextRange = nil
      return
    }

    let point = recognizer.location(in: textView)
    let offset = characterOffset(at: point)
    guard offset >= 0 else { return }

    // First interactive range containing the offset wins, in array order — the same precedence the
    // JS side documents for overlapping ranges, so a lexicon word inside a highlight still opens the
    // lexicon rather than the highlight.
    for (index, range) in spec.ranges.enumerated() where range.interactive {
      if offset >= range.start, offset < range.end {
        onRangeTap(["index": index, "charOffset": offset])
        return
      }
    }
    onPress(["charOffset": offset, "x": point.x, "y": point.y])
  }

  /// Nearest character offset to a point, or -1 when the point is outside the text.
  private func characterOffset(at point: CGPoint) -> Int {
    let layoutManager = textView.layoutManager
    let container = textView.textContainer
    layoutManager.ensureLayout(for: container)

    var fraction: CGFloat = 0
    let glyphIndex = layoutManager.glyphIndex(for: point, in: container, fractionOfDistanceThroughGlyph: &fraction)
    guard layoutManager.numberOfGlyphs > 0 else { return -1 }
    let charIndex = layoutManager.characterIndexForGlyph(at: glyphIndex)
    // `glyphIndex(for:)` clamps to the nearest glyph rather than failing, so a tap past the last line
    // reports the final character. That matches Android's behaviour and is what the caller wants:
    // "which verse did I tap" has an answer even for a tap in the trailing whitespace.
    return charIndex
  }

  /// Emit a selection only when it actually changed.
  ///
  /// Mirrors the Android view's `lastSelStart`/`lastSelEnd`, and exists for the same measured reason:
  /// on Android, `receiveEvent('topSelectionChange')` fired **1254 times in six seconds** across three
  /// view toggles (1518 `text.selectionEvent` counted on the JS side in one session), overwhelmingly
  /// "still nothing selected" for views that never had a selection. Cheap natively, but every one
  /// crosses into JS.
  ///
  /// UIKit is at least as chatty as Android here — `textViewDidChangeSelection` fires on caret moves
  /// and on every `attributedText` assignment — so shipping the dedup on only one platform would mean
  /// the two behave differently for no reason.
  fileprivate func handleSelectionChanged() {
    var start = -1
    var end = -1
    if let selected = textView.selectedTextRange {
      let from = textView.offset(from: textView.beginningOfDocument, to: selected.start)
      let to = textView.offset(from: textView.beginningOfDocument, to: selected.end)
      // A caret reports start == end; normalise to -1/-1 so JS gets one unambiguous
      // "nothing selected" signal rather than having to know the convention.
      if from != to {
        start = from
        end = to
      }
    }
    guard start != lastSelStart || end != lastSelEnd else { return }
    lastSelStart = start
    lastSelEnd = end
    onSelectionChange(["start": start, "end": end])
  }
}

extension VMTextView: UITextViewDelegate {
  /// Editing is off; this view is selectable but not editable.
  func textViewShouldBeginEditing(_ textView: UITextView) -> Bool { false }

  /// The only route by which UITextView reports a selection change — see the note in `init`.
  func textViewDidChangeSelection(_ textView: UITextView) {
    handleSelectionChanged()
  }
}
