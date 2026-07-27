package expo.modules.versematetext

import android.text.Layout
import android.text.StaticLayout
import android.util.LruCache

/**
 * Builds and caches text layouts.
 *
 * ## Why one engine for measuring and drawing
 *
 * JS asks for a height synchronously, then renders the view with that exact
 * height so Yoga sizes it correctly on the very first layout pass — no reflow
 * frame, no content jump on chapter open. That only holds if the height JS was
 * given is the height the view actually needs. So measurement and drawing must
 * come from the same `StaticLayout` configuration; anything else clips text or
 * leaves a gap.
 *
 * `StaticLayout` (not `TextView.measure`) because it is safe off the main thread
 * — the same reason `PrecomputedText` exists — and the synchronous JSI call that
 * asks for the height runs on the JS thread, not the UI thread.
 *
 * ## Layout parameters, and why these specific ones
 *
 * The values below are chosen to match how React Native lays out its own
 * `<Text>` on Android, so native paragraphs and surrounding RN text break lines
 * identically and cannot visually drift:
 *
 * - `includeFontPadding = false` — RN sets this; the default adds ascent/descent
 *   padding that makes line spacing inconsistent with RN text.
 * - `BREAK_STRATEGY_SIMPLE` — RN uses simple greedy breaking. The platform
 *   default (`HIGH_QUALITY`) breaks lines differently, which is immediately
 *   visible as different wrap points in the same paragraph.
 * - `HYPHENATION_FREQUENCY_NONE` — RN disables hyphenation.
 */
object VMTextLayoutEngine {

  /**
   * Measured heights, keyed by the whole spec.
   *
   * Sized for a long chapter's worth of paragraphs across a couple of font
   * sizes and both orientations. Entries are small (a spec plus an int), and the
   * cost of a miss is one `StaticLayout` build, so a generous cache is cheap
   * insurance against re-measuring on every re-render.
   */
  private val heightCache = LruCache<VMTextSpec, Int>(512)

  /** Cached layouts for drawing, keyed the same way. */
  private val layoutCache = LruCache<VMTextSpec, StaticLayout>(64)

  /**
   * Height in px for `spec`, or 0 when there is nothing to lay out.
   *
   * Safe to call off the main thread.
   */
  fun measureHeight(spec: VMTextSpec): Int {
    if (spec.text.isEmpty() || spec.widthPx <= 0) return 0
    heightCache.get(spec)?.let { return it }
    val height = buildLayout(spec).height
    heightCache.put(spec, height)
    return height
  }

  /** Layout for `spec`, built on demand and cached. */
  fun layoutFor(spec: VMTextSpec): StaticLayout? {
    if (spec.text.isEmpty() || spec.widthPx <= 0) return null
    layoutCache.get(spec)?.let { return it }
    val layout = buildLayout(spec)
    layoutCache.put(spec, layout)
    // A freshly built layout already knows its height; seed the height cache so
    // a later measure of the same spec is free.
    heightCache.put(spec, layout.height)
    return layout
  }

  private fun buildLayout(spec: VMTextSpec): StaticLayout {
    val spannable = spec.buildSpannable()
    val builder = StaticLayout.Builder
      .obtain(spannable, 0, spannable.length, spec.buildPaint(), spec.widthPx)
      .setAlignment(alignmentOf(spec.textAlign))
      .setIncludePad(false)
      .setBreakStrategy(Layout.BREAK_STRATEGY_SIMPLE)
      .setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE)

    if (spec.lineHeightPx > 0f) {
      // Express an explicit line height as extra leading on top of the font's
      // natural spacing. Using a multiplier instead would scale with the font
      // and stop matching the requested absolute value.
      val natural = spec.buildPaint().let { it.descent() - it.ascent() }
      builder.setLineSpacing((spec.lineHeightPx - natural).coerceAtLeast(0f), 1f)
    } else {
      builder.setLineSpacing(0f, 1f)
    }

    return builder.build()
  }

  private fun alignmentOf(textAlign: String?): Layout.Alignment = when (textAlign) {
    "center" -> Layout.Alignment.ALIGN_CENTER
    // ALIGN_OPPOSITE is end-relative, so it does the right thing in RTL too.
    "right" -> Layout.Alignment.ALIGN_OPPOSITE
    else -> Layout.Alignment.ALIGN_NORMAL
  }

  /**
   * Drop everything. Called when the app's font configuration changes, since
   * every cached height was measured against the old scale and would otherwise
   * clip after the change.
   */
  fun clearCaches() {
    heightCache.evictAll()
    layoutCache.evictAll()
  }
}
