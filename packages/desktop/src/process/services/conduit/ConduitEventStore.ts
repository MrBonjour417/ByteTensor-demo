/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { appendFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import type { ConduitDeliveryEvent } from '@/common/types/conduitDelivery';

type ConduitEventStoreOptions = {
  directory: string;
};

export class ConduitEventStore {
  readonly #filePath: string;

  constructor(options: ConduitEventStoreOptions) {
    this.#filePath = path.join(options.directory, 'conduit-delivery-events.jsonl');
  }

  async append(event: ConduitDeliveryEvent): Promise<void> {
    await mkdir(path.dirname(this.#filePath), { recursive: true });
    await appendFile(this.#filePath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  async list(runId?: string): Promise<ConduitDeliveryEvent[]> {
    let content = '';
    try {
      content = await readFile(this.#filePath, 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }

    const events: ConduitDeliveryEvent[] = [];
    for (const line of content.split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ConduitDeliveryEvent;
      if (!runId || event.runId === runId) events.push(event);
    }
    return events;
  }
}
