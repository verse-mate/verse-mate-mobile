import ExpoModulesCore
import UIKit

/**
 JS-facing shape of one decoration range. Mirrors `NativeTextRange` in ../src/VMTextModule.ts and
 `RangeRecord` in the Kotlin module.

 Records here, an encoded string on the view prop. The asymmetry is deliberate and comes from a real
 crash: passing a list of records as a per-view PROP tripped Expo's pooled `Dynamic` converter
 ("Already in the pool!"), so the prop became a string. A function ARGUMENT never touched that pool,
 so measurement kept the structured form — and matching what JS already sends matters more than
 internal symmetry.
 */
struct VMRangeRecord: Record {
  @Field var start: Int = 0
  @Field var end: Int = 0
  @Field var underlineStyle: String?
  @Field var underlineColor: String?
  @Field var underlineThickness: Double?
  @Field var backgroundColor: String?
  @Field var color: String?
  @Field var fontWeight: String?
  @Field var fontStyle: String?
  @Field var fontScale: Double?
  @Field var baselineShift: Double?
  @Field var interactive: Bool = false

  func toRange() -> VMRange {
    VMRange(
      start: start,
      end: end,
      underlineStyle: underlineStyle,
      underlineColor: vmParseColor(underlineColor) ?? .black,
      underlineThicknessPt: CGFloat(underlineThickness ?? 1),
      backgroundColor: vmParseColor(backgroundColor),
      textColor: vmParseColor(color),
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      fontScale: CGFloat(fontScale ?? 1),
      baselineShift: CGFloat(baselineShift ?? 0),
      interactive: interactive
    )
  }
}

/// JS-facing shape of a measurement request. Mirrors `MeasureRequest` in ../src/VMTextModule.ts.
struct VMMeasureRequest: Record {
  @Field var text: String = ""
  @Field var ranges: [VMRangeRecord] = []
  /// Available width in points.
  @Field var width: Double = 0
  /// Base font size in points.
  @Field var fontSize: Double = 14
  @Field var fontFamily: String?
  @Field var fontWeight: String?
  /// Explicit line height in points, or 0/absent for the font's natural spacing.
  @Field var lineHeight: Double?
  @Field var letterSpacing: Double?
  @Field var textAlign: String?
}

/**
 Measurement cache, keyed on the whole spec.

 Same reasoning as the Kotlin side: a chapter mounts ~20 paragraphs and the JS layout hook measures
 each of them before deciding what to render, so without a cache every scroll and every re-render
 re-lays-out text that has not changed. Keyed on `VMTextSpec`'s structural equality so any field that
 affects layout invalidates automatically.

 Cleared on a font-scale change — every cached height was measured against the old scale, and reusing
 one means text measured small gets drawn large and clips.
 */
private final class VMMeasureCache {
  static let shared = VMMeasureCache()
  private var heights: [VMTextSpec: Double] = [:]
  private let lock = NSLock()

  /// Bounded so a long reading session cannot grow it without limit; ~20 paragraphs per chapter and
  /// a handful of chapters in the pager means a few hundred entries is generous.
  private let limit = 512

  func height(for spec: VMTextSpec, compute: () -> Double) -> Double {
    lock.lock()
    if let cached = heights[spec] {
      lock.unlock()
      return cached
    }
    lock.unlock()

    let value = compute()

    lock.lock()
    // Crude eviction: drop everything rather than track recency. A full clear costs one re-measure
    // per visible paragraph, which is cheaper than maintaining an LRU for a cache this small.
    if heights.count >= limit { heights.removeAll(keepingCapacity: true) }
    heights[spec] = value
    lock.unlock()
    return value
  }

  func clear() {
    lock.lock()
    heights.removeAll(keepingCapacity: false)
    lock.unlock()
  }
}

/// Lay out a spec off-screen and return its height in points.
private func vmMeasureHeight(_ spec: VMTextSpec) -> Double {
  guard spec.widthPt > 0, !spec.text.isEmpty else { return 0 }
  return VMMeasureCache.shared.height(for: spec) {
    let storage = NSTextStorage(attributedString: spec.buildAttributedString())
    let container = NSTextContainer(size: CGSize(width: spec.widthPt, height: .greatestFiniteMagnitude))
    container.lineFragmentPadding = 0
    container.lineBreakMode = .byWordWrapping
    let layoutManager = NSLayoutManager()
    // TextKit 1 explicitly: it is what UITextView uses under the hood on the versions this module
    // supports, and measuring with a different engine than the one that draws is how measured and
    // drawn heights drift apart.
    layoutManager.addTextContainer(container)
    storage.addLayoutManager(layoutManager)
    layoutManager.ensureLayout(for: container)
    let used = layoutManager.usedRect(for: container)
    // Ceil, never round: a height half a point short clips the final descender, and a spare
    // half point is invisible.
    return Double(ceil(used.height))
  }
}

private func vmSpec(from request: VMMeasureRequest) -> VMTextSpec {
  var spec = VMTextSpec()
  spec.text = request.text
  spec.ranges = request.ranges.map { $0.toRange() }
  spec.widthPt = CGFloat(request.width)
  spec.fontSizePt = CGFloat(request.fontSize)
  spec.fontFamily = request.fontFamily
  spec.fontWeight = request.fontWeight
  spec.lineHeightPt = CGFloat(request.lineHeight ?? 0)
  spec.letterSpacingPt = CGFloat(request.letterSpacing ?? 0)
  spec.textAlign = request.textAlign
  return spec
}

public class VMTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VMText")

    /**
     Measure one block, synchronously.

     Synchronous on purpose, matching Android: the JS layout hook needs the height in the same tick it
     decides what to render, and an async measure would mean rendering at a guessed height and
     correcting a frame later — which is a visible jump.
     */
    Function("measureHeight") { (request: VMMeasureRequest) -> Double in
      vmMeasureHeight(vmSpec(from: request))
    }

    /**
     Measure many blocks in one call.

     A chapter mounts ~20 paragraphs together, so this turns 20 JSI crossings into one. Returns a
     plain array in request order; the per-block work is unchanged and still cache-backed.
     */
    Function("measureHeights") { (requests: [VMMeasureRequest]) -> [Double] in
      requests.map { vmMeasureHeight(vmSpec(from: $0)) }
    }

    Function("clearCache") {
      VMMeasureCache.shared.clear()
    }

    View(VMTextView.self) {
      Events("onPress", "onRangeTap", "onTextLayout", "onSelectionChange")

      Prop("text") { (view: VMTextView, value: String?) in
        view.updateSpec { $0.text = value ?? "" }
      }
      Prop("fontSize") { (view: VMTextView, value: Double?) in
        view.updateSpec { $0.fontSizePt = CGFloat(value ?? 14) }
      }
      Prop("color") { (view: VMTextView, value: String?) in
        view.updateSpec { $0.colorHex = value }
      }
      Prop("fontFamily") { (view: VMTextView, value: String?) in
        view.updateSpec { $0.fontFamily = value }
      }
      Prop("fontWeight") { (view: VMTextView, value: String?) in
        view.updateSpec { $0.fontWeight = value }
      }
      Prop("lineHeight") { (view: VMTextView, value: Double?) in
        view.updateSpec { $0.lineHeightPt = CGFloat(value ?? 0) }
      }
      Prop("letterSpacing") { (view: VMTextView, value: Double?) in
        view.updateSpec { $0.letterSpacingPt = CGFloat(value ?? 0) }
      }
      Prop("textAlign") { (view: VMTextView, value: String?) in
        view.updateSpec { $0.textAlign = value }
      }
      /**
       Decorations as one encoded string.

       See VMMeasureRequest: the structured `List<Record>` prop crashed Expo's pooled converter, so
       both platforms take a string and decode it themselves. Field order is the contract with
       `encodeRanges` in ../src/VMText.tsx — append only, never reorder.
       */
      Prop("rangesEncoded") { (view: VMTextView, value: String?) in
        // Decoded here rather than stored as a string, so the view and the measure path hold the
        // same representation and a spec built either way compares equal.
        view.updateSpec { $0.ranges = vmDecodeRanges(value ?? "") }
      }
    }
  }
}
