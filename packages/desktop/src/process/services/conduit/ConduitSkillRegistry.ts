/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConduitPatchFile, ConduitSkillMetadata } from '@/common/types/conduitDelivery';

export type ConduitDeliverySkill = ConduitSkillMetadata & {
  matches(requirement: string): boolean;
  buildPatches(): ConduitPatchFile[];
  buildPlan(): string[];
};

export class ConduitSkillRegistry {
  readonly #skills: ConduitDeliverySkill[];

  constructor(skills: ConduitDeliverySkill[]) {
    this.#skills = [...skills];
  }

  listSkills(): ConduitSkillMetadata[] {
    return this.#skills.map(
      ({ matches: _matches, buildPatches: _buildPatches, buildPlan: _buildPlan, ...metadata }) => metadata
    );
  }

  selectSkill(requirement: string): ConduitDeliverySkill | undefined {
    return this.#skills.find((skill) => skill.matches(requirement));
  }
}
