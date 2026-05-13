import type { FormSpec } from "./types"

import squat from "../../data/form-specs/squat.json"
import pushup from "../../data/form-specs/pushup.json"
import plank from "../../data/form-specs/plank.json"
import lunge from "../../data/form-specs/lunge.json"
import deadlift from "../../data/form-specs/deadlift.json"
import rdl from "../../data/form-specs/rdl.json"
import bicep_curl from "../../data/form-specs/bicep_curl.json"
import shoulder_press from "../../data/form-specs/shoulder_press.json"
import jumping_jacks from "../../data/form-specs/jumping_jacks.json"
import high_knees from "../../data/form-specs/high_knees.json"
import crunch from "../../data/form-specs/crunch.json"

import bench_press from "../../data/form-specs/bench_press.json"
import incline_bench_press from "../../data/form-specs/incline_bench_press.json"
import dumbbell_row from "../../data/form-specs/dumbbell_row.json"
import barbell_row from "../../data/form-specs/barbell_row.json"
import lat_pulldown from "../../data/form-specs/lat_pulldown.json"
import pull_up from "../../data/form-specs/pull_up.json"
import chin_up from "../../data/form-specs/chin_up.json"
import dip from "../../data/form-specs/dip.json"
import overhead_tricep_extension from "../../data/form-specs/overhead_tricep_extension.json"
import hammer_curl from "../../data/form-specs/hammer_curl.json"
import lateral_raise from "../../data/form-specs/lateral_raise.json"
import front_raise from "../../data/form-specs/front_raise.json"
import face_pull from "../../data/form-specs/face_pull.json"
import reverse_fly from "../../data/form-specs/reverse_fly.json"
import leg_press from "../../data/form-specs/leg_press.json"
import leg_extension from "../../data/form-specs/leg_extension.json"
import leg_curl from "../../data/form-specs/leg_curl.json"
import romanian_split_squat from "../../data/form-specs/romanian_split_squat.json"
import bulgarian_split_squat from "../../data/form-specs/bulgarian_split_squat.json"
import goblet_squat from "../../data/form-specs/goblet_squat.json"
import front_squat from "../../data/form-specs/front_squat.json"
import hip_thrust from "../../data/form-specs/hip_thrust.json"
import glute_bridge from "../../data/form-specs/glute_bridge.json"
import calf_raise from "../../data/form-specs/calf_raise.json"
import step_up from "../../data/form-specs/step_up.json"
import kettlebell_swing from "../../data/form-specs/kettlebell_swing.json"
import sit_up from "../../data/form-specs/sit_up.json"
import bicycle_crunch from "../../data/form-specs/bicycle_crunch.json"
import dead_bug from "../../data/form-specs/dead_bug.json"
import mountain_climber from "../../data/form-specs/mountain_climber.json"
import burpee from "../../data/form-specs/burpee.json"
import bench_dip from "../../data/form-specs/bench_dip.json"
import side_plank from "../../data/form-specs/side_plank.json"
import bird_dog from "../../data/form-specs/bird_dog.json"
import wall_sit from "../../data/form-specs/wall_sit.json"
import jump_rope from "../../data/form-specs/jump_rope.json"
import box_jump from "../../data/form-specs/box_jump.json"
import farmer_carry from "../../data/form-specs/farmer_carry.json"

const SPECS: Record<string, FormSpec> = {
  squat: squat as FormSpec,
  pushup: pushup as FormSpec,
  plank: plank as FormSpec,
  lunge: lunge as FormSpec,
  deadlift: deadlift as FormSpec,
  rdl: rdl as FormSpec,
  bicep_curl: bicep_curl as FormSpec,
  shoulder_press: shoulder_press as FormSpec,
  jumping_jacks: jumping_jacks as FormSpec,
  high_knees: high_knees as FormSpec,
  crunch: crunch as FormSpec,
  bench_press: bench_press as FormSpec,
  incline_bench_press: incline_bench_press as FormSpec,
  dumbbell_row: dumbbell_row as FormSpec,
  barbell_row: barbell_row as FormSpec,
  lat_pulldown: lat_pulldown as FormSpec,
  pull_up: pull_up as FormSpec,
  chin_up: chin_up as FormSpec,
  dip: dip as FormSpec,
  overhead_tricep_extension: overhead_tricep_extension as FormSpec,
  hammer_curl: hammer_curl as FormSpec,
  lateral_raise: lateral_raise as FormSpec,
  front_raise: front_raise as FormSpec,
  face_pull: face_pull as FormSpec,
  reverse_fly: reverse_fly as FormSpec,
  leg_press: leg_press as FormSpec,
  leg_extension: leg_extension as FormSpec,
  leg_curl: leg_curl as FormSpec,
  romanian_split_squat: romanian_split_squat as FormSpec,
  bulgarian_split_squat: bulgarian_split_squat as FormSpec,
  goblet_squat: goblet_squat as FormSpec,
  front_squat: front_squat as FormSpec,
  hip_thrust: hip_thrust as FormSpec,
  glute_bridge: glute_bridge as FormSpec,
  calf_raise: calf_raise as FormSpec,
  step_up: step_up as FormSpec,
  kettlebell_swing: kettlebell_swing as FormSpec,
  sit_up: sit_up as FormSpec,
  bicycle_crunch: bicycle_crunch as FormSpec,
  dead_bug: dead_bug as FormSpec,
  mountain_climber: mountain_climber as FormSpec,
  burpee: burpee as FormSpec,
  bench_dip: bench_dip as FormSpec,
  side_plank: side_plank as FormSpec,
  bird_dog: bird_dog as FormSpec,
  wall_sit: wall_sit as FormSpec,
  jump_rope: jump_rope as FormSpec,
  box_jump: box_jump as FormSpec,
  farmer_carry: farmer_carry as FormSpec,
}

export function listSpecIds(): string[] {
  return Object.keys(SPECS).sort()
}

export function hasSpec(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPECS, id)
}

export function loadSpec(id: string): FormSpec | undefined {
  return SPECS[id]
}
