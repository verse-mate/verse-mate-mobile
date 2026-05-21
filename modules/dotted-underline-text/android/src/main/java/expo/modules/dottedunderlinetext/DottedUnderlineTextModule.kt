package expo.modules.dottedunderlinetext

import android.graphics.Color
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * Range record forwarded from JS via the `ranges` prop. The Expo Records
 * machinery deserializes plain JS objects into this type automatically when
 * referenced as a Prop value type.
 */
/** Parse a color string the JS side might send. Returns `fallback` on
 *  failure (logs no error — we don't want a typo'd hex to crash render). */
private fun parseColorOr(value: String?, fallback: Int): Int {
  if (value.isNullOrEmpty()) return fallback
  return try { Color.parseColor(value) } catch (_: IllegalArgumentException) { fallback }
}

/** Returns null instead of a fallback color so callers can branch on
 *  "this range has no per-range background/textColor at all". */
private fun parseColorOrNull(value: String?): Int? {
  if (value.isNullOrEmpty()) return null
  return try { Color.parseColor(value) } catch (_: IllegalArgumentException) { null }
}

class RangeRecord : Record {
  @Field var start: Int = 0
  @Field var end: Int = 0
  @Field var style: String? = null
  @Field var color: String? = null
  @Field var thickness: Double? = null
  @Field var backgroundColor: String? = null
  @Field var fontWeight: String? = null
  @Field var textColor: String? = null
}

class DottedUnderlineTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DottedUnderlineText")

    View(DottedUnderlineTextView::class) {
      Events("onPress", "onRangeTap")

      Prop("text") { view: DottedUnderlineTextView, value: String? ->
        view.setText(value ?: "")
      }
      Prop("fontSize") { view: DottedUnderlineTextView, value: Double? ->
        if (value != null) view.setFontSize(value.toFloat())
      }
      Prop("color") { view: DottedUnderlineTextView, value: Int? ->
        if (value != null) view.setTextColor(value)
      }
      Prop("fontFamily") { view: DottedUnderlineTextView, value: String? ->
        view.setFontFamily(value)
      }
      Prop("fontWeight") { view: DottedUnderlineTextView, value: String? ->
        view.setFontWeight(value)
      }
      Prop("letterSpacing") { view: DottedUnderlineTextView, value: Double? ->
        if (value != null) view.setLetterSpacing(value.toFloat())
      }
      Prop("lineHeight") { view: DottedUnderlineTextView, value: Double? ->
        if (value != null) view.setLineHeightPx(value.toFloat())
      }
      Prop("textAlign") { view: DottedUnderlineTextView, value: String? ->
        view.setTextAlign(value)
      }
      Prop("underlineColor") { view: DottedUnderlineTextView, value: Int? ->
        if (value != null) view.setUnderlineColor(value)
      }
      Prop("underlineStyle") { view: DottedUnderlineTextView, value: String? ->
        view.setUnderlineStyle(value ?: "dotted")
      }
      Prop("underlineThickness") { view: DottedUnderlineTextView, value: Double? ->
        view.setUnderlineThickness((value ?: 1.0).toFloat())
      }
      Prop("ranges") { view: DottedUnderlineTextView, value: List<RangeRecord>? ->
        if (value == null) {
          view.setRanges(null)
        } else {
          val descriptors = value.map { r ->
            val parsedUnderlineColor = parseColorOr(r.color, Color.BLACK)
            UnderlineDescriptor(
              start = r.start,
              end = r.end,
              color = parsedUnderlineColor,
              thicknessDp = (r.thickness ?: 1.0).toFloat(),
              hasUnderline = !r.style.isNullOrEmpty(),
              isDotted = (r.style ?: "dotted") == "dotted",
              backgroundColor = parseColorOrNull(r.backgroundColor),
              fontWeight = r.fontWeight,
              textColor = parseColorOrNull(r.textColor)
            )
          }
          view.setRanges(descriptors)
        }
      }
      Prop("selectable") { view: DottedUnderlineTextView, value: Boolean? ->
        view.setSelectableText(value ?: true)
      }
      Prop("accessibilityLabel") { view: DottedUnderlineTextView, value: String? ->
        view.setAccessibilityLabelText(value)
      }
    }
  }
}
