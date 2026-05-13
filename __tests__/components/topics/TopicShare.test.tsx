/**
 * Topic share copy
 *
 * Spec: feat-humanize-share, TASK-003. Both topic share entry points
 * (`components/topics/TopicExplanationsPanel.tsx` and
 *  `app/topics/[topicId].tsx`) MUST resolve copy from the same i18n keys
 *  (`sharing.topic.title` / `sharing.topic.body`) so the user-facing string
 *  stays identical across surfaces. We lock the keys here + grep the source
 *  to prove both call sites read them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { t } from 'i18next';

const repoRoot = join(__dirname, '..', '..', '..');
const panelSrc = readFileSync(
  join(repoRoot, 'components/topics/TopicExplanationsPanel.tsx'),
  'utf8'
);
const pageSrc = readFileSync(join(repoRoot, 'app/topics/[topicId].tsx'), 'utf8');

describe('Topic share copy (feat-humanize-share)', () => {
  it('renders body with topic name + url, no "Check out" lead', () => {
    const body = t('sharing.topic.body', {
      topic: 'The Beatitudes',
      url: 'https://app.versemate.org/topics/THEME/the-beatitudes',
    });
    expect(body).toContain('The Beatitudes');
    expect(body).toContain('https://app.versemate.org/topics/THEME/the-beatitudes');
    expect(body).not.toMatch(/^Check out/i);
  });

  it('TopicExplanationsPanel reads from sharing.topic.body and sharing.topic.title', () => {
    expect(panelSrc).toContain("t('sharing.topic.body'");
    expect(panelSrc).toContain("t('sharing.topic.title'");
    expect(panelSrc).not.toMatch(/Check out \$\{topicName\} on VerseMate/);
  });

  it('app/topics/[topicId].tsx reads from sharing.topic.body and sharing.topic.title', () => {
    expect(pageSrc).toContain("t('sharing.topic.body'");
    expect(pageSrc).toContain("t('sharing.topic.title'");
    expect(pageSrc).not.toMatch(/Check out \$\{currentTopic\.name\} on VerseMate/);
  });
});
