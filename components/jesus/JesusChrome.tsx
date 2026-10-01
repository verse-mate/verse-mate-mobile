/**
 * The chrome every Jesus page wears: the reader-style header bar, the Bible
 * navigation modal (opened on its Jesus tab), and the hamburger menu.
 *
 * One component so the six list pages and the event screen cannot drift into
 * different headers again — which is what happened: the event had the reader
 * bar and every page leading to it had a light back-arrow bar with no menu.
 */
import { StackActions } from '@react-navigation/native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { JesusEventHeader, type JesusEventView } from '@/components/jesus/JesusEventHeader';

/** Pages that hold content rather than list it. */
const CONTENT_ROUTES = new Set(['event/[slug]', 'entry/[slug]']);

/**
 * "Back" in the Jesus section walks the TREE, not the history.
 *
 * The operator's rule, verbatim: "back should take you to a previous page in
 * the whole tree order, not necessarily directly to a last page you were on, so
 * back from the boy in the temple should take you back to the questions
 * category, and then from there back to the Jesus feature. If however you
 * searched for that specific entry … back should take you directly to the
 * Jesus feature."
 *
 * So, from a content page (an event):
 *  - opened from a SEARCH (`?from=search`) → straight to the hub;
 *  - otherwise → the nearest page below it that is NOT itself content, i.e. the
 *    category it was reached through. Hopping between related events does not
 *    stack up events to step back through.
 * List pages step back one page as normal, and the hub leaves the section.
 *
 * The hub is always at the bottom of this stack (app/jesus/_layout
 * `initialRouteName`), so a Jesus page to land on always exists. If the stack
 * cannot be read at all, it falls back to the hub rather than doing nothing.
 */
export function useJesusBack(): () => void {
  const navigation = useNavigation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  return useCallback(() => {
    const state = navigation.getState?.();
    const routes = state?.routes ?? [];
    const current = state?.index ?? routes.length - 1;
    const here = routes[current]?.name;

    if (!state) {
      // Nothing to reason about: best effort, but never out of the section.
      if (router.canGoBack()) router.back();
      else router.replace('/jesus');
      return;
    }
    if (here === 'index') {
      // The hub is the section's root — back leaves it for wherever it was
      // opened from (the reader, usually).
      if (router.canGoBack()) router.back();
      else router.replace('/');
      return;
    }

    let target = current - 1;
    if (CONTENT_ROUTES.has(here)) {
      if (from === 'search') {
        target = routes.findIndex((r) => r.name === 'index');
      } else {
        while (target > 0 && CONTENT_ROUTES.has(routes[target]?.name)) target -= 1;
      }
    }
    if (target < 0) {
      router.replace('/jesus');
      return;
    }
    navigation.dispatch(StackActions.pop(current - target));
  }, [navigation, from]);
}

export function JesusChrome({
  title,
  subtitle,
  onBack,
  backTestID,
  titleTestID,
  view,
  onViewChange,
}: {
  title: string;
  /** The header's second line — the Bible version, where there is scripture. */
  subtitle?: string;
  /** Override for "back"; defaults to the tree walk in useJesusBack. */
  onBack?: () => void;
  backTestID?: string;
  titleTestID?: string;
  view?: JesusEventView;
  onViewChange?: (view: JesusEventView) => void;
}) {
  const treeBack = useJesusBack();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <JesusEventHeader
        title={title}
        subtitle={subtitle}
        view={view}
        onViewChange={onViewChange}
        onTitlePress={() => setNavOpen(true)}
        onMenuPress={() => setMenuOpen(true)}
        onBack={onBack ?? treeBack}
        backTestID={backTestID}
        titleTestID={titleTestID}
      />
      {navOpen ? (
        <BibleNavigationModal
          visible={navOpen}
          initialTab="JESUS"
          // A Jesus page is not a chapter, so nothing is highlighted as current;
          // the selector opens on the Jesus tab and a book pick leaves for the
          // reader.
          currentBookId={0}
          currentChapter={0}
          onClose={() => setNavOpen(false)}
          onSelectChapter={(bookId, chapter) => {
            setNavOpen(false);
            router.push(`/bible/${bookId}/${chapter}`);
          }}
        />
      ) : null}
      <HamburgerMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
