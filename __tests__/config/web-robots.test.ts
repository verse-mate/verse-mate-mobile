import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const robotsPath = join(__dirname, '../../public/robots.txt');

type Group = { agents: string[]; disallow: string[]; allow: string[] };

function groups(text: string): Group[] {
  const parsed: Group[] = [];
  let current: Group | null = null;
  let readingAgents = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const colon = line.indexOf(':');
    if (!line || colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (!readingAgents || !current) {
        current = { agents: [], disallow: [], allow: [] };
        parsed.push(current);
      }
      current.agents.push(value.toLowerCase());
      readingAgents = true;
      continue;
    }
    readingAgents = false;
    if (field === 'disallow' && current && value) current.disallow.push(value);
    if (field === 'allow' && current && value) current.allow.push(value);
  }
  return parsed;
}

function rootDisallowedFor(text: string, agent: string) {
  const all = groups(text);
  const group =
    all.find((candidate) => candidate.agents.includes(agent.toLowerCase())) ??
    all.find((candidate) => candidate.agents.includes('*'));
  return group?.disallow.includes('/') ?? false;
}

describe('the mobile web build robots.txt', () => {
  const text = readFileSync(robotsPath, 'utf8');

  it('keeps training crawlers out and lets answer crawlers in', () => {
    for (const agent of ['GPTBot', 'ClaudeBot', 'CCBot', 'Applebot-Extended', 'Bytespider']) {
      expect([agent, rootDisallowedFor(text, agent)]).toEqual([agent, true]);
    }
    for (const agent of [
      'Claude-User',
      'PerplexityBot',
      'Googlebot',
      'Google-Extended',
      'Amazonbot',
    ]) {
      expect([agent, rootDisallowedFor(text, agent)]).toEqual([agent, false]);
    }
  });

  it('carries the same content signal as the reader, and no sitemap of its own', () => {
    const signals = text.split('\n').filter((line) => /^content-signal:/i.test(line.trim()));
    expect(signals).toEqual(['Content-Signal: search=yes, ai-input=yes, ai-train=no']);
    expect(text).not.toMatch(/^sitemap:/im);
  });
});
