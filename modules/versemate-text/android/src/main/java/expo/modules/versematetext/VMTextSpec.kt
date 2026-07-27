package expo.modules.versematetext

import android.graphics.Color
import android.text.Spannable
import android.text.SpannableString
import android.text.Spanned
import android.graphics.Paint
import android.text.TextPaint
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.LineHeightSpan
import android.text.style.MetricAffectingSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.graphics.Typeface

/**
 * One decorated character range, mirroring the `TextRange` type in
 * `modules/versemate-text/src/types.ts`.
 *
 * `start` is inclusive and `end` exclusive, matching `String.slice`, so the
 * offsets JS computes need no translation.
 */
data class VMRange(
  val start: Int,
  val end: Int,
  /** null when this range draws no underline. */
  val underlineStyle: String?,
  val underlineColor: Int,
  val underlineThicknessDp: Float,
  val backgroundColor: Int?,
  val textColor: Int?,
  val fontWeight: String?,
  /** Font size multiplier relative to the base size. 1.0 = unchanged. */
  val fontScale: Float,
  /** Baseline offset as a multiple of the base font size; positive raises. */
  val baselineShift: Float,
  val interactive: Boolean,
)

/**
 * Everything needed to lay out one block of text.
 *
 * Deliberately a value type with structural equality: it doubles as the
 * measurement cache key, so adding a field that affects layout automatically
 * participates in cache invalidation. A field that affects layout but is NOT in
 * here would silently serve stale heights and clip text.
 *
 * Sizes are in pixels, already resolved from dp/sp by the caller, because the
 * JS side works in density-independent units and the conversion should happen
 * once at the boundary rather than in both the measure and draw paths.
 */
data class VMTextSpec(
  val text: String,
  val ranges: List<VMRange>,
  val fontSizePx: Float,
  val fontFamily: String?,
  val fontWeight: String?,
  /** Explicit line height in px, or 0 to use the font's natural spacing. */
  val lineHeightPx: Float,
  val letterSpacingPx: Float,
  val textAlign: String?,
  val color: Int,
  /** Available width in px. Layout wraps to this. */
  val widthPx: Int,
) {
  companion object {
    val EMPTY = VMTextSpec(
      text = "",
      ranges = emptyList(),
      fontSizePx = 14f,
      fontFamily = null,
      fontWeight = null,
      lineHeightPx = 0f,
      letterSpacingPx = 0f,
      textAlign = null,
      color = Color.BLACK,
      widthPx = 0,
    )
  }
}

/**
 * Raises or lowers text by a fraction of its own size.
 *
 * Android's `SuperscriptSpan` shifts by a fixed platform-chosen amount and also
 * does not scale the glyphs, so a verse-number superscript built from it drifts
 * as the user changes their reader font size. Applying a proportional shift keeps
 * the offset visually constant at every font size, and matches how the same
 * range is expressed on iOS (`NSBaselineOffset`), so the two platforms agree.
 *
 * `MetricAffectingSpan` rather than `CharacterStyle` because a baseline shift
 * changes line metrics — getting this wrong means the line box is too short and
 * the raised glyphs clip against the line above.
 */
private class ProportionalBaselineShiftSpan(private val shift: Float) : MetricAffectingSpan() {
  override fun updateDrawState(paint: TextPaint) = apply(paint)
  override fun updateMeasureState(paint: TextPaint) = apply(paint)

  private fun apply(paint: TextPaint) {
    // Android's baselineShift is in px and positive means DOWN, so raising text
    // needs a negative value.
    paint.baselineShift -= (paint.textSize * shift).toInt()
  }
}

/** Build the base paint. Shared by measurement and drawing so they cannot diverge. */
fun VMTextSpec.buildPaint(): TextPaint {
  val paint = TextPaint(TextPaint.ANTI_ALIAS_FLAG)
  paint.textSize = fontSizePx
  paint.color = color
  paint.typeface = resolveTypeface(fontFamily, fontWeight)
  // Android expects letterSpacing in em; JS supplies px.
  paint.letterSpacing = if (fontSizePx > 0f) letterSpacingPx / fontSizePx else 0f
  return paint
}

/**
 * Forces every line to an exact total height, the way React Native's own
 * `CustomLineHeightSpan` does.
 *
 * `setLineSpacing(add, mult)` was the first approach and it over-spaced: it ADDS
 * leading on top of the font's natural line height, and the arithmetic to back a
 * target height out of that has to agree exactly between the measuring
 * `StaticLayout` and the drawing `TextView`. It did not, and the native reader
 * rendered visibly looser than the legacy one — enough that a screenful showed one
 * fewer verse.
 *
 * A span is the right home for this because it travels WITH the text, so the
 * measurement layout and the view cannot disagree by construction. Hand-written
 * rather than using `LineHeightSpan.Standard`, which needs API 29 while this
 * module supports 24.
 *
 * The extra space is distributed proportionally above and below, as the platform
 * does, so text stays optically centred in its line box instead of riding the top.
 */
private class ExactLineHeightSpan(private val heightPx: Int) : LineHeightSpan {
  override fun chooseHeight(
    text: CharSequence?,
    start: Int,
    end: Int,
    spanstartv: Int,
    lineHeight: Int,
    fm: Paint.FontMetricsInt,
  ) {
    val original = fm.descent - fm.ascent
    if (original <= 0) return
    val ratio = heightPx.toFloat() / original
    fm.descent = Math.round(fm.descent * ratio)
    fm.ascent = fm.descent - heightPx
  }
}

/**
 * Build the styled text.
 *
 * Underlines are deliberately NOT spans. Android's `UnderlineSpan` is always
 * solid, always the text colour, and always one device pixel — none of which can
 * express the design (hairline dotted gold, two tiers, fractional thickness).
 * They are drawn manually in `VMTextView.onDraw` instead. Everything else maps
 * to a span so the platform handles it during layout.
 */
fun VMTextSpec.buildSpannable(): Spannable {
  val spannable = SpannableString(text)
  val length = text.length

  // Applied across the whole string so every line gets the exact requested height
  // in both the measurement layout and the view.
  if (lineHeightPx > 0f && length > 0) {
    spannable.setSpan(
      ExactLineHeightSpan(Math.round(lineHeightPx)),
      0,
      length,
      Spanned.SPAN_INCLUSIVE_INCLUSIVE,
    )
  }

  for (range in ranges) {
    val start = range.start.coerceIn(0, length)
    val end = range.end.coerceIn(start, length)
    if (end <= start) continue
    val flag = Spanned.SPAN_EXCLUSIVE_EXCLUSIVE

    range.backgroundColor?.let { spannable.setSpan(BackgroundColorSpan(it), start, end, flag) }
    range.textColor?.let { spannable.setSpan(ForegroundColorSpan(it), start, end, flag) }
    if (isBoldWeight(range.fontWeight)) {
      spannable.setSpan(StyleSpan(Typeface.BOLD), start, end, flag)
    }
    if (range.fontScale != 1f && range.fontScale > 0f) {
      spannable.setSpan(RelativeSizeSpan(range.fontScale), start, end, flag)
    }
    if (range.baselineShift != 0f) {
      spannable.setSpan(ProportionalBaselineShiftSpan(range.baselineShift), start, end, flag)
    }
  }
  return spannable
}

/**
 * Map a CSS weight to Android's coarse bold flag.
 *
 * `StyleSpan` only offers NORMAL/BOLD/ITALIC/BOLD_ITALIC, so anything at 600 or
 * above rounds to bold. Variable-weight fonts would need `Typeface.create(weight)`
 * on API 28+; not worth it until a design actually asks for 500 or 800.
 */
fun isBoldWeight(value: String?): Boolean {
  if (value == null) return false
  if (value == "bold") return true
  return (value.toIntOrNull() ?: 400) >= 600
}

private fun resolveTypeface(family: String?, weight: String?): Typeface {
  val base = if (family.isNullOrEmpty()) Typeface.DEFAULT else Typeface.create(family, Typeface.NORMAL)
  return if (isBoldWeight(weight)) Typeface.create(base, Typeface.BOLD) else base
}
