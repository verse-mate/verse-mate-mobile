/**
 * The pager's virtual-position bookkeeping, extracted as pure logic.
 *
 * Fast swiping failed for two ordering reasons, and both are invisible in a
 * screenshot:
 *
 *  1. A swipe resolved its target from props, which describe the chapter React
 *     has COMMITTED. Committing takes ~520ms, so a second quick swipe aimed at a
 *     chapter the user had already left — the run collapsed to one step and then
 *     looked jammed.
 *  2. Re-syncing the virtual position on every committed change dragged it
 *     backwards, because with two swipes in flight the FIRST chapter commits
 *     first. That reintroduces (1) one step later.
 *
 * These are state-machine bugs with a specific event order, which is exactly what
 * a unit test can pin down and a device cannot.
 */

interface Loc {
  bookId: number;
  chapterNumber: number;
}

const key = (l: Loc) => `${l.bookId}-${l.chapterNumber}`;

/**
 * Mirrors the pager's bookkeeping: `advance` is a settled swipe, `commit` is
 * props arriving.
 */
function makeTracker(start: Loc) {
  let virtual = start;
  const queue: string[] = [];
  return {
    get virtual() {
      return virtual;
    },
    get inFlight() {
      return queue.length;
    },
    /** A swipe settled and resolved to `target`. */
    advance(target: Loc) {
      virtual = target;
      queue.push(key(target));
    },
    /** React committed `loc`. */
    commit(loc: Loc) {
      const at = queue.indexOf(key(loc));
      if (at === -1) {
        queue.length = 0;
        virtual = loc;
        return;
      }
      queue.splice(0, at + 1);
      if (queue.length === 0) virtual = loc;
    },
  };
}

describe('pager virtual position', () => {
  it('advances once per swipe even with nothing committed yet', () => {
    const t = makeTracker({ bookId: 1, chapterNumber: 3 });
    t.advance({ bookId: 1, chapterNumber: 4 });
    t.advance({ bookId: 1, chapterNumber: 5 });
    t.advance({ bookId: 1, chapterNumber: 6 });
    expect(t.virtual).toEqual({ bookId: 1, chapterNumber: 6 });
    expect(t.inFlight).toBe(3);
  });

  it('does not rewind when an earlier chapter commits first', () => {
    const t = makeTracker({ bookId: 1, chapterNumber: 3 });
    t.advance({ bookId: 1, chapterNumber: 4 });
    t.advance({ bookId: 1, chapterNumber: 5 });

    // Genesis 4 lands first — the virtual position must stay at 5.
    t.commit({ bookId: 1, chapterNumber: 4 });
    expect(t.virtual).toEqual({ bookId: 1, chapterNumber: 5 });

    t.commit({ bookId: 1, chapterNumber: 5 });
    expect(t.virtual).toEqual({ bookId: 1, chapterNumber: 5 });
    expect(t.inFlight).toBe(0);
  });

  it('lets an external navigation win outright', () => {
    const t = makeTracker({ bookId: 1, chapterNumber: 3 });
    t.advance({ bookId: 1, chapterNumber: 4 });
    t.advance({ bookId: 1, chapterNumber: 5 });

    // The dropdown jumps to John 1 while two swipes are still in flight.
    t.commit({ bookId: 43, chapterNumber: 1 });
    expect(t.virtual).toEqual({ bookId: 43, chapterNumber: 1 });
    expect(t.inFlight).toBe(0);
  });

  it('drops skipped intermediates when a later chapter commits first', () => {
    // Coalesced navigation can commit the newest target and never the ones
    // between; the queue must not be left holding them forever, or the virtual
    // position would never re-sync again.
    const t = makeTracker({ bookId: 1, chapterNumber: 3 });
    t.advance({ bookId: 1, chapterNumber: 4 });
    t.advance({ bookId: 1, chapterNumber: 5 });
    t.advance({ bookId: 1, chapterNumber: 6 });

    t.commit({ bookId: 1, chapterNumber: 6 });
    expect(t.inFlight).toBe(0);
    expect(t.virtual).toEqual({ bookId: 1, chapterNumber: 6 });
  });

  it('re-syncs to props on a normal one-at-a-time swipe', () => {
    const t = makeTracker({ bookId: 1, chapterNumber: 3 });
    t.advance({ bookId: 1, chapterNumber: 4 });
    t.commit({ bookId: 1, chapterNumber: 4 });
    expect(t.inFlight).toBe(0);
    expect(t.virtual).toEqual({ bookId: 1, chapterNumber: 4 });
  });
});
