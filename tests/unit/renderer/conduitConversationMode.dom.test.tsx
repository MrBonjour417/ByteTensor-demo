/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConduitSessionCommandResult, ConduitSessionState } from '@/common/types/conduitDelivery';
import SendBox from '@/renderer/components/chat/SendBox';
import { useConduitConversationMode } from '@/renderer/pages/conversation/hooks/useConduitConversationMode';

const ipcMocks = vi.hoisted(() => ({
  getSessionState: vi.fn(),
  handleSessionInput: vi.fn(),
  sessionChangedHandlers: [] as Array<(session: ConduitSessionState) => void>,
  listWorkspaceFiles: vi.fn(),
}));

const previewMocks = vi.hoisted(() => ({
  setSendBoxHandler: vi.fn(),
  removeDomSnippet: vi.fn(),
  clearDomSnippets: vi.fn(),
}));

const btwMocks = vi.hoisted(() => ({
  ask: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conduitDelivery: {
      getSessionState: { invoke: ipcMocks.getSessionState },
      handleSessionInput: { invoke: ipcMocks.handleSessionInput },
      sessionChanged: {
        on: vi.fn((handler: (session: ConduitSessionState) => void) => {
          ipcMocks.sessionChangedHandlers.push(handler);
          return vi.fn();
        }),
      },
    },
    fs: {
      listWorkspaceFiles: { invoke: ipcMocks.listWorkspaceFiles },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => ({
    setSendBoxHandler: previewMocks.setSendBoxHandler,
    domSnippets: [],
    removeDomSnippet: previewMocks.removeDomSnippet,
    clearDomSnippets: previewMocks.clearDomSnippets,
  }),
}));

vi.mock('@/renderer/components/chat/BtwOverlay', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/chat/BtwOverlay/useBtwCommand', () => ({
  useBtwCommand: () => ({
    answer: '',
    ask: btwMocks.ask,
    dismiss: btwMocks.dismiss,
    isLoading: false,
    isOpen: false,
    question: '',
  }),
}));

vi.mock('@renderer/hooks/file/useConversationExport', () => ({
  useConversationExport: () => ({
    step: 'closed',
    activeIndex: 0,
    filename: '',
    loading: false,
    menuItems: [],
    isOpen: false,
    pathPreview: '',
    openExportFlow: vi.fn(),
    closeExportFlow: vi.fn(),
    showMenu: vi.fn(),
    setFilename: vi.fn(),
    setActiveIndex: vi.fn(),
    onSelectMenuItem: vi.fn(),
    handleKeyDown: vi.fn(() => false),
    submitFilename: vi.fn(),
  }),
}));

vi.mock('@renderer/hooks/file/useDragUpload', () => ({
  useDragUpload: () => ({ isFileDragging: false, dragHandlers: {} }),
}));

vi.mock('@renderer/hooks/file/usePasteService', () => ({
  usePasteService: () => ({ onPaste: vi.fn(), onFocus: vi.fn() }),
}));

vi.mock('@renderer/hooks/file/useAbortUploadsOnConversationChange', () => ({
  useAbortUploadsOnConversationChange: vi.fn(),
}));

vi.mock('@renderer/components/media/UploadProgressBar', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/chat/SpeechInputButton', () => ({
  default: () => null,
}));

vi.mock('@/renderer/hooks/chat/useInputFocusRing', () => ({
  useInputFocusRing: () => ({
    activeBorderColor: 'rgb(var(--primary-6))',
    inactiveBorderColor: 'var(--color-border-2)',
    activeShadow: 'none',
  }),
}));

function createSession(status: ConduitSessionState['status'], conversationId = 'conversation-1'): ConduitSessionState {
  return {
    sessionId: 'session-1',
    conversationId,
    status,
    createdAt: 1,
    updatedAt: 2,
    pmInputs: [],
    clarificationQuestions: [],
  };
}

const Probe: React.FC = () => {
  const { session, handleConduitInput } = useConduitConversationMode({
    conversationId: 'conversation-1',
    workspacePath: 'D:/conduit',
  });
  const [lastHandled, setLastHandled] = useState('unset');

  const send = async (message: string) => {
    setLastHandled(String(await handleConduitInput(message)));
  };

  return (
    <div>
      <div data-testid='status'>{session?.status ?? 'none'}</div>
      <div data-testid='last-handled'>{lastHandled}</div>
      <button onClick={() => void send('/conduit 文章详情页展示字数和预计阅读时间')}>send</button>
      <button onClick={() => void send('normal text')}>reply</button>
    </div>
  );
};

const SwitchProbe: React.FC = () => {
  const [conversationId, setConversationId] = useState('conversation-1');
  const { session, handleConduitInput } = useConduitConversationMode({
    conversationId,
    workspacePath: 'D:/conduit',
  });
  const [lastHandled, setLastHandled] = useState('unset');

  const send = async () => {
    setLastHandled(String(await handleConduitInput('/conduit 文章详情页展示字数和预计阅读时间')));
  };

  return (
    <div>
      <div data-testid='switch-status'>{session?.status ?? 'none'}</div>
      <div data-testid='switch-handled'>{lastHandled}</div>
      <button onClick={() => void send()}>send stale</button>
      <button onClick={() => setConversationId('conversation-2')}>switch</button>
    </div>
  );
};

describe('useConduitConversationMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcMocks.sessionChangedHandlers.length = 0;
    ipcMocks.getSessionState.mockResolvedValue(undefined);
    ipcMocks.handleSessionInput.mockResolvedValue({ handled: false, entries: [] });
    ipcMocks.listWorkspaceFiles.mockResolvedValue([]);
  });

  it('loads and subscribes to the conversation session state', async () => {
    ipcMocks.getSessionState.mockResolvedValue(createSession('clarifying'));

    render(<Probe />);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('clarifying'));
    expect(ipcMocks.getSessionState).toHaveBeenCalledWith({ conversationId: 'conversation-1' });

    ipcMocks.sessionChangedHandlers.at(-1)?.(createSession('running', 'conversation-2'));
    expect(screen.getByTestId('status')).toHaveTextContent('clarifying');

    ipcMocks.sessionChangedHandlers.at(-1)?.(createSession('paused'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('paused'));
  });

  it('routes a conduit command to IPC and stores returned session state', async () => {
    ipcMocks.handleSessionInput.mockResolvedValue({
      handled: true,
      entries: [],
      session: {
        ...createSession('ready_to_run'),
        pmInputs: ['文章详情页展示字数和预计阅读时间'],
      },
    });

    render(<Probe />);
    await userEvent.click(screen.getByText('send'));

    expect(ipcMocks.handleSessionInput).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      input: '/conduit 文章详情页展示字数和预计阅读时间',
      workspacePath: 'D:/conduit',
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready_to_run'));
    expect(screen.getByTestId('last-handled')).toHaveTextContent('true');
  });

  it('does not consume normal input when there is no active session and no command', async () => {
    render(<Probe />);

    await userEvent.click(screen.getByText('reply'));

    expect(ipcMocks.handleSessionInput).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('none');
    await waitFor(() => expect(screen.getByTestId('last-handled')).toHaveTextContent('false'));
  });

  it('routes normal input while session lookup is still pending', async () => {
    const pendingSession = Promise.withResolvers<ConduitSessionState | undefined>();
    ipcMocks.getSessionState.mockReturnValue(pendingSession.promise);
    ipcMocks.handleSessionInput.mockResolvedValue({ handled: true, entries: [], session: createSession('clarifying') });

    render(<Probe />);
    await userEvent.click(screen.getByText('reply'));

    expect(ipcMocks.handleSessionInput).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      input: 'normal text',
      workspacePath: 'D:/conduit',
    });
    await waitFor(() => expect(screen.getByTestId('last-handled')).toHaveTextContent('true'));

    pendingSession.resolve(undefined);
  });

  it('clears previous conversation session while loading the next one', async () => {
    const pendingSession = Promise.withResolvers<ConduitSessionState | undefined>();
    ipcMocks.getSessionState.mockResolvedValueOnce(createSession('clarifying')).mockReturnValueOnce(pendingSession.promise);

    render(<SwitchProbe />);
    await waitFor(() => expect(screen.getByTestId('switch-status')).toHaveTextContent('clarifying'));

    await userEvent.click(screen.getByText('switch'));
    await waitFor(() => expect(ipcMocks.getSessionState).toHaveBeenCalledWith({ conversationId: 'conversation-2' }));

    expect(screen.getByTestId('switch-status')).toHaveTextContent('none');

    pendingSession.resolve(undefined);
  });

  it('ignores stale Conduit input results after switching conversations', async () => {
    const pendingResult = Promise.withResolvers<ConduitSessionCommandResult>();
    ipcMocks.handleSessionInput.mockReturnValue(pendingResult.promise);

    render(<SwitchProbe />);
    await userEvent.click(screen.getByText('send stale'));
    await waitFor(() => expect(ipcMocks.handleSessionInput).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByText('switch'));
    await waitFor(() => expect(ipcMocks.getSessionState).toHaveBeenCalledWith({ conversationId: 'conversation-2' }));

    await act(async () => {
      pendingResult.resolve({ handled: true, entries: [], session: createSession('ready_to_run', 'conversation-1') });
      await pendingResult.promise;
    });

    expect(screen.getByTestId('switch-status')).toHaveTextContent('none');
    await waitFor(() => expect(screen.getByTestId('switch-handled')).toHaveTextContent('false'));
  });
});

describe('SendBox Conduit interception', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    btwMocks.ask.mockReset();
    btwMocks.dismiss.mockReset();
  });

  it('clears the draft without normal send when Conduit handles input', async () => {
    const onConduitInput = vi.fn().mockResolvedValue(true);
    const onChange = vi.fn();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<SendBox value='normal text' onChange={onChange} onSend={onSend} onConduitInput={onConduitInput} />);

    await userEvent.click(screen.getByTestId('sendbox-send-btn'));

    await waitFor(() => expect(onConduitInput).toHaveBeenCalledWith('normal text'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('continues through normal send when Conduit does not handle input', async () => {
    const onConduitInput = vi.fn().mockResolvedValue(false);
    const onChange = vi.fn();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<SendBox value='normal text' onChange={onChange} onSend={onSend} onConduitInput={onConduitInput} />);

    await userEvent.click(screen.getByTestId('sendbox-send-btn'));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('normal text'));
    expect(onConduitInput.mock.invocationCallOrder[0]).toBeLessThan(onSend.mock.invocationCallOrder[0]);
  });

  it('keeps side-question slash commands out of Conduit interception', async () => {
    const onConduitInput = vi.fn().mockResolvedValue(true);
    const onChange = vi.fn();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<SendBox value='/btw explain this' onChange={onChange} onSend={onSend} onConduitInput={onConduitInput} enableBtw />);

    await userEvent.click(screen.getByTestId('sendbox-send-btn'));

    expect(btwMocks.ask).toHaveBeenCalledWith('explain this');
    expect(onConduitInput).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('ignores duplicate sends while Conduit interception is pending', async () => {
    const pending = Promise.withResolvers<boolean>();
    const onConduitInput = vi.fn().mockReturnValue(pending.promise);
    const onChange = vi.fn();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<SendBox value='normal text' onChange={onChange} onSend={onSend} onConduitInput={onConduitInput} />);

    await userEvent.click(screen.getByTestId('sendbox-send-btn'));
    await userEvent.click(screen.getByTestId('sendbox-send-btn'));

    expect(onConduitInput).toHaveBeenCalledTimes(1);

    pending.resolve(true);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(''));
  });

  it('does not intercept empty drafts for Conduit', () => {
    const onConduitInput = vi.fn().mockResolvedValue(true);
    const onChange = vi.fn();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<SendBox value='' onChange={onChange} onSend={onSend} onConduitInput={onConduitInput} />);

    fireEvent.keyDown(screen.getByTestId('sendbox-input'), { key: 'Enter', code: 'Enter' });

    expect(onConduitInput).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('preserves drafts typed while Conduit interception is pending', async () => {
    const pending = Promise.withResolvers<boolean>();
    const onConduitInput = vi.fn().mockReturnValue(pending.promise);
    const onSend = vi.fn().mockResolvedValue(undefined);

    const ControlledSendBox: React.FC = () => {
      const [draft, setDraft] = useState('first request');
      return (
        <div>
          <div data-testid='draft'>{draft}</div>
          <button onClick={() => setDraft('second draft')}>type next</button>
          <SendBox value={draft} onChange={setDraft} onSend={onSend} onConduitInput={onConduitInput} />
        </div>
      );
    };

    render(<ControlledSendBox />);

    await userEvent.click(screen.getByTestId('sendbox-send-btn'));
    await waitFor(() => expect(onConduitInput).toHaveBeenCalledWith('first request'));
    await userEvent.click(screen.getByText('type next'));

    await act(async () => {
      pending.resolve(true);
      await pending.promise;
    });

    expect(screen.getByTestId('draft')).toHaveTextContent('second draft');
    expect(onSend).not.toHaveBeenCalled();
  });
});
