# Triage Labels

The triage agent assigns exactly one readiness label per issue. This file maps those states to the label strings used in this repo's issue tracker.

| Label                | Meaning                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `needs-triage`       | Maintainer or triage agent needs to evaluate this issue                             |
| `ready-to-implement` | Behavior and scope are clear; anyone (contributor or agent) can pick this up        |
| `needs-discussion`   | Open product or technical questions; discuss on the issue before implementing       |
| `wontfix`            | Will not be actioned (human-applied)                                                |

Use `ready-to-implement` when the issue is clearly outlined and implementation can start without further product decisions.

Use `needs-discussion` for everything else: ambiguity, open design decisions, or uncertain fit. The triage comment should leave concrete clarifying questions so the discussion can start immediately.

Older labels (`ready-for-spec`, `ready-for-agent`, `needs-info`, `wait-to-implement`) are retired from the triage flow; `ready-for-spec` was renamed to `needs-discussion` and `ready-for-agent` to `ready-to-implement`.
