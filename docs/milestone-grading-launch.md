# Convert milestone grading — launch specification

Status: implementation candidate on `feature/milestone-grading`, not a production release. The readiness ceiling and connection-first experience follow George's direction. The individual weights and operational evidence gates below are proposed launch defaults, not previously approved pricing or industry standards.

## Customer experience

- An unconfirmed connection starts at zero and is labeled **Not started**, not a failing website.
- A successful server-side Analytics read earns the biggest single jump, even with no report or traffic. A saved property ID or application login alone is not a successful connection.
- A supported uploaded report earns equivalent entry credit but is labeled user-supplied data, not a live Analytics connection.
- Readiness can reach 70 with zero traffic or conversions. Further points require measured activity and supporting context. The maximum is 99; there is no perfect grade.
- Present three incomplete milestones, pin the first priority and rotate the other options on request. Each offers an actual local DIY guide and optional task-specific email help from George.
- Celebrate newly completed milestones with a message and confetti; respect reduced motion. Do not celebrate existing progress on a first visit or repeatedly reward reconnecting.

## Proposed launch-v1 point allocation

| Milestone | Available points | Completion evidence |
|---|---:|---|
| Connect website data | 40 | Successful server acquisition bound to the saved GA4 property, or a supported saved upload. |
| Choose the intended action | 5 | Owner-defined conversion type or intended action. |
| Set the monthly goal | 5 | A positive monthly target and primary goal. Unknown targets do not prevent saving/onboarding. |
| Understand conversion value | 5 | Positive owner-supplied value; estimates must be understood as estimates, not measured revenue. |
| Configure named events | 5 | Named key events and owner-reported configured status. |
| Test the journey | 5 | Dated owner-reported passed check describing submission, receipt and recording. |
| Record and review inquiries | 5 | Owner-described process; a synthetic example can establish readiness before real inquiries arrive. |
| Establish recorded activity | 5 | Full readiness, valid dates, at least 100 sessions and 5 recorded events. |
| Progress toward monthly goal | 8 | Same gate plus a complete calendar month; proportional credit for recorded goal progress. |
| Meet an owner event-ratio target | 8 | Same gate, a positive owner target and compatible event/session counts. |
| Learn from comparable periods | 4 | An earlier, nonoverlapping equal-length period with recorded ratio improvement. Earlier counts are owner-supplied. |
| Document an improvement | 4 | Supporting period improvement plus a dated, documented improved outcome within the evaluated period. |

Readiness maximum: 70. Results maximum: 29. Overall maximum: 99. Points are additive and visible; no hidden penalty/cap arithmetic. A lower score under a new rule version is not evidence that a business declined.

The results sample gate is an operational launch policy, not statistical significance or an industry benchmark. Recorded events are not automatically unique inquiries, booked customers or revenue. Bounce and raw traffic volume alone do not earn high grades. Deeper industry comparisons and questionnaire expansion remain post-launch work.

## Storage and trust boundaries

- No schema migration, new dependency or plan entitlement change is required.
- Typed owner readiness evidence is stored in one bounded versioned block in the existing `tracking_notes` column. Ordinary notes remain intact and machine metadata is hidden from normal display.
- A separate first-line connection marker is written only after successful server acquisition. Client create strips supplied markers; client edits preserve only server evidence for the same property. A property change invalidates that evidence.
- Connection checks use existing auth/ownership/approval and durable sync throttles, bounded read-only Analytics calls, and no report-generation allowance. Provider errors do not mint proof.
- Existing reports without provenance remain unverified until a connection check, sync or fresh supported acquisition establishes evidence. Existing records are not deleted or backfilled with invented provenance.
- Scores are recalculated from current saved setup and the selected report's metrics. Existing saved AI summaries are not regenerated automatically and may reflect the previous rubric. New prompts use the shared grading engine and distinguish evidence sources.
- Celebration history stores only milestone IDs, scoped by rule version, account and website, in this browser. It is not a durable cross-device achievement ledger. Clearing/denying browser storage does not change the grade.

## Known launch constraints requiring product review

- The 40-point connection award, six equal readiness allocations and results gates need George's review before production rollout.
- Monthly-goal results credit is withheld for rolling/partial/custom periods rather than misrepresenting them as a complete month. Existing date-range entitlements are unchanged; review this limitation for free-tier customers before launch.
- Numeric goals and positive monetary value are optional for onboarding but required for those particular readiness points in this draft. Learning goals/nonmonetary conversion journeys need a later applicability rule if they should also reach full readiness.
- Tutorials are concise text walkthroughs, not a full training hub or provider-specific implementation service. Contact links open email; no booking, price or free-support commitment is implied.
- Hosted Analytics, production auth, live data writes and actual AI prose require separate deployment acceptance. Local fixtures do not prove them.

## Release gates

1. Automated tests, TypeScript, changed-source lint and a production build with explicit local fixture configuration.
2. Independent review of the complete diff, including new files; fix blocking findings.
3. Local browser checks for rotation, guide/help links, connection transition, confetti/reload behavior, reduced motion and mobile layout using isolated synthetic fixtures.
4. George reviews the milestone allocation and authorizes a production merge/deployment separately.
5. After an approved deployment: verify exact remote commit, login, original records/ownership, connection check, saved setup, reports/print and next-step behavior on the real host. Do not spend real provider or payment calls without scope.
