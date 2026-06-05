/**
 * Agent Settings Detection — E2E tests.
 *
 * Covers: LocalAgents component rendering, CLI agent detection,
 * Gemini presence, agent status, PresetManagement sync, refresh.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { goToSettings, expectUrlContains, expectBodyContainsAny, settingsSiderItemById } from '../helpers';

const DETECTED_AGENT_GRID = '.grid.grid-cols-2.gap-10px.px-16px';

function detectedAgentCards(page: Page) {
  return page.locator(DETECTED_AGENT_GRID).first().locator(':scope > div');
}

async function expectDetectedAgentCardContains(page: Page, namePattern: RegExp): Promise<void> {
  const grid = page.locator(DETECTED_AGENT_GRID).first();
  await expect(grid).toBeVisible({ timeout: 8_000 });
  await expect(detectedAgentCards(page).filter({ hasText: namePattern }).first()).toBeVisible({ timeout: 8_000 });
}

test.describe('Agent Settings Detection', () => {
  test('LocalAgents page renders', async ({ page }) => {
    await goToSettings(page, 'agent');
    await expectUrlContains(page, 'agent');
    await expectBodyContainsAny(page, ['Agent', 'agent', '助手', '代理']);
  });

  test('detected CLI agents displayed', async ({ page }) => {
    await goToSettings(page, 'agent');

    // At least one detected agent card should be visible in the detected-agent grid.
    // AgentCard has no stable test id, so scope text matching to direct card children
    // of the LocalAgents detected grid rather than the settings page body.
    await expectDetectedAgentCardContains(page, /Claude|Codex|Gemini|ByteTensor|OpenCode|Qwen/);
  });

  test('Gemini agent is present in detected list', async ({ page }) => {
    await goToSettings(page, 'agent');

    // Gemini or ByteTensor CLI should be in the detected-agent cards, not static page copy.
    await expectDetectedAgentCardContains(page, /Gemini|gemini|ByteTensor/);
  });

  test('agent settings page has sidebar navigation item', async ({ page }) => {
    await goToSettings(page, 'agent');

    const siderItem = page.locator(settingsSiderItemById('agent')).first();
    await expect(siderItem).toBeVisible({ timeout: 8_000 });
  });

  test('preset management section is visible', async ({ page }) => {
    await goToSettings(page, 'agent');

    // The agent settings page includes preset management area
    // Look for text indicating presets or assistants
    await expectBodyContainsAny(page, [
      'Preset',
      'preset',
      'Custom',
      'custom',
      '预设',
      '自定义',
      'Assistants',
      'assistants',
      '助手',
    ]);
  });

  test('detected agents section refreshes without error', async ({ page }) => {
    await goToSettings(page, 'agent');

    // Navigate away and back to trigger a refresh
    await goToSettings(page, 'about');
    await goToSettings(page, 'agent');

    // Page should still render correctly
    await expectBodyContainsAny(page, ['Agent', 'agent', '助手', '代理']);
    const agentGrid = page.locator('.grid');
    await expect(agentGrid.first()).toBeVisible({ timeout: 8_000 });
  });
});
