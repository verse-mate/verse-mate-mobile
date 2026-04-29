/**
 * Mobile audio API client tests — port of the verse-mate-web suite
 * for the same audio bug class (PRs #58/#59/#60 on web). Mobile already
 * gets refresh-on-401 via authenticatedFetch, so those cases live in
 * the web tests; here we cover the fixed-timer parts (404 race
 * tolerance, guest-scope error) directly without exercising jest's
 * fake-timer flush — that path OOMs the runner for long polling
 * loops, and the loop algorithm itself is identical to web's.
 */
import { fetchAudioWithPolling, GuestScopeExceededError, pollJob } from '../lib/audio/audioApi';

interface FakeCall {
  url: string;
  init?: RequestInit;
}

function makeFakeFetch(handlers: ((call: FakeCall) => Response | Promise<Response>)[]) {
  const calls: FakeCall[] = [];
  let i = 0;
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const handler = handlers[i++] ?? handlers[handlers.length - 1];
    return handler({ url, init });
  };
  return { fn, calls };
}

describe('fetchAudioWithPolling — guest scope', () => {
  test('throws GuestScopeExceededError on 401', async () => {
    const { fn } = makeFakeFetch([
      () =>
        new Response(JSON.stringify({ message: 'GUEST_SCOPE_EXCEEDED' }), {
          status: 401,
        }),
    ]);
    await expect(
      fetchAudioWithPolling({ explanationId: 10170, fetchFn: fn })
    ).rejects.toBeInstanceOf(GuestScopeExceededError);
  });

  test('returns the audio immediately when the backend has it cached (200)', async () => {
    const { fn } = makeFakeFetch([
      () =>
        new Response(
          JSON.stringify({
            audio: {
              url: 'https://cdn.test/cached.mp3',
              duration_seconds: 120,
              voice: 'alloy',
              language_code: 'en-US',
            },
          }),
          { status: 200 }
        ),
    ]);
    const audio = await fetchAudioWithPolling({
      explanationId: 9999,
      fetchFn: fn,
    });
    expect(audio.url).toBe('https://cdn.test/cached.mp3');
  });
});

describe('pollJob — 404 race tolerance', () => {
  test('treats 404 as still-queued (verse-mate#194 dedup-clear race)', async () => {
    // After verse-mate#194 (drop failed jobs before re-enqueue), there
    // is a brief window where `getJob(jobId)` returns nothing. The
    // chip used to flip to `error` on the first 404; now pollJob
    // returns `status: queued` and lets the outer loop continue.
    const { fn } = makeFakeFetch([
      () =>
        new Response(JSON.stringify({ message: 'Job not found' }), {
          status: 404,
        }),
    ]);
    const job = await pollJob({
      jobId: 'audio-gen:10236:alloy:en-US',
      fetchFn: fn,
    });
    expect(job.status).toBe('queued');
    expect(job.job_id).toBe('audio-gen:10236:alloy:en-US');
  });

  test('still throws on non-404 / non-2xx responses (e.g., 500)', async () => {
    const { fn } = makeFakeFetch([() => new Response('{"error":"oops"}', { status: 500 })]);
    await expect(pollJob({ jobId: 'audio-gen:1:alloy:en-US', fetchFn: fn })).rejects.toThrow(
      /HTTP 500/
    );
  });

  test('returns the parsed job for a normal active response', async () => {
    const { fn } = makeFakeFetch([
      () =>
        new Response(
          JSON.stringify({
            job: {
              job_id: 'audio-gen:1:alloy:en-US',
              status: 'active',
            },
          }),
          { status: 200 }
        ),
    ]);
    const job = await pollJob({
      jobId: 'audio-gen:1:alloy:en-US',
      fetchFn: fn,
    });
    expect(job.status).toBe('active');
  });

  test('returns completed + audio when the job is done', async () => {
    const { fn } = makeFakeFetch([
      () =>
        new Response(
          JSON.stringify({
            job: {
              job_id: 'audio-gen:1:alloy:en-US',
              status: 'completed',
              audio: {
                url: 'https://cdn.test/done.mp3',
                duration_seconds: 60,
                voice: 'alloy',
                language_code: 'en-US',
              },
            },
          }),
          { status: 200 }
        ),
    ]);
    const job = await pollJob({
      jobId: 'audio-gen:1:alloy:en-US',
      fetchFn: fn,
    });
    expect(job.status).toBe('completed');
    expect(job.audio?.url).toBe('https://cdn.test/done.mp3');
  });
});
