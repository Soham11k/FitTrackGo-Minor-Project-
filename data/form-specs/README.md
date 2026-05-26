# FormSpec JSON specs

Each JSON file in this folder is a `FormSpec` consumed by the generic
form-engine in [lib/form-engine](../../lib/form-engine). Author one JSON
per exercise — the engine reads it to produce form score, faults, and
rep phase transitions for the live AI Coach HUD.

Schema lives in [lib/form-engine/types.ts](../../lib/form-engine/types.ts).

## Conventions

- **Joint naming:** left/right separated. The engine averages where it makes
  sense (e.g. `knee_angle_avg`).
- **Angles:** degrees. The engine prefers 3D world coords when available,
  fallback to 2D image angles.
- **Y axis:** image-normalized, `0` = top of frame, `1` = bottom. So a
  higher knee = smaller `knee_y_avg`.
- **Penalty range:** 5 to 15 per rule. Total max penalty per spec should
  not exceed ~80 (a few rules can fire on a bad rep without zeroing
  the score, which kills feedback usefulness).
- **`loadType`:** one of `none` (cardio drills like jump rope),
  `bodyweight` (push-ups, plank, etc.), `external` (squat, deadlift,
  any barbell / dumbbell movement). UI uses this to decide whether to
  show the "Add load" chip in AI Coach.
- **`loadRelax`:** set on rules that should soften under heavy load
  (e.g. squat depth, deadlift knee range). Engine adds
  `addThresholdDeg` of tolerance to the comparison value when
  `loadKg / bodyWeightKg >= perXBodyweight`.
- **`hudAngles`:** optional. Surfaced by `coach-vision/hud-metrics`
  for the live overlay.

## Authoring prompt for new specs

When drafting a new spec with an LLM, feed it this template:

> You are authoring a JSON `FormSpec` for a fitness app. The schema lives at
> `lib/form-engine/types.ts`. The exercise is `<EXERCISE NAME>`. List the
> 3-5 most common form faults. Convert each to a `RuleDef`:
>   - `id`: `${exercise_id}.${kebab_fault}`
>   - `region`: `legs` | `arms` | `torso` | `core`
>   - `penalty`: integer 5..15 reflecting impact on safety/effectiveness
>   - `when`: a `Condition` referencing one or more `MetricId`s
>   - `feedback`: imperative coaching cue under ~10 words
>   - `loadRelax`: only when the rule depends on range-of-motion that
>     should soften under heavy load
> Define 2-3 phases (`bottom`, `top`, `concentric`) with `enterWhen`
> conditions on the primary metric. For static holds use
> `repPattern: "hold"` and a single `top` phase with `always: true`.

Always run `vitest run lib/form-engine` after adding a spec to confirm
the registry loads and the catalog test passes.

## User custom exercises (in-app)

End users can describe a movement in **AI Coach → Create custom exercise**.
The server generates a `FormSpec` via OpenAI, validates it, and stores it in
`user_custom_exercises`. At login / Coach tab focus, specs merge into the
runtime registry (`registerUserSpec`) — no change to `registry.ts` imports.

Custom ids use `custom_<slug>_<suffix>`. Coach sessions store
`exercise_spec_id` for replay fidelity.

Developer-built specs (this folder) remain the source of truth for shipped
movements; promote a popular user spec by copying JSON here and registering
it in `registry.ts` + `coach-exercise-catalog.ts`.

## Variant movements (e.g. push-up grips)

Clone an existing spec (for example [`pushup.json`](pushup.json)), change the
`id` and `displayName`, then tune thresholds on shared metrics such as
`wrist_spread_x`, `elbow_flare_ratio`, and `elbow_angle_avg` in
[`lib/form-engine/metrics.ts`](../../lib/form-engine/metrics.ts). Register the new file in
[`lib/form-engine/registry.ts`](../../lib/form-engine/registry.ts) and add the `specId` under the right family in
[`lib/coach-exercise-catalog.ts`](../../lib/coach-exercise-catalog.ts).
