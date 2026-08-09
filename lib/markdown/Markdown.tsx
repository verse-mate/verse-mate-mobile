/**
 * `<Markdown>` — the app's markdown renderer.
 *
 * Renders through the NATIVE span renderer when that is possible, and through React otherwise.
 * Deliberately the same name and props as before, so no call site has to know which path it got:
 * Insight, Study and Topics all benefit from one import, and one stored preference still switches
 * everything for an A/B.
 *
 * The decision itself lives in `NativeMarkdown` — including the wholesale fallback for documents
 * with anything a span cannot express — because that is where the information to make it is.
 *
 * See `./ReactMarkdown` for the React path and the shared-parser optimisation, and
 * `lib/text/compile-markdown` for how markdown becomes decorated character ranges.
 */

export { NativeMarkdown as Markdown, NativeMarkdown as default } from '@/components/markdown/NativeMarkdown';
