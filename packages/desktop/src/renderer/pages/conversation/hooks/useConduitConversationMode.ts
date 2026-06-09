/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { isConduitCommand } from '@/common/chat/conduitCommands';
import type { ConduitSessionState } from '@/common/types/conduitDelivery';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UseConduitConversationModeOptions = {
  conversationId?: string;
  workspacePath?: string;
};

type UseConduitConversationModeResult = {
  session?: ConduitSessionState;
  isConduitModeActive: boolean;
  handleConduitInput(message: string): Promise<boolean>;
};

const ACTIVE_STATUSES = new Set<ConduitSessionState['status']>([
  'active_collecting_pm_input',
  'clarifying',
  'ready_to_confirm',
  'ready_to_run',
  'running',
  'failed',
  'paused',
]);

export function useConduitConversationMode(
  options: UseConduitConversationModeOptions
): UseConduitConversationModeResult {
  const { conversationId, workspacePath } = options;
  const [session, setSession] = useState<ConduitSessionState | undefined>();
  const sessionMutationGenerationRef = useRef(0);
  const [isSessionLookupPending, setIsSessionLookupPending] = useState(false);
  const currentConversationIdRef = useRef(conversationId);
  currentConversationIdRef.current = conversationId;

  useEffect(() => {
    if (!conversationId) {
      sessionMutationGenerationRef.current += 1;
      setSession(undefined);
      setIsSessionLookupPending(false);
      return;
    }

    let cancelled = false;
    sessionMutationGenerationRef.current += 1;
    const loadGeneration = sessionMutationGenerationRef.current;
    setSession(undefined);
    setIsSessionLookupPending(true);
    void ipcBridge.conduitDelivery.getSessionState
      .invoke({ conversationId })
      .then((nextSession) => {
        if (!cancelled && sessionMutationGenerationRef.current === loadGeneration) {
          setSession(nextSession);
        }
      })
      .catch((error) => {
        console.error('[useConduitConversationMode] Failed to load session:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsSessionLookupPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    return ipcBridge.conduitDelivery.sessionChanged.on((nextSession) => {
      if (nextSession.conversationId !== conversationId) {
        return;
      }
      sessionMutationGenerationRef.current += 1;
      setSession(nextSession);
    });
  }, [conversationId]);

  const isConduitModeActive = useMemo(() => {
    return session ? ACTIVE_STATUSES.has(session.status) : false;
  }, [session]);

  const handleConduitInput = useCallback(
    async (message: string): Promise<boolean> => {
      if (!conversationId) {
        return false;
      }
      if (!isConduitCommand(message) && !isConduitModeActive && !isSessionLookupPending) {
        return false;
      }

      const result = await ipcBridge.conduitDelivery.handleSessionInput.invoke({
        conversationId,
        input: message,
        workspacePath,
      });
      if (currentConversationIdRef.current !== conversationId) {
        return false;
      }
      if (
        result.session &&
        currentConversationIdRef.current === conversationId &&
        result.session.conversationId === conversationId
      ) {
        sessionMutationGenerationRef.current += 1;
        setSession(result.session);
      }
      return result.handled;
    },
    [conversationId, isConduitModeActive, isSessionLookupPending, workspacePath]
  );

  return { session, isConduitModeActive, handleConduitInput };
}
