package expo.modules.versematetext

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.text.StaticLayout
import android.view.MotionEvent
import android.view.ViewConfiguration
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * Draws one block of decorated text and reports interaction by character offset.
 *
 * ## Why this does not fight Yoga
 *
 * The view claims exactly the size Yoga gives it and never asks to change it. JS
 * has already called `VMText.measureHeight(...)` synchronously and passed the
 * result as an explicit `style.height`, so the first layout pass is already
 * correct. That is the whole reason for the sync-measure design: the previous
 * approach — let the view measure itself and push a size back through
 * `shadowNodeProxy.setViewSize` — costs a reflow frame per mount, which on a
 * chapter of ~20 paragraphs is a visible content jump.
 *
 * Consequently there is no `onMeasure` override, no `shouldUseAndroidLayout`, and
 * no state push. If the drawn text does not fit, the bug is a mismatch between
 * what `VMTextLayoutEngine` measured and what it drew — and since both come from
 * the same spec through the same builder, that should be impossible by
 * construction rather than by care.
 *
 * ## Why underlines are drawn rather than spanned
 *
 * Android's `UnderlineSpan` is always solid, always the text colour, and always
 * one pixel. RN's `textDecorationStyle` and `textDecorationColor` are outright
 * no-ops on Android (verified against RN 0.81.5's `TextAttributeProps.java`).
 * Neither can express a hairline dotted gold underline. `DashPathEffect` in
 * `onDraw` can, which is the feature this whole module unlocks.
 */
@SuppressLint("ViewConstructor")
class VMTextView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  private val onPress by EventDispatcher<Map<String, Any?>>()
  private val onRangeTap by EventDispatcher<Map<String, Any?>>()
  private val onTextLayout by EventDispatcher<Map<String, Any?>>()

  private var spec: VMTextSpec = VMTextSpec.EMPTY
  private var layout: StaticLayout? = null

  /** Guards against re-emitting identical line geometry on every redraw. */
  private var lastReportedLayoutKey: String? = null

  private val underlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
  }

  private val density: Float get() = resources.displayMetrics.density

  init {
    // The text is drawn by this view directly, so no child views and no
    // background — both would just add a compositing layer per paragraph.
    setWillNotDraw(false)
  }

  /**
   * Replace the spec.
   *
   * The layout is rebuilt lazily on the next draw rather than here: props arrive
   * one at a time from the bridge, so building on every setter would lay the
   * same text out once per prop.
   */
  fun updateSpec(next: VMTextSpec) {
    if (next == spec) return
    spec = next
    layout = null
    invalidate()
  }

  fun currentSpec(): VMTextSpec = spec

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    // Yoga owns the width; the spec's own widthPx is what JS measured against.
    // A disagreement means JS measured at a different width than it laid out at,
    // which would clip — so re-lay-out at the real width rather than trust it.
    if (w > 0 && w != spec.widthPx) {
      spec = spec.copy(widthPx = w)
      layout = null
    }
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val resolved = layout ?: VMTextLayoutEngine.layoutFor(spec)?.also { layout = it } ?: return

    resolved.draw(canvas)
    for (range in spec.ranges) {
      drawUnderline(canvas, resolved, range)
    }
    reportLayoutIfChanged(resolved)
  }

  /**
   * Draw one range's underline, segment by line.
   *
   * A range that wraps across lines needs one stroke per line, clipped to the
   * part of that line the range actually covers — otherwise the underline runs
   * to the line's full width.
   */
  private fun drawUnderline(canvas: Canvas, layout: StaticLayout, range: VMRange) {
    val style = range.underlineStyle ?: return
    val length = spec.text.length
    val start = range.start.coerceIn(0, length)
    val end = range.end.coerceIn(start, length)
    if (end <= start) return

    underlinePaint.color = range.underlineColor
    underlinePaint.strokeWidth = range.underlineThicknessDp * density
    underlinePaint.pathEffect = when (style) {
      "dotted" -> {
        // Equal dot and gap at 2dp reads as a dotted rule at typical body sizes;
        // tighter than that and it looks solid on a high-density screen.
        val segment = 2f * density
        DashPathEffect(floatArrayOf(segment, segment), 0f)
      }
      "dashed" -> {
        val dash = 4f * density
        DashPathEffect(floatArrayOf(dash, dash * 0.75f), 0f)
      }
      else -> null
    }

    // Sit the line below the baseline, clear of descenders.
    val offset = UNDERLINE_BASELINE_OFFSET_DP * density
    val firstLine = layout.getLineForOffset(start)
    val lastLine = layout.getLineForOffset(end)

    for (line in firstLine..lastLine) {
      val from = maxOf(start, layout.getLineStart(line))
      // getLineEnd includes trailing whitespace and the newline, so cap at the
      // range end or the underline extends past the last character.
      val to = minOf(end, layout.getLineEnd(line))
      if (to <= from) continue

      val x1 = layout.getPrimaryHorizontal(from)
      val x2 = layout.getPrimaryHorizontal(to)
      val y = layout.getLineBaseline(line) + offset
      // RTL runs report a larger start than end; normalise so the stroke is
      // drawn left-to-right and the dash phase stays consistent.
      canvas.drawLine(minOf(x1, x2), y, maxOf(x1, x2), y, underlinePaint)
    }
  }

  /**
   * Emit line geometry, so JS can anchor a popover to a tapped word without a
   * round-trip through `onTextLayout` on an RN `<Text>`.
   */
  private fun reportLayoutIfChanged(layout: StaticLayout) {
    val key = "${spec.text.length}:${spec.widthPx}:${layout.lineCount}:${layout.height}"
    if (key == lastReportedLayoutKey) return
    lastReportedLayoutKey = key

    val lines = (0 until layout.lineCount).map { line ->
      val top = layout.getLineTop(line)
      val baseline = layout.getLineBaseline(line)
      mapOf(
        "start" to layout.getLineStart(line),
        "end" to layout.getLineEnd(line),
        "x" to (layout.getLineLeft(line) / density),
        "y" to (top / density),
        "width" to ((layout.getLineRight(line) - layout.getLineLeft(line)) / density),
        "height" to ((layout.getLineBottom(line) - top) / density),
        "baseline" to ((baseline - top) / density),
      )
    }
    onTextLayout(mapOf("lines" to lines))
  }

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  private var downX = 0f
  private var downY = 0f
  private var downTime = 0L

  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = event.x
        downY = event.y
        downTime = event.eventTime
        // Claim the gesture so ACTION_UP arrives here. The parent ScrollView can
        // still steal it via onInterceptTouchEvent once the finger moves, which
        // is what keeps scrolling from being blocked by tappable text.
        return true
      }
      MotionEvent.ACTION_UP -> {
        val dx = event.x - downX
        val dy = event.y - downY
        val slop = ViewConfiguration.get(context).scaledTouchSlop
        val moved = dx * dx + dy * dy > slop * slop
        val longPress = event.eventTime - downTime >= ViewConfiguration.getLongPressTimeout()
        // A drag is a scroll and a long press is a selection gesture; neither is
        // a tap, and treating either as one makes the reader feel like it fires
        // links while you scroll.
        if (!moved && !longPress) {
          dispatchTap(event.x, event.y)
        }
        return true
      }
    }
    return super.onTouchEvent(event)
  }

  private fun dispatchTap(x: Float, y: Float) {
    val offset = charOffsetAt(x, y)
    // Later ranges paint over earlier ones, so the topmost interactive range at
    // this offset is the one the user sees and therefore the one they meant.
    val hitIndex = spec.ranges.indexOfLast {
      it.interactive && offset >= it.start && offset < it.end
    }
    if (hitIndex >= 0) {
      onRangeTap(mapOf("index" to hitIndex, "charOffset" to offset))
    } else {
      onPress(mapOf("charOffset" to offset, "x" to (x / density), "y" to (y / density)))
    }
  }

  /** Character offset nearest a point, or 0 when there is no layout yet. */
  private fun charOffsetAt(x: Float, y: Float): Int {
    val resolved = layout ?: return 0
    val line = resolved.getLineForVertical(y.toInt())
    return resolved.getOffsetForHorizontal(line, x)
  }

  companion object {
    /**
     * Gap between the text baseline and the underline, in dp.
     *
     * Chosen to clear descenders (g, y, p) at body sizes without the line
     * detaching from the word.
     */
    private const val UNDERLINE_BASELINE_OFFSET_DP = 3f
  }
}
