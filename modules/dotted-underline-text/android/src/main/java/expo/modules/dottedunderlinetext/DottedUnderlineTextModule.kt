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
class RangeRecord : Record {
  @Field var start: Int = 0
  @Field var end: Int = 0
  @Field var style: String? = null
  @Field var color: String? = null
  @Field var thickness: Double? = null
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
            val parsedColor = try {
              if (!r.color.isNullOrEmpty()) Color.parseColor(r.color) else Color.BLACK
            } catch (_: IllegalArgumentException) {
              Color.BLACK
            }
            UnderlineDescriptor(
              start = r.start,
              end = r.end,
              color = parsedColor,
              thicknessDp = (r.thickness ?: 1.0).toFloat(),
              isDotted = (r.style ?: "dotted") == "dotted"
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
