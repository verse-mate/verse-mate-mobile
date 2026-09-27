/**
 * The chrome every Jesus page wears: the reader-style header bar, the Bible
 * navigation modal (opened on its Jesus tab), and the hamburger menu.
 *
 * One component so the six list pages and the event screen cannot drift into
 * different headers again — which is what happened: the event had the reader
 * bar and every page leading to it had a light back-arrow bar with no menu.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { BibleNavigationModal } from '@/components/bible/BibleNavigationModal';
import { HamburgerMenu } from '@/components/bible/HamburgerMenu';
import { JesusEventHeader, type JesusEventView } from '@/components/jesus/JesusEventHeader';

export function JesusChrome({
  title,
  onBack,
  backTestID,
  titleTestID,
  view,
  onViewChange,
}: {
  title: string;
  /** Where "back" goes. Every Jesus page has one — see JesusEventHeader. */
  onBack: () => void;
  backTestID?: string;
  titleTestID?: string;
  view?: JesusEventView;
  onViewChange?: (view: JesusEventView) => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <JesusEventHeader
        title={title}
        view={view}
        onViewChange={onViewChange}
        onTitlePress={() => setNavOpen(true)}
        onMenuPress={() => setMenuOpen(true)}
        onBack={onBack}
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
