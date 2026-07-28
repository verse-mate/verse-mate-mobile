package expo.modules.versematetext

import android.graphics.Color
import android.util.TypedValue
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** JS-facing shape of one decoration range. Mirrors `TextRange` in src/types.ts. */
class RangeRecord : Record {
  @Field var start: Int = 0
  @Field var end: Int = 0
  @Field var underlineStyle: String? = null
  @Field var underlineColor: String? = null
  @Field var underlineThickness: Double? = null
  @Field var backgroundColor: String? = null
  @Field var color: String? = null
  @Field var fontWeight: String? = null
  @Field var fontScale: Double? = null
  @Field var baselineShift: Double? = null
  @Field var interactive: Boolean = false
}

/** JS-facing shape of a measurement request. */
class MeasureRequest : Record {
  @Field var text: String = ""
  @Field var ranges: List<RangeRecord> = emptyList()
  /** Available width in dp. */
  @Field var width: Double = 0.0
  /** Base font size in sp. */
  @Field var fontSize: Double = 14.0
  @Field var fontFamily: String? = null
  @Field var fontWeight: String? = null
  /**
   * Explicit line height in SP, or 0/absent for the font's natural spacing.
   *
   * SP, not dp: React Native scales `lineHeight` by the user's font scale exactly
   * as it scales `fontSize` (`PixelUtil.toPixelFromSP`, since `allowFontScaling`
   * defaults to true). Converting one through SP and the other through raw density
   * silently skews the ratio by 1/fontScale — on a device at 0.85 the intended
   * 2.0x line height rendered at 2.35x, visibly looser than the legacy renderer.
   */
  @Field var lineHeight: Double? = null
  @Field var letterSpacing: Double? = null
  @Field var textAlign: String? = null
}

/**
 * Parse the encoded decoration list.
 *
 * Format: ranges separated by `|`, fields by `~`, in this fixed order:
 *
 *   start ~ end ~ underlineStyle ~ underlineColor ~ underlineThickness ~
 *   backgroundColor ~ color ~ fontWeight ~ fontScale ~ baselineShift ~ interactive
 *
 * An empty field means absent. `~` and `|` cannot appear in any value — the fields are
 * integers, floats, CSS colour strings and a small set of keywords.
 *
 * Records are constructed directly here, so the existing `toRange` conversion is reused
 * unchanged and only the transport differs from before.
 */
private fun decodeRanges(encoded: String?): List<RangeRecord> {
  if (encoded.isNullOrEmpty()) return emptyList()
  val out = ArrayList<RangeRecord>()
  for (chunk in encoded.split('|')) {
    if (chunk.isEmpty()) continue
    val f = chunk.split('~')
    if (f.size < 11) continue
    out.add(
      RangeRecord().apply {
        start = f[0].toIntOrNull() ?: 0
        end = f[1].toIntOrNull() ?: 0
        underlineStyle = f[2].ifEmpty { null }
        underlineColor = f[3].ifEmpty { null }
        underlineThickness = f[4].toDoubleOrNull()
        backgroundColor = f[5].ifEmpty { null }
        color = f[6].ifEmpty { null }
        fontWeight = f[7].ifEmpty { null }
        fontScale = f[8].toDoubleOrNull()
        baselineShift = f[9].toDoubleOrNull()
        interactive = f[10] == "1"
      }
    )
  }
  return out
}

class VMTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VMText")

    /**
     * Measure a block of text and return its height in dp.
     *
     * A **synchronous** function (Expo's `Function`, not `AsyncFunction`) on
     * purpose. JS needs the height during render so it can pass it as an explicit
     * `style.height` and give Yoga exact dimensions on the first layout pass. An
     * async measurement would arrive a frame late, which is the reflow-and-jump
     * behaviour this design exists to avoid.
     *
     * Safe off the main thread: `StaticLayout` is designed for background text
     * measurement, and results are cached by spec, so a re-render of unchanged
     * text costs a map lookup.
     */
    Function("measureHeight") { request: MeasureRequest ->
      val metrics = appContext.reactContext?.resources?.displayMetrics
      val density = metrics?.density ?: 1f
      val heightPx = VMTextLayoutEngine.measureHeight(request.toSpec(density, metrics))
      if (density > 0f) heightPx / density else heightPx.toFloat()
    }

    /**
     * Measure several blocks in one call.
     *
     * A chapter mounts ~20 paragraphs at once. Twenty separate JSI round-trips is
     * twenty crossings; batching them is one. The per-block work is identical and
     * still cache-backed.
     */
    Function("measureHeights") { requests: List<MeasureRequest> ->
      val metrics = appContext.reactContext?.resources?.displayMetrics
      val density = metrics?.density ?: 1f
      requests.map { request ->
        val heightPx = VMTextLayoutEngine.measureHeight(request.toSpec(density, metrics))
        if (density > 0f) heightPx / density else heightPx.toFloat()
      }
    }

    /**
     * Drop cached layouts.
     *
     * Every cached height was measured against the font configuration in force at
     * the time, so a system font-scale change must invalidate them or text
     * measured small gets drawn large and clips.
     */
    Function("clearCache") {
      VMTextLayoutEngine.clearCaches()
    }

    View(VMTextView::class) {
      Events("onPress", "onRangeTap", "onTextLayout", "onSelectionChange")

      // Props arrive individually from the bridge, so each setter folds its value
      // into the pending spec and the view rebuilds its layout once, lazily, on
      // the next draw.
      Prop("text") { view: VMTextView, value: String? ->
        view.updateSpec(view.currentSpec().copy(text = value ?: ""))
      }
      Prop("fontSize") { view: VMTextView, value: Double? ->
        val px = view.spToPx((value ?: 14.0).toFloat())
        view.updateSpec(view.currentSpec().copy(fontSizePx = px))
      }
      Prop("color") { view: VMTextView, value: String? ->
        view.updateSpec(view.currentSpec().copy(color = parseColorOr(value, Color.BLACK)))
      }
      Prop("fontFamily") { view: VMTextView, value: String? ->
        view.updateSpec(view.currentSpec().copy(fontFamily = value))
      }
      Prop("fontWeight") { view: VMTextView, value: String? ->
        view.updateSpec(view.currentSpec().copy(fontWeight = value))
      }
      Prop("lineHeight") { view: VMTextView, value: Double? ->
        // spToPx, matching fontSize — see MeasureRequest.lineHeight for why.
        view.updateSpec(view.currentSpec().copy(lineHeightPx = view.spToPx((value ?: 0.0).toFloat())))
      }
      Prop("letterSpacing") { view: VMTextView, value: Double? ->
        view.updateSpec(
          view.currentSpec().copy(letterSpacingPx = view.dpToPx((value ?: 0.0).toFloat()))
        )
      }
      Prop("textAlign") { view: VMTextView, value: String? ->
        view.updateSpec(view.currentSpec().copy(textAlign = value))
      }
      /**
       * Decorations, as ONE encoded string rather than a list of records.
       *
       * A `List<RangeRecord>` prop crashed:
       *
       *   Cannot set prop 'ranges' on view VMTextView
       *   -> IllegalStateException: Already in the pool!
       *   -> NullPointerException: null cannot be cast to non-null type T of
       *      androidx.core.util.Pools.SimplePool
       *
       * Expo converts an array prop element by element through React Native `Dynamic`
       * objects, which come from a `Pools.SimplePool`, and under rapid mount/unmount that
       * pool gets a double release and a null acquire. The setter then throws, the view
       * never receives its ranges, and the app's error boundary catches it — which is the
       * blank screen seen while stress-testing swipes. It was investigated as a
       * coordinate bug in the pager first; the operator's screenshot of the red box is
       * what actually identified it.
       *
       * A single String touches none of that machinery. See `encodeRanges` in
       * src/VMText.tsx for the format; the two must be changed together.
       */
      Prop("rangesEncoded") { view: VMTextView, value: String? ->
        view.updateSpec(
          view.currentSpec().copy(
            ranges = decodeRanges(value).map { it.toRange(view.density()) }
          )
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------

private fun MeasureRequest.toSpec(
  density: Float,
  metrics: android.util.DisplayMetrics?,
): VMTextSpec {
  val fontSizePx = if (metrics != null) {
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, fontSize.toFloat(), metrics)
  } else {
    fontSize.toFloat() * density
  }
  return VMTextSpec(
    text = text,
    ranges = ranges.map { it.toRange(density) },
    fontSizePx = fontSizePx,
    fontFamily = fontFamily,
    fontWeight = fontWeight,
    // Through SP like fontSize, so the user's font scale applies to both and the
    // requested ratio survives. See the field's doc comment.
    lineHeightPx = if (metrics != null) {
      TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, (lineHeight ?: 0.0).toFloat(), metrics)
    } else {
      ((lineHeight ?: 0.0).toFloat()) * density
    },
    letterSpacingPx = ((letterSpacing ?: 0.0).toFloat()) * density,
    textAlign = textAlign,
    color = Color.BLACK,
    // Round rather than truncate: truncating loses up to a pixel of available
    // width, which is enough to push a word onto the next line and make the
    // measured height one line taller than the drawn text needs.
    widthPx = Math.round(width * density).toInt(),
  )
}

private fun RangeRecord.toRange(density: Float): VMRange = VMRange(
  start = start,
  end = end,
  underlineStyle = underlineStyle,
  underlineColor = parseColorOr(underlineColor, Color.BLACK),
  underlineThicknessDp = (underlineThickness ?: 1.0).toFloat(),
  backgroundColor = parseColorOrNull(backgroundColor),
  textColor = parseColorOrNull(color),
  fontWeight = fontWeight,
  fontScale = (fontScale ?: 1.0).toFloat(),
  baselineShift = (baselineShift ?: 0.0).toFloat(),
  interactive = interactive,
)

/**
 * Parse a colour string from JS, falling back rather than throwing.
 *
 * A malformed colour is a styling mistake, not a reason to fail a render — the
 * text still has to appear. Supports the `rgba(...)` strings the theme uses via
 * the manual path, since `Color.parseColor` only understands `#rrggbb`/`#aarrggbb`
 * and named colours.
 */
internal fun parseColorOr(value: String?, fallback: Int): Int =
  parseColorOrNull(value) ?: fallback

internal fun parseColorOrNull(value: String?): Int? {
  if (value.isNullOrEmpty()) return null
  val trimmed = value.trim()
  rgbaPattern.matchEntire(trimmed)?.let { match ->
    val (r, g, b, a) = match.destructured
    val alpha = a.toFloatOrNull() ?: 1f
    return Color.argb(
      (alpha.coerceIn(0f, 1f) * 255).toInt(),
      r.toInt().coerceIn(0, 255),
      g.toInt().coerceIn(0, 255),
      b.toInt().coerceIn(0, 255),
    )
  }
  return try {
    Color.parseColor(trimmed)
  } catch (_: IllegalArgumentException) {
    null
  }
}

/** `rgb(r,g,b)` / `rgba(r,g,b,a)` with optional whitespace. */
private val rgbaPattern =
  Regex("""rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)""")

private fun VMTextView.density(): Float = resources.displayMetrics.density

internal fun VMTextView.dpToPx(dp: Float): Float = dp * resources.displayMetrics.density

internal fun VMTextView.spToPx(sp: Float): Float =
  TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, resources.displayMetrics)
