package expo.modules.dottedunderlinetext

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Typeface
import android.text.method.LinkMovementMethod
import android.util.TypedValue
import android.view.MotionEvent
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.appcompat.widget.AppCompatTextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * One range of decoration to draw on top of the text.
 *
 * `start`/`end` are character indices into the view's text (end exclusive,
 * matching JS String.slice).
 */
data class UnderlineDescriptor(
  val start: Int,
  val end: Int,
  val color: Int,
  val thicknessDp: Float,
  val isDotted: Boolean
)

/**
 * Custom TextView that draws CSS-style dotted (or solid) underlines beneath
 * the text. Two modes:
 *  - Whole-text mode (default): one underline for the entire text, using the
 *    `underlineColor`/`underlineStyle`/`underlineThickness` props.
 *  - Per-range mode: when the `ranges` prop is set, only the specified
 *    character ranges are underlined (each with their own color/style/
 *    thickness). This lets HighlightedText render a single verse as one
 *    Spannable while still showing per-word lexicon underlines.
 *
 * We do the drawing in `onDraw` rather than via UnderlineSpan because
 * Android's UnderlineSpan is always solid and gives no control over color
 * or thickness. Drawing manually means we can produce true dots with
 * `DashPathEffect` and color/thickness per range.
 */
@SuppressLint("AppCompatCustomView", "ViewConstructor")
class DottedUnderlineTextView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  // RN doesn't always re-measure ExpoView children when the underlying text
  // changes; opting into Android layout makes the inner TextView re-wrap.
  override val shouldUseAndroidLayout: Boolean = true

  internal val onPress by EventDispatcher<Map<String, Any?>>()
  internal val onRangeTap by EventDispatcher<Map<String, Any?>>()

  private val textView: InnerTextView = InnerTextView(context).apply {
    // Match RN <Text> defaults as closely as possible.
    setTextColor(Color.BLACK)
    includeFontPadding = false
    isClickable = true
    isLongClickable = true
    movementMethod = LinkMovementMethod.getInstance()
  }

  init {
    // Fill the ExpoView (which is sized by Yoga) horizontally so the inner
    // TextView wraps at the same width RN gave us.
    addView(
      textView,
      LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      )
    )
  }

  // ---- Props (called by the Module's Prop bindings) ---------------------

  fun setText(value: String) {
    textView.text = value
    textView.requestLayout()
    textView.invalidate()
  }

  fun setFontSize(sizeSp: Float) {
    textView.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
  }

  fun setTextColor(colorInt: Int) {
    textView.setTextColor(colorInt)
  }

  fun setFontFamily(family: String?) {
    val tf = if (family.isNullOrEmpty()) Typeface.DEFAULT else Typeface.create(family, Typeface.NORMAL)
    textView.typeface = tf
  }

  fun setFontWeight(weight: String?) {
    val isBold = weight == "bold" || (weight?.toIntOrNull() ?: 400) >= 600
    val base = textView.typeface ?: Typeface.DEFAULT
    textView.typeface = if (isBold) Typeface.create(base, Typeface.BOLD) else Typeface.create(base, Typeface.NORMAL)
  }

  fun setLetterSpacing(value: Float) {
    // RN passes letterSpacing in px-equivalent; TextView uses em units.
    val fontPx = textView.textSize.takeIf { it > 0 } ?: 1f
    textView.letterSpacing = value / fontPx
  }

  fun setLineHeightPx(value: Float) {
    textView.setLineSpacing(0f, 1f) // reset multiplier
    val density = resources.displayMetrics.density
    textView.lineHeight = (value * density).toInt().coerceAtLeast(1)
  }

  fun setTextAlign(value: String?) {
    textView.textAlignment = when (value) {
      "center" -> android.view.View.TEXT_ALIGNMENT_CENTER
      "right" -> android.view.View.TEXT_ALIGNMENT_VIEW_END
      "left" -> android.view.View.TEXT_ALIGNMENT_VIEW_START
      "justify" -> android.view.View.TEXT_ALIGNMENT_INHERIT
      else -> android.view.View.TEXT_ALIGNMENT_INHERIT
    }
  }

  fun setUnderlineColor(colorInt: Int) {
    textView.underlineColor = colorInt
    textView.invalidate()
  }

  fun setUnderlineStyle(style: String) {
    textView.underlineStyle = style
    textView.invalidate()
  }

  fun setUnderlineThickness(thicknessDp: Float) {
    textView.underlineThicknessDp = thicknessDp
    textView.invalidate()
  }

  fun setRanges(ranges: List<UnderlineDescriptor>?) {
    textView.ranges = ranges
    textView.invalidate()
  }

  fun setSelectableText(selectable: Boolean) {
    textView.setTextIsSelectable(selectable)
  }

  fun setAccessibilityLabelText(label: String?) {
    textView.contentDescription = label
  }

  // -----------------------------------------------------------------------

  /**
   * Inner AppCompatTextView that does the actual drawing. We separate this
   * from the ExpoView wrapper so the wrapper can host RN layout / event
   * plumbing while the TextView focuses on text + custom underline rendering.
   */
  @SuppressLint("AppCompatCustomView", "ViewConstructor")
  private inner class InnerTextView(ctx: Context) : AppCompatTextView(ctx) {
    var underlineColor: Int = Color.BLACK
    var underlineStyle: String = "dotted"
    var underlineThicknessDp: Float = 1f
    var ranges: List<UnderlineDescriptor>? = null

    private val underlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
    }

    // Touch tracking for per-range tap detection. ACTION_DOWN coords vs.
    // ACTION_UP coords let us distinguish a tap (no movement, no long-press)
    // from a drag/long-press for selection. Using touchSlop as the threshold.
    private var downX: Float = 0f
    private var downY: Float = 0f
    private var downTimeMs: Long = 0L

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)

      val layout = layout ?: return
      val density = resources.displayMetrics.density

      val rs = ranges
      if (rs != null) {
        // Per-range mode: each range drawn independently.
        for (r in rs) {
          drawRange(canvas, layout, density, r)
        }
      } else {
        // Whole-text mode: single underline across each line.
        drawWholeText(canvas, layout, density)
      }
    }

    private fun drawWholeText(canvas: Canvas, layout: android.text.Layout, density: Float) {
      val strokePx = underlineThicknessDp * density
      underlinePaint.color = underlineColor
      underlinePaint.strokeWidth = strokePx
      underlinePaint.pathEffect = if (underlineStyle == "dotted") {
        val seg = 2f * density
        DashPathEffect(floatArrayOf(seg, seg), 0f)
      } else {
        null
      }

      // Clear descender area below the baseline before drawing the line.
      val offsetPx = 3f * density

      for (i in 0 until layout.lineCount) {
        val baseline = layout.getLineBaseline(i).toFloat()
        val left = layout.getLineLeft(i)
        val right = layout.getLineRight(i)
        val y = baseline + offsetPx

        // NB: dotted dashes look best when drawn left-to-right; for RTL lines
        // (Arabic / Hebrew) the visual order is still left-to-right at the
        // pixel level, so this works without extra logic.
        canvas.drawLine(left + paddingLeft, y, right + paddingLeft, y, underlinePaint)
      }
    }

    private fun drawRange(
      canvas: Canvas,
      layout: android.text.Layout,
      density: Float,
      r: UnderlineDescriptor
    ) {
      val textLen = (text?.length ?: 0)
      if (textLen == 0) return
      val safeStart = r.start.coerceIn(0, textLen)
      val safeEnd = r.end.coerceIn(safeStart, textLen)
      if (safeEnd <= safeStart) return

      val strokePx = r.thicknessDp * density
      underlinePaint.color = r.color
      underlinePaint.strokeWidth = strokePx
      underlinePaint.pathEffect = if (r.isDotted) {
        val seg = 2f * density
        DashPathEffect(floatArrayOf(seg, seg), 0f)
      } else {
        null
      }

      val offsetPx = 3f * density
      // Walk the lines the range spans. For each line, the visible portion
      // of the range is [max(rangeStart, lineStart) .. min(rangeEnd, lineEnd)].
      val startLine = layout.getLineForOffset(safeStart)
      val endLine = layout.getLineForOffset(safeEnd)
      for (line in startLine..endLine) {
        val lineStart = layout.getLineStart(line)
        val lineEnd = layout.getLineEnd(line)
        val from = maxOf(safeStart, lineStart)
        // getLineEnd includes trailing whitespace + the newline; cap at
        // safeEnd so we don't underline characters past the range.
        val to = minOf(safeEnd, lineEnd)
        if (to <= from) continue

        val xFrom = layout.getPrimaryHorizontal(from)
        // For the last position on a line, getPrimaryHorizontal returns the
        // x at the END of the character only when `to` is < lineEnd; if
        // `to == lineEnd` we want the right edge of the last char, which
        // is also the x for position `to`.
        val xTo = layout.getPrimaryHorizontal(to)
        val baseline = layout.getLineBaseline(line).toFloat()
        val y = baseline + offsetPx
        canvas.drawLine(
          xFrom + paddingLeft,
          y,
          xTo + paddingLeft,
          y,
          underlinePaint
        )
      }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
      // Capture down position so ACTION_UP can decide tap-vs-drag and which
      // range was hit. We still call super so selection / link movement
      // gestures keep working.
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.x
          downY = event.y
          downTimeMs = event.eventTime
        }
        MotionEvent.ACTION_UP -> {
          val dx = event.x - downX
          val dy = event.y - downY
          val touchSlop = android.view.ViewConfiguration.get(context).scaledTouchSlop
          val pressTimeout = android.view.ViewConfiguration.getLongPressTimeout()
          val isTap = dx * dx + dy * dy <= touchSlop * touchSlop &&
            (event.eventTime - downTimeMs) < pressTimeout
          if (isTap) {
            val hitIndex = hitTestRangeIndex(event.x, event.y)
            if (hitIndex >= 0) {
              this@DottedUnderlineTextView.onRangeTap(mapOf("index" to hitIndex))
              // Consume the tap when it lands on a range so the outer
              // onPress / underlying selection toggle doesn't also fire.
              super.onTouchEvent(event)
              return true
            }
            // Fall through to default behaviour, then forward outer onPress.
            val handled = super.onTouchEvent(event)
            this@DottedUnderlineTextView.onPress(emptyMap())
            return handled
          }
        }
      }
      return super.onTouchEvent(event)
    }

    /**
     * Convert a touch (x, y) into the index of the matching range, or -1
     * if the touch did not land inside any range.
     */
    private fun hitTestRangeIndex(x: Float, y: Float): Int {
      val rs = ranges ?: return -1
      val layout = layout ?: return -1
      val line = layout.getLineForVertical(y.toInt())
      if (line < 0) return -1
      val xInLayout = x - paddingLeft
      // getOffsetForHorizontal can return positions outside the actual
      // visible characters on lines with trailing space; getLineEnd-1 gives
      // a safer upper bound for ASCII text. For Bible content this is fine.
      val offset = layout.getOffsetForHorizontal(line, xInLayout)
      for (i in rs.indices) {
        val r = rs[i]
        if (offset in r.start until r.end) {
          return i
        }
      }
      return -1
    }

    override fun performClick(): Boolean {
      super.performClick()
      return true
    }
  }

  // Forward parent click through to onPress dispatcher (set in init).
  override fun performClick(): Boolean {
    return super.performClick()
  }
}
