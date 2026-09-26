import type { MuscleGroup } from "@musclemap/core";

export const bodyMaps = ["male", "female"] as const;
export type BodyMap = (typeof bodyMaps)[number];

export function normaliseBodyMap(value: unknown): BodyMap {
  return typeof value === "string" && bodyMaps.includes(value as BodyMap)
    ? (value as BodyMap)
    : "male";
}

export const muscleRegions: readonly MuscleGroup[] = [
  "CHEST",
  "BACK_UPPER",
  "BACK_LOWER",
  "TRAPEZIUS",
  "RHOMBOIDS",
  "LATS",
  "SHOULDERS_FRONT",
  "SHOULDERS_SIDE",
  "SHOULDERS_REAR",
  "BICEPS",
  "TRICEPS",
  "FOREARMS",
  "CORE",
  "OBLIQUES",
  "GLUTES",
  "QUADS",
  "HAMSTRINGS",
  "CALVES",
  "HIP_FLEXORS",
  "ADDUCTORS",
  "ABDUCTORS",
];

const allRegions = new Set<MuscleGroup>(muscleRegions);

const regionAliases: Record<string, MuscleGroup[]> = {
  chest: ["CHEST"],
  "upper chest": ["CHEST"],
  "lower chest": ["CHEST"],
  "pectoralis major": ["CHEST"],
  "pectoralis minor": ["CHEST"],
  back: ["BACK_UPPER", "BACK_LOWER", "TRAPEZIUS", "RHOMBOIDS", "LATS"],
  lats: ["LATS"],
  "upper back": ["BACK_UPPER", "RHOMBOIDS"],
  rhomboids: ["RHOMBOIDS"],
  "teres major": ["BACK_UPPER", "LATS"],
  "lower back": ["BACK_LOWER"],
  "erector spinae": ["BACK_LOWER"],
  traps: ["TRAPEZIUS"],
  neck: ["TRAPEZIUS"],
  shoulders: ["SHOULDERS_FRONT", "SHOULDERS_SIDE", "SHOULDERS_REAR"],
  "front delts": ["SHOULDERS_FRONT"],
  "side delts": ["SHOULDERS_SIDE"],
  "rear delts": ["SHOULDERS_REAR"],
  "rotator cuff": ["SHOULDERS_REAR"],
  supraspinatus: ["SHOULDERS_REAR"],
  infraspinatus: ["SHOULDERS_REAR"],
  arms: ["BICEPS", "TRICEPS", "FOREARMS"],
  biceps: ["BICEPS"],
  brachialis: ["BICEPS"],
  brachioradialis: ["FOREARMS"],
  triceps: ["TRICEPS"],
  forearms: ["FOREARMS"],
  "wrist flexors": ["FOREARMS"],
  "wrist extensors": ["FOREARMS"],
  grip: ["FOREARMS"],
  core: ["CORE", "OBLIQUES"],
  "rectus abdominis": ["CORE"],
  obliques: ["OBLIQUES"],
  "transverse abdominis": ["CORE"],
  "serratus anterior": ["OBLIQUES", "LATS"],
  legs: ["GLUTES", "QUADS", "HAMSTRINGS", "CALVES"],
  quadriceps: ["QUADS"],
  "rectus femoris": ["QUADS"],
  "vastus lateralis": ["QUADS"],
  "vastus medialis": ["QUADS"],
  hamstrings: ["HAMSTRINGS"],
  "biceps femoris": ["HAMSTRINGS"],
  semitendinosus: ["HAMSTRINGS"],
  semimembranosus: ["HAMSTRINGS"],
  glutes: ["GLUTES"],
  "gluteus maximus": ["GLUTES"],
  "gluteus medius": ["GLUTES", "ABDUCTORS"],
  "gluteus minimus": ["GLUTES", "ABDUCTORS"],
  "hip flexors": ["HIP_FLEXORS"],
  "hip adductors": ["ADDUCTORS"],
  "hip abductors": ["ABDUCTORS"],
  "tensor fasciae latae": ["ABDUCTORS"],
  calves: ["CALVES"],
  gastrocnemius: ["CALVES"],
  soleus: ["CALVES"],
  "tibialis anterior": ["CALVES"],
};

export function resolveMuscleRegions(
  muscles: readonly string[],
): Set<MuscleGroup> {
  if (muscles.some((muscle) => muscle.trim().toLowerCase() === "full body"))
    return new Set(allRegions);

  const regions = new Set<MuscleGroup>();
  for (const muscle of muscles) {
    for (const region of regionAliases[muscle.trim().toLowerCase()] ?? [])
      regions.add(region);
  }
  return regions;
}
