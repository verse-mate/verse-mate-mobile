#!/usr/bin/env bash
#
# Refuse to measure an app that is not actually running.
#
# Sourced by the capture scripts. Every function here ABORTS rather than warns, because the failure this
# exists to prevent is not a crash — it is a capture that produces plausible numbers from an app sitting
# on the dev-client error screen.
#
# ## Why this exists
#
# This happened repeatedly, and cost the operator's time every time:
#
#   * After `bun start --clear`, Metro's first build takes MINUTES. Launch the app inside that window and
#     the dev client asks for a bundle, gets nothing, and shows the white error screen. Every capture run
#     against it then measures an app that never executed a line of our JS.
#   * A capture once reported "worst JS block 232.2ms, severe 0" — a 9x improvement — because the lexicon
#     import was REJECTING. The work being measured never ran. The evidence was in the same logcat: five
#     uncaught rejections, and zero `by.alignment` counters.
#
# The lesson from both: a perf harness must prove the app is healthy BEFORE it measures, not sanity-check
# the results afterwards. Afterwards is how a wrong number reaches a human.
#
# Order matters — each gate is cheaper than the one it protects:
#   1. bundle_compiles   — does Metro actually serve a bundle? (no device involved)
#   2. js_is_running     — did OUR bundle execute? (`[VMPERF] monitor started`)
#   3. no_error_state    — zero VMERR / uncaught rejections, and any capture-specific counters
#
# Usage (from a capture script that already defines `adb_sh` and `pcrun`):
#
#   source "$(dirname "${BASH_SOURCE[0]}")/preflight.sh"
#   preflight_bundle_compiles                 # before launching anything
#   preflight_js_running "$DEVICE"            # after launching
#   preflight_no_errors "$DEVICE" by.alignment

# The dev bundle is ~168MB, so this is not a quick HEAD request — it is a real build. That is the point:
# it forces Metro to compile and turns a transform error into an HTTP failure with a message, on the PC,
# before the device is touched. Run detached because the `pc` bridge wedges on calls over ~2 minutes.
preflight_bundle_compiles() {
  local platform="${1:-android}"
  local status_file='D:/tmp/preflight-bundle.status'

  echo "==> Preflight 1/3: does Metro serve a bundle?"
  pcrun "Remove-Item $status_file -EA SilentlyContinue" 60 >/dev/null 2>&1 || true
  pc -s vmpreflight --bg "curl.exe -s -o D:/tmp/preflight-bundle.js -w 'HTTP=%{http_code} BYTES=%{size_download}' 'http://localhost:8081/index.bundle?platform=$platform&dev=true&minify=false' | Out-File -Encoding utf8 $status_file" >/dev/null 2>&1

  local waited=0 out=''
  while [[ $waited -lt 600 ]]; do
    out="$(pcrun "if (Test-Path $status_file) { Get-Content $status_file -Raw } else { 'pending' }" 90 | tr -d '\r\n')"
    [[ "$out" == *HTTP=* ]] && break
    sleep 15
    waited=$((waited + 15))
  done

  if [[ "$out" != *"HTTP=200"* ]]; then
    echo "    ✗ Metro did not serve a bundle: ${out:-timed out after ${waited}s}"
    echo ""
    echo "    Nothing was measured, deliberately. A capture against an app that never got a bundle"
    echo "    reports an idle app, which looks like a fast one."
    echo ""
    echo "    If Metro was just restarted with --clear, its first build takes minutes — this gate IS the"
    echo "    wait. If it returned a non-200, the error body is on the PC at D:/tmp/preflight-bundle.js."
    return 1
  fi
  echo "    ✓ bundle served (${out})"
}

# `[VMPERF] monitor started` is logged by `installPerfSession` from the root layout, so it appears only
# when OUR bundle is executing — not merely when the process is alive. The dev-client error screen is a
# live process with a live pid and no JS.
#
# Tag-filtered but NOT count-bounded: `logcat -t N` applies its window to the whole buffer before
# filtering, and this phone's modem logs push app lines out of any small window within seconds.
preflight_js_running() {
  local device="$1" tries="${2:-15}"
  echo "==> Preflight 2/3: is our JS executing?"

  # A RELEASE build cannot pass this gate, and that is not a failure.
  #
  # `[VMPERF] monitor started` comes from the perf session, which is `__DEV__`-only (plus the
  # EXPO_PUBLIC_PERF opt-in). A store/preview build emits nothing, so requiring the marker would abort
  # every release measurement — and release builds are exactly where the honest numbers live: no Metro,
  # no dev overhead, Hermes bytecode precompiled. The operator measured a store build as noticeably
  # smoother than a dev build, which is the whole reason this branch exists.
  #
  # So for a non-debuggable package, substitute a liveness check the app can actually satisfy: it is the
  # foreground activity AND the UI thread has produced frames. That proves something is rendering, which
  # is what this gate is really for. atrace and gfxinfo both work regardless of __DEV__.
  local flags
  flags="$(adb_sh "shell dumpsys package org.versemate.app | Select-String 'pkgFlags'" | head -1)"
  if [[ "$flags" != *DEBUGGABLE* ]]; then
    echo "    NOTE: release build (not debuggable) — the perf session is absent by design."
    # Grep the WHOLE output, not `head -1`. The bridge prefixes a blank line, so taking the first line
    # discarded the match and this gate refused a perfectly healthy release build.
    local fg frames
    fg="$(adb_sh "shell dumpsys activity activities | Select-String 'ResumedActivity'")"
    frames="$(adb_sh "shell dumpsys gfxinfo org.versemate.app | Select-String 'Total frames rendered'")"
    if ! printf '%s' "$fg" | grep -q versemate; then
      echo "    ✗ the app is not the foreground activity — nothing to measure."
      return 1
    fi
    if [[ -z "${frames//[[:space:]]/}" ]]; then
      echo "    ✗ no frame stats — the app has rendered nothing."
      return 1
    fi
    echo "    ✓ foreground and rendering ($(printf '%s' "$frames" | tr -d '\r' | tr -s ' ' | xargs | head -c 60))"
    echo "    NOTE: span/counter gates do not apply here; judge this run on atrace + gfxinfo only."
    return 0
  fi

  local i=0
  while [[ $i -lt $tries ]]; do
    if adb_sh "logcat -d 2>\$null | Select-String -Pattern 'monitor started'" | grep -q 'monitor started'; then
      echo "    ✓ [VMPERF] monitor started"
      return 0
    fi
    sleep 20
    i=$((i + 1))
  done
  echo "    ✗ no '[VMPERF] monitor started' after $((tries * 20))s — the app is not running our bundle."
  echo ""
  echo "    Usually the dev-client error screen. Check that Metro is up, that 'adb reverse tcp:8081"
  echo "    tcp:8081' is present, and that preflight_bundle_compiles passed BEFORE the app was launched."
  return 1
}

# Errors and, optionally, the counters that prove the feature under test actually did something.
#
# `by.alignment` is the canonical example: those counters fire only on a non-null alignment, so their
# absence means the lexicon silently did not load — which is exactly how a broken import once measured as
# a 9x win. A span closing proves a promise SETTLED, not that it RESOLVED; `finally { endSpan() }` times a
# rejection just as happily as a success.
preflight_no_errors() {
  local device="$1"; shift
  echo "==> Preflight 3/3: is the app in an error state?"
  local log
  log="$(adb_sh "logcat -d 2>\$null | Select-String -Pattern 'VMERR|Uncaught \(in promise|non-terminated string|UnableToResolve'")"
  if [[ -n "${log//[[:space:]]/}" ]]; then
    echo "    ✗ the app logged errors — refusing to measure it:"
    printf '%s\n' "$log" | head -6 | sed 's/^/      /'
    return 1
  fi
  echo "    ✓ no VMERR / uncaught rejections / unresolved modules"

  local counter
  for counter in "$@"; do
    if ! adb_sh "logcat -d 2>\$null | Select-String -Pattern '$counter'" | grep -q "$counter"; then
      echo "    ✗ expected counter '$counter' never fired — the feature under test did not run."
      echo "      Measuring now would report the cost of NOT doing the work. Refusing."
      return 1
    fi
    echo "    ✓ '$counter' present"
  done
}
