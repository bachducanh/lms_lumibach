export type RubricLevelData = {
  id: string;
  label: string;
  points: number;
  description: string | null;
  position: number;
};

export type RubricCriterionData = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  levels: RubricLevelData[];
};

export type RubricData = {
  id: string;
  assignmentId: string | null;
  codeExerciseId: string | null;
  criteria: RubricCriterionData[];
};

export type RubricGradeSelection = {
  criterionId: string;
  levelId: string;
};
