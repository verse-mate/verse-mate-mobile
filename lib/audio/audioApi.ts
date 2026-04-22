/**
 * TASK-017: mobile audio API client.
 *
 * Mirrors web's useExplanationAudio fetch+poll pattern. Per br-audio-017
 * the audio endpoints intentionally use raw fetch (long-poll +
 * AbortController) rather than the generated SDK — easier timeout +
 * cancellation control.
 *
 * Reader DTO (br-audio-007) is the 4-field shape only. Provider info
 * lives behind admin endpoints, not exposed here.
 */
import { authenticatedFetch } from "@/lib/api/authenticated-fetch";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

export interface ReaderAudio {
  audio_url: string;
  duration_seconds: number;
  voice: string;
  language_code: string;
}

export interface ResumeProgress {
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

/**
 * Subset of `fetch` used by this module — `authenticatedFetch` is a
 * wrapper without the extra static methods on the global `fetch`
 * (e.g. `preconnect`), so we accept anything callable as fetch.
 */
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Thrown when a guest (br-audio-013) requests audio for a chapter
 * outside their allowed scope (Genesis 1 only). Lets the UI surface
 * a sign-in CTA instead of a generic error message.
 */
export class GuestScopeExceededError extends Error {
  constructor() {
    super("Sign in to listen to this chapter");
    this.name = "GuestScopeExceededError";
  }
}

interface AudioResponse {
  audio?: ReaderAudio;
  job?: { job_id: string; estimated_ready_seconds: number };
}

interface JobStatusResponse {
  job: {
    job_id: string;
    status: "queued" | "active" | "completed" | "failed";
    audio?: ReaderAudio;
    error_code?: string;
  };
}

export type SaveReason = "pause" | "complete" | "background" | "navigation";

function getApiBase(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "https://api.versemate.org";
}

function audioUrl(
  baseUrl: string,
  explanationId: number,
  voice?: string,
  language?: string,
): string {
  const params = new URLSearchParams();
  if (voice) params.set("voice", voice);
  if (language) params.set("language", language);
  const qs = params.toString();
  return `${baseUrl}/bible/explanation/audio/${explanationId}${qs ? `?${qs}` : ""}`;
}

function progressUrl(baseUrl: string, explanationId: number): string {
  return `${baseUrl}/bible/explanation/audio/${explanationId}/progress`;
}

export async function requestAudio(args: {
  explanationId: number;
  voice?: string;
  language?: string;
  signal?: AbortSignal;
  fetchFn?: FetchLike;
}): Promise<{ status: number; body: AudioResponse }> {
  const fetchFn = args.fetchFn ?? authenticatedFetch;
  const url = audioUrl(getApiBase(), args.explanationId, args.voice, args.language);
  const response = await fetchFn(url, { signal: args.signal });
  const body =
    response.status === 204 ? {} : ((await response.json()) as AudioResponse);
  return { status: response.status, body };
}

export async function pollJob(args: {
  jobId: string;
  signal?: AbortSignal;
  fetchFn?: FetchLike;
}): Promise<JobStatusResponse["job"]> {
  const fetchFn = args.fetchFn ?? authenticatedFetch;
  const response = await fetchFn(
    `${getApiBase()}/bible/explanation/audio/jobs/${encodeURIComponent(args.jobId)}`,
    { signal: args.signal },
  );
  if (!response.ok) {
    throw new Error(`Job status failed: HTTP ${response.status}`);
  }
  const body = (await response.json()) as JobStatusResponse;
  return body.job;
}

/**
 * Resolves to the ReaderAudio once available. Throws on failure or
 * after POLL_TIMEOUT_MS without resolution.
 */
export async function fetchAudioWithPolling(args: {
  explanationId: number;
  voice?: string;
  language?: string;
  signal?: AbortSignal;
  fetchFn?: FetchLike;
}): Promise<ReaderAudio> {
  const initial = await requestAudio(args);
  if (initial.status === 200 && initial.body.audio) return initial.body.audio;
  // br-audio-013: guests can only request Genesis 1.
  if (initial.status === 401) {
    throw new GuestScopeExceededError();
  }
  if (initial.status !== 202 || !initial.body.job) {
    throw new Error(`Unexpected audio response: ${initial.status}`);
  }
  const { job_id } = initial.body.job;
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    if (args.signal?.aborted) throw new Error("aborted");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const job = await pollJob({
      jobId: job_id,
      signal: args.signal,
      fetchFn: args.fetchFn,
    });
    if (job.status === "completed" && job.audio) return job.audio;
    if (job.status === "failed") {
      throw new Error(`Generation failed: ${job.error_code ?? "UNKNOWN"}`);
    }
  }
  throw new Error("Audio generation timed out after 30s");
}

export async function fetchProgress(
  explanationId: number,
  fetchFn: FetchLike = authenticatedFetch,
): Promise<ResumeProgress | null> {
  const res = await fetchFn(progressUrl(getApiBase(), explanationId));
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as ResumeProgress;
}

export async function saveProgress(args: {
  explanationId: number;
  positionSeconds: number;
  durationSeconds: number;
  reason: SaveReason;
  fetchFn?: FetchLike;
}): Promise<void> {
  const fetchFn = args.fetchFn ?? authenticatedFetch;
  await fetchFn(progressUrl(getApiBase(), args.explanationId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      position_seconds: args.positionSeconds,
      duration_seconds: args.durationSeconds,
      reason: args.reason,
    }),
  }).catch(() => {
    // Best-effort save — never block playback on a failed save.
  });
}
