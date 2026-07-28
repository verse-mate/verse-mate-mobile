package expo.modules.versematetext

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.text.Layout
import android.text.TextPaint
import android.util.TypedValue
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.appcompat.widget.AppCompatTextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * Renders one block of decorated text and reports interaction by character offset.
 *
 * ## Why an inner TextView rather than drawing on a bare View
 *
 * The first version drew a `StaticLayout` straight onto the `ExpoView`. That is
 * cheaper and gives complete control, but it silently gives up **system text
 * selection** — no handles, no magnifier, no floating Copy / Select-all menu, and
 * no accessibility text traversal. The operator confirmed selection and copy ARE
 * used on verses, so that trade is not available.
 *
 * A selectable `AppCompatTextView` gets all of that from the platform, and nothing
 * is lost on the decoration side: the custom underlines are still drawn in
 * `onDraw`. Android's `UnderlineSpan` is always solid, always the text colour and
 * always one pixel, and RN's `textDecorationStyle`/`textDecorationColor` are
 * outright no-ops on Android — so a drawn line remains the only way to get a
 * hairline dotted gold underline, which is the feature this module exists for.
 *
 * ## Why this does not fight Yoga
 *
 * The view claims exactly the size Yoga gives it and never asks to change it. JS
 * has already called `VMText.measureHeight(...)` synchronously and passed the
 * result as an explicit `style.height`, so the first layout pass is already
 * correct — no reflow frame, which on a chapter of ~20 paragraphs would be a
 * visible content jump.
 *
 * That only holds while the inner TextView lays text out **identically** to the
 * `StaticLayout` used for measurement, so `configureForMeasurementParity` pins
 * every parameter that affects line breaking. Phase 2's exit criterion — pixel
 * comparison against an RN `<Text>` at several font scales and both orientations
 * — is the check that catches any drift.
 */
@SuppressLint("ViewConstructor")
class VMTextView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  private val onPress by EventDispatcher<Map<String, Any?>>()
  private val onRangeTap by EventDispatcher<Map<String, Any?>>()
  private val onTextLayout by EventDispatcher<Map<String, Any?>>()
  private val onSelectionChange by EventDispatcher<Map<String, Any?>>()

  private var spec: VMTextSpec = VMTextSpec.EMPTY

  /**
   * False until construction finishes. Events must not be dispatched before then.
   *
   * `setTextIsSelectable(true)` in the inner view's `init` synchronously fires
   * `onSelectionChanged`, and the inner view is created by an outer property
   * initializer — so that callback runs while `VMTextView`'s own `by
   * EventDispatcher` delegates are still uninitialised. Touching one there
   * recursed until the stack blew:
   *
   *   Couldn't create view of type class expo.modules.versematetext.VMTextView
   *   java.lang.reflect.InvocationTargetException
   *   Caused by: java.lang.StackOverflowError: stack size 8188KB
   *     at VMTextView$SelectableTextView.onSelectionChanged(VMTextView.kt:274)
   *     at VMTextView$SelectableTextView.<init>(VMTextView.kt:127)
   *     at VMTextView.<init>(VMTextView.kt:62)
   *
   * Every view creation failed, so the reader rendered its chrome and no verse
   * text at all. Declared before `textView` to make the ordering explicit, though
   * a Boolean field defaults to false regardless.
   */
  private var readyToDispatch = false

  private val textView = SelectableTextView(context)

  private val density: Float get() = resources.displayMetrics.density

  init {
    addView(
      textView,
      LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    )
    readyToDispatch = true
  }

  /**
   * Replace the spec.
   *
   * Props arrive from the bridge one at a time, so this runs several times per
   * update. The equality check short-circuits the common case of a prop being
   * re-sent unchanged, which would otherwise re-lay-out the text once per prop.
   */
  fun updateSpec(next: VMTextSpec) {
    if (next == spec) return
    spec = next
    textView.applySpec(next)
  }

  fun currentSpec(): VMTextSpec = spec

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    // Yoga owns the width. If it disagrees with the width JS measured against,
    // the measured height describes different line breaking than what will be
    // drawn — which clips. Re-apply at the real width rather than trust it.
    if (w > 0 && w != spec.widthPx) {
      spec = spec.copy(widthPx = w)
      textView.applySpec(spec)
    }
  }

  // -------------------------------------------------------------------------

  /**
   * The TextView that actually renders, selects, and draws decorations.
   *
   * An inner class so it can reach the outer view's event dispatchers without
   * threading callbacks through a constructor.
   */
  @SuppressLint("ViewConstructor")
  private inner class SelectableTextView(context: Context) : AppCompatTextView(context) {

    private val underlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
    }

    /** Last reported layout signature, so identical geometry is not re-emitted. */
    private var lastLayoutKey: String? = null

    private var downX = 0f
    private var downY = 0f
    private var downTime = 0L
    /** Whether this gesture's long-press has already been cancelled as a swipe. */
    private var longPressCancelled = false

    init {
      configureForMeasurementParity()
      // Selection handles, magnifier, and the floating Copy / Select-all menu.
      setTextIsSelectable(true)
      // The text fills the view; padding would shift it out of alignment with the
      // width its height was measured against.
      setPadding(0, 0, 0, 0)
    }

    /**
     * Pin every layout parameter that `VMTextLayoutEngine` also pins.
     *
     * These are not stylistic choices — each one changes where lines break, and a
     * mismatch against the measurement `StaticLayout` produces clipped or gapped
     * text. They also match how React Native lays out its own `<Text>` on Android,
     * so native paragraphs and surrounding RN text cannot visually drift.
     */
    private fun configureForMeasurementParity() {
      includeFontPadding = false
      breakStrategy = Layout.BREAK_STRATEGY_SIMPLE
      hyphenationFrequency = Layout.HYPHENATION_FREQUENCY_NONE
      setLineSpacing(0f, 1f)
    }

    fun applySpec(spec: VMTextSpec) {
      val paint: TextPaint = spec.buildPaint()
      setTextSize(TypedValue.COMPLEX_UNIT_PX, spec.fontSizePx)
      setTextColor(spec.color)
      typeface = paint.typeface
      letterSpacing = paint.letterSpacing
      textAlignment = when (spec.textAlign) {
        "center" -> TEXT_ALIGNMENT_CENTER
        "right" -> TEXT_ALIGNMENT_VIEW_END
        "left" -> TEXT_ALIGNMENT_VIEW_START
        else -> TEXT_ALIGNMENT_INHERIT
      }

      // Line height is NOT set here — it rides on the spannable as an
      // ExactLineHeightSpan, so this view and the measurement layout apply the
      // identical value. Computing leading separately in each place is what made
      // the native reader render looser than the legacy one.
      setLineSpacing(0f, 1f)

      // Text LAST: the spans are built against the metrics set above, and setting
      // text first would lay out once with the old metrics and again after.
      text = spec.buildSpannable()
      lastLayoutKey = null
      requestLayout()
      invalidate()
    }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val resolved = layout ?: return
      for (range in spec.ranges) {
        drawUnderline(canvas, resolved, range)
      }
      reportLayoutIfChanged(resolved)
    }

    /**
     * Draw one range's underline, one stroke per line it spans.
     *
     * A range that wraps needs its stroke clipped to the part of each line the
     * range actually covers, or the underline runs to the line's full width.
     */
    private fun drawUnderline(canvas: Canvas, layout: Layout, range: VMRange) {
      val style = range.underlineStyle ?: return
      val length = text?.length ?: 0
      val start = range.start.coerceIn(0, length)
      val end = range.end.coerceIn(start, length)
      if (end <= start) return

      underlinePaint.color = range.underlineColor
      underlinePaint.strokeWidth = range.underlineThicknessDp * density
      underlinePaint.pathEffect = when (style) {
        "dotted" -> {
          // Equal dot and gap at 2dp reads as dotted at body sizes; tighter looks
          // solid on a high-density panel.
          val segment = 2f * density
          DashPathEffect(floatArrayOf(segment, segment), 0f)
        }
        "dashed" -> {
          val dash = 4f * density
          DashPathEffect(floatArrayOf(dash, dash * 0.75f), 0f)
        }
        else -> null
      }

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
     * Emit line geometry so JS can anchor a popover to a tapped word.
     *
     * Read from the TextView's OWN layout rather than a separately built one, so
     * the geometry describes exactly what is on screen.
     */
    private fun reportLayoutIfChanged(layout: Layout) {
      // Same guard as onSelectionChanged. A draw cannot happen during construction
      // today, but the cost of being wrong about that is the whole view failing to
      // instantiate, so it is not worth relying on.
      if (!this@VMTextView.readyToDispatch) return
      val key = "${text?.length}:$width:${layout.lineCount}:${layout.height}"
      if (key == lastLayoutKey) return
      lastLayoutKey = key

      val lines = (0 until layout.lineCount).map { line ->
        val top = layout.getLineTop(line)
        mapOf(
          "start" to layout.getLineStart(line),
          "end" to layout.getLineEnd(line),
          "x" to (layout.getLineLeft(line) / density),
          "y" to (top / density),
          "width" to ((layout.getLineRight(line) - layout.getLineLeft(line)) / density),
          "height" to ((layout.getLineBottom(line) - top) / density),
          "baseline" to ((layout.getLineBaseline(line) - top) / density),
        )
      }
      this@VMTextView.onTextLayout(mapOf("lines" to lines))
    }

    /**
     * Report selection changes so JS can drive its own affordances — the Define
     * button for the dictionary lookup.
     *
     * Android reports start == end for a bare caret; that is normalised to -1/-1
     * so JS gets one unambiguous "nothing selected" signal instead of having to
     * know the convention.
     */
    override fun onSelectionChanged(selStart: Int, selEnd: Int) {
      super.onSelectionChanged(selStart, selEnd)
      // Fires during construction (setTextIsSelectable triggers it) and again on
      // every text change, both before the outer view's event dispatchers exist.
      // See `readyToDispatch`.
      if (!this@VMTextView.readyToDispatch) return
      val hasSelection = selEnd > selStart
      this@VMTextView.onSelectionChange(
        mapOf(
          "start" to if (hasSelection) selStart else -1,
          "end" to if (hasSelection) selEnd else -1,
        )
      )
    }

    /**
     * Detect taps here while leaving selection gestures to the platform.
     *
     * `setTextIsSelectable(true)` installs `ArrowKeyMovementMethod` and makes the
     * view focusable and long-clickable, so super handles long-press-to-select and
     * handle dragging. What super cannot do is say which decorated range a short
     * tap landed on, which is how a lexicon word opens its card.
     *
     * super is always called, so scrolling and selection keep working — a vertical
     * drag is never consumed here, which lets the parent ScrollView intercept it.
     * Long presses are deliberately NOT treated as taps: that gesture belongs to
     * selection, and firing a range tap too would open a card the instant the user
     * tried to select a word.
     */
    override fun onTouchEvent(event: MotionEvent): Boolean {
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.x
          downY = event.y
          downTime = event.eventTime
          longPressCancelled = false
        }
        MotionEvent.ACTION_MOVE -> {
          // A slow horizontal drag is a page swipe, not a selection.
          //
          // Selection is super's job, and `setTextIsSelectable(true)` makes this
          // view long-clickable, so Android's 500ms long-press timer starts on every
          // touch down. Someone dragging slowly sideways would cross that timer
          // before travelling far enough for the pager's gesture to claim the touch,
          // and the platform would begin selecting a word mid-swipe.
          //
          // Cancelling the pending long-press as soon as horizontal travel is both
          // past the touch slop and dominant over vertical travel keeps swiping and
          // scrolling intact while leaving the real selection gesture — press and
          // HOLD, without moving — completely untouched.
          if (!longPressCancelled) {
            val mdx = kotlin.math.abs(event.x - downX)
            val mdy = kotlin.math.abs(event.y - downY)
            val slop = ViewConfiguration.get(context).scaledTouchSlop
            if (mdx > slop && mdx > mdy) {
              longPressCancelled = true
              cancelLongPress()
              // Cancelling the pending long-press is not enough on its own, and
              // shipping only that was measured to change nothing: someone who holds
              // still past the 500ms timeout BEFORE moving already has a selection by
              // the time this runs, which is exactly the reported gesture. So an
              // existing selection is dropped too — a horizontal drag is a page turn,
              // never a selection.
              clearSelectionIfAny()
            }
          }
        }
        MotionEvent.ACTION_UP -> {
          val dx = event.x - downX
          val dy = event.y - downY
          val slop = ViewConfiguration.get(context).scaledTouchSlop
          val moved = dx * dx + dy * dy > slop * slop
          val longPress = event.eventTime - downTime >= ViewConfiguration.getLongPressTimeout()
          // A tap while something is selected DISMISSES the selection and does
          // nothing else. Previously the tap fell through and opened the verse
          // insight, so there was no way to simply get rid of a selection.
          if (!moved && !longPress && hasSelection()) {
            clearSelectionIfAny()
            super.onTouchEvent(event)
            return true
          }
          val handled = super.onTouchEvent(event)
          if (!moved && !longPress) dispatchTap(event.x, event.y)
          return handled
        }
      }
      return super.onTouchEvent(event)
    }

    private fun hasSelection(): Boolean = selectionEnd > selectionStart

    /**
     * Drop any active selection.
     *
     * Collapsing to a zero-width range at the selection start is what the platform
     * itself does on a dismiss, and it takes the selection handles and the action
     * bar down with it.
     */
    private fun clearSelectionIfAny() {
      if (!hasSelection()) return
      val text = text
      if (text is android.text.Spannable) {
        android.text.Selection.setSelection(text, selectionStart)
      }
    }

    private fun dispatchTap(x: Float, y: Float) {
      val offset = charOffsetAt(x, y)
      // Later ranges paint over earlier ones, so the topmost interactive range at
      // this offset is the one the user sees and therefore the one they meant.
      val hitIndex = spec.ranges.indexOfLast {
        it.interactive && offset >= it.start && offset < it.end
      }
      if (hitIndex >= 0) {
        this@VMTextView.onRangeTap(mapOf("index" to hitIndex, "charOffset" to offset))
      } else {
        this@VMTextView.onPress(
          mapOf("charOffset" to offset, "x" to (x / density), "y" to (y / density))
        )
      }
    }

    /** Character offset nearest a point, or 0 before the first layout. */
    private fun charOffsetAt(x: Float, y: Float): Int {
      val resolved = layout ?: return 0
      val line = resolved.getLineForVertical(y.toInt())
      return resolved.getOffsetForHorizontal(line, x)
    }
  }

  companion object {
    /**
     * Gap between the text baseline and the underline, in dp. Clears descenders
     * (g, y, p) at body sizes without the line detaching from the word.
     */
    private const val UNDERLINE_BASELINE_OFFSET_DP = 3f
  }
}
