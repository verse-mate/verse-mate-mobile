#!/usr/bin/env bash
# Auto-rotate hygiene for anything that drives the physical phone.
#
# Source this AFTER defining `adb_sh` (the one-arg "run this adb subcommand" helper each capture script
# already has), then call `rotation_guard_install` once. It enforces exactly one invariant:
#
#     auto-rotate is OFF when we exit — however we exit (success, die, Ctrl-C, timeout).
#
# ## Why this file exists
#
# The phone is the operator's daily driver and he keeps auto-rotate deliberately OFF. Our tooling kept
# turning it back on, and he had to notice and complain twice before it was tracked down.
#
# The culprit is Maestro, not the phone. Maestro's Android driver is UIAutomator, and UIAutomator's session
# teardown calls `unfreezeRotation()`, which is implemented as
# `settings put system accelerometer_rotation 1`. So EVERY Maestro flow we run — every perf capture, every
# nav helper — silently re-enables auto-rotate as it tears down. `capture-atrace.sh` used to explain this as
# "`accelerometer_rotation` had flipped 0 -> 1 on its own ... auto-rotate gets re-enabled outside our
# control", i.e. it blamed the operator for our own side effect. It was us.
#
# ## Why the restore is unconditional, not "put back what we found"
#
# We never need auto-rotate for anything. Forcing an orientation is
# `accelerometer_rotation=0` + `user_rotation=<0|1|2|3>` — that rotates the screen *with auto-rotate off*,
# which is exactly what the portrait lock already does. There is no capture that requires the accelerometer.
#
# So this restores to 0, always. The earlier attempt (`cap3.ps1`) read the value at startup and put that
# same value back at the end — which meant that once one run leaked a 1, the next run read 1, "restored" 1,
# and the pollution became permanent. Save-and-restore is the wrong pattern for a setting that only ever has
# one correct value here.

# Force auto-rotate off. Never fails the caller — this is cleanup, and masking a real error behind a
# rotation-write failure would be worse than leaving the setting wrong.
rotation_autorotate_off() {
  adb_sh 'shell settings put system accelerometer_rotation 0' >/dev/null 2>&1 || true
}

# Force an orientation WITHOUT enabling the accelerometer. 0=portrait 1=landscape 2=portrait-flipped
# 3=landscape-flipped. `user_rotation` is only honoured while `accelerometer_rotation` is 0, so the order
# here matters: disable first, then rotate.
rotation_force() {
  local rot="${1:-0}"
  adb_sh 'shell settings put system accelerometer_rotation 0' >/dev/null 2>&1 || true
  adb_sh "shell settings put system user_rotation $rot" >/dev/null 2>&1 || true
}

# Install the exit trap. Idempotent-ish: calling it twice just re-registers the same handler.
#
# INT/TERM are included on purpose — a capture that is interrupted (or killed by an outer `timeout`) is
# precisely the case where the old code leaked the setting, because the restore lived at the bottom of the
# happy path.
rotation_guard_install() {
  trap 'rotation_autorotate_off' EXIT INT TERM
}
