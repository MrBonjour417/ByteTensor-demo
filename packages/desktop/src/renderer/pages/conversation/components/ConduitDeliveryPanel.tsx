/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ConduitDeliveryRunState, ConduitSessionState } from '@/common/types/conduitDelivery';
import { Alert, Button, Drawer, Input, Space, Tag, Timeline, Typography } from '@arco-design/web-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const defaultRequirement = 'show article word count and estimated reading time on the article detail page';

const failedVerificationText = (state: ConduitDeliveryRunState | undefined): string | undefined => {
  const failed = state?.verificationResults.find((result) => result.status === 'failed');
  return failed?.stderr || failed?.stdout || state?.error;
};

const ConduitDeliveryPanel: React.FC<{ conversationId?: string; workspacePath?: string }> = ({
  conversationId,
  workspacePath,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sandboxPath, setSandboxPath] = useState(workspacePath ?? '');
  const [requirement, setRequirement] = useState(defaultRequirement);
  const [state, setState] = useState<ConduitDeliveryRunState | undefined>();
  const [session, setSession] = useState<ConduitSessionState | undefined>();
  const [isBinding, setIsBinding] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isCommandRunning, setIsCommandRunning] = useState(false);
  const sessionStatusRef = useRef<ConduitSessionState['status'] | undefined>(undefined);
  useEffect(() => {
    sessionStatusRef.current = undefined;
    setSession(undefined);
    setState(undefined);
    setOpen(false);
  }, [conversationId]);

  useEffect(() => {
    setSandboxPath(workspacePath ?? '');
  }, [workspacePath]);

  useEffect(() => {
    let cancelled = false;
    if (!conversationId) return undefined;

    void ipcBridge.conduitDelivery.getSessionState
      .invoke({ conversationId })
      .then((nextSession) => {
        if (cancelled || !nextSession || nextSession.conversationId !== conversationId) return;
        sessionStatusRef.current = nextSession.status;
        setSession(nextSession);
        setState(nextSession.runState);
        if (nextSession.status !== 'exited') setOpen(true);
      })
      .catch((error) => {
        console.error('[ConduitDeliveryPanel] Failed to load session:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    return ipcBridge.conduitDelivery.sessionChanged.on((nextSession) => {
      if (!conversationId || nextSession.conversationId !== conversationId) return;
      sessionStatusRef.current = nextSession.status;
      setSession(nextSession);
      setState(nextSession.runState);
      if (nextSession.status === 'exited') {
        setOpen(false);
        return;
      }
      setOpen(true);
    });
  }, [conversationId]);

  useEffect(() => {
    return ipcBridge.conduitDelivery.stateChanged.on((nextState) => {
      if (!conversationId || nextState.conversationId !== conversationId) return;
      if (sessionStatusRef.current === 'exited') return;
      setState(nextState);
      setOpen(true);
    });
  }, [conversationId]);

  const runState = state ?? session?.runState;
  const verificationFailure = useMemo(() => failedVerificationText(runState), [runState]);

  const applySession = (nextSession: ConduitSessionState) => {
    sessionStatusRef.current = nextSession.status;
    setSession(nextSession);
    setState(nextSession.runState);
    if (nextSession.status === 'exited') {
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  const runSessionCommand = async (command: '/conduit status' | '/conduit revise' | '/conduit exit') => {
    if (!conversationId) return;
    setIsCommandRunning(true);
    try {
      const result = await ipcBridge.conduitDelivery.handleSessionInput.invoke({
        conversationId,
        input: command,
        workspacePath: sandboxPath.trim() || undefined,
      });
      if (result.session) applySession(result.session);
    } finally {
      setIsCommandRunning(false);
    }
  };

  const replayVerify = async () => {
    if (!conversationId || !session?.activeRunId) return;
    setIsCommandRunning(true);
    try {
      const nextSession = await ipcBridge.conduitDelivery.replaySessionStage.invoke({
        conversationId,
        stage: 'verify',
      });
      applySession(nextSession);
    } finally {
      setIsCommandRunning(false);
    }
  };
  const bindSandbox = async () => {
    if (!sandboxPath.trim()) return;
    setIsBinding(true);
    try {
      await ipcBridge.conduitDelivery.bindSandbox.invoke({ path: sandboxPath.trim() });
    } finally {
      setIsBinding(false);
    }
  };

  const startRun = async () => {
    if (!conversationId) return;
    setIsRunning(true);
    try {
      const nextSession = await ipcBridge.conduitDelivery.confirmSessionRun.invoke({
        conversationId,
        sandboxPath: sandboxPath.trim() || undefined,
      });
      sessionStatusRef.current = nextSession.status;
      setSession(nextSession);
      setState(nextSession.runState);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Drawer
      width={420}
      title={t('conversation.conduitDelivery.title')}
      visible={open}
      onCancel={() => setOpen(false)}
      footer={null}
    >
      <Space direction='vertical' size='medium' className='w-full'>
        {session && (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.status')}</Typography.Title>
            <Tag color={session.status === 'succeeded' ? 'green' : session.status === 'failed' ? 'red' : 'blue'}>
              {session.status}
            </Tag>
          </div>
        )}
        {session?.clarificationQuestions.length ? (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.clarificationQuestions')}</Typography.Title>
            <Space direction='vertical' size='mini'>
              {session.clarificationQuestions.map((question) => (
                <Typography.Text key={question}>{question}</Typography.Text>
              ))}
            </Space>
          </div>
        ) : null}
        {runState?.modelMetrics?.length ? (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.metrics')}</Typography.Title>
            <Space direction='vertical' size='mini'>
              {runState.modelMetrics.map((metric) => (
                <div key={`${metric.provider}:${metric.model}:${metric.latencyMs}`}>
                  <Typography.Text className='block'>
                    {metric.provider}/{metric.model}: {metric.totalTokens ?? 0} tokens, {metric.latencyMs}ms
                  </Typography.Text>
                  {metric.error && <Typography.Text className='block'>{metric.error}</Typography.Text>}
                </div>
              ))}
            </Space>
          </div>
        ) : null}
        {session?.requirementDsl && (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.requirementDsl')}</Typography.Title>
            <Typography.Text className='block'>{session.requirementDsl.title}</Typography.Text>
            {session.requirementDsl.acceptanceCriteria.map((criterion) => (
              <Typography.Text key={criterion} className='block'>
                - {criterion}
              </Typography.Text>
            ))}
          </div>
        )}
        {session?.planSummary && (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.planSummary')}</Typography.Title>
            <Typography.Paragraph>{session.planSummary.summary}</Typography.Paragraph>
            {session.planSummary.targetFiles.map((file) => (
              <Typography.Text key={file} className='block'>
                {file}
              </Typography.Text>
            ))}
          </div>
        )}
        {runState?.status && (
          <Tag color={runState.status === 'succeeded' ? 'green' : runState.status === 'failed' ? 'red' : 'blue'}>
            {runState.status}
          </Tag>
        )}
        {session && (
          <Space wrap>
            <Button loading={isCommandRunning} onClick={() => void runSessionCommand('/conduit status')}>
              {t('conversation.conduitDelivery.actions.status')}
            </Button>
            <Button loading={isCommandRunning} onClick={() => void runSessionCommand('/conduit revise')}>
              {t('conversation.conduitDelivery.actions.revise')}
            </Button>
            <Button disabled={!session.activeRunId} loading={isCommandRunning} onClick={() => void replayVerify()}>
              {t('conversation.conduitDelivery.actions.replayVerify')}
            </Button>
            <Button status='danger' loading={isCommandRunning} onClick={() => void runSessionCommand('/conduit exit')}>
              {t('conversation.conduitDelivery.actions.exit')}
            </Button>
          </Space>
        )}
        {verificationFailure && (
          <Alert
            type='error'
            title={t('conversation.conduitDelivery.verificationFailed')}
            content={verificationFailure}
          />
        )}
        {runState?.stages.length ? (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.stageTimeline')}</Typography.Title>
            <Timeline>
              {runState.stages.map((stage) => (
                <Timeline.Item key={stage.stage} label={stage.status}>
                  <Typography.Text>{stage.stage}</Typography.Text>
                  {stage.message && <Typography.Paragraph className='m-0'>{stage.message}</Typography.Paragraph>}
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        ) : null}
        {runState?.changedFiles.length ? (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.changedFiles')}</Typography.Title>
            <Space direction='vertical' size='mini'>
              {runState.changedFiles.map((file) => (
                <Typography.Text key={file.path}>{file.path}</Typography.Text>
              ))}
            </Space>
          </div>
        ) : null}
        {runState?.verificationResults.length ? (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.verificationResults')}</Typography.Title>
            <Space direction='vertical' size='mini'>
              {runState.verificationResults.map((result) => (
                <Typography.Text key={result.id}>
                  {result.command} {result.args.join(' ')}: {result.status}
                </Typography.Text>
              ))}
            </Space>
          </div>
        ) : null}
        {runState?.summary ? (
          <div>
            <Typography.Title heading={6}>{t('conversation.conduitDelivery.prSummary')}</Typography.Title>
            <Typography.Text className='block'>{runState.summary.title}</Typography.Text>
            <Space direction='vertical' size='mini'>
              {runState.summary.manualCommands.map((command) => (
                <Typography.Text key={command}>{command}</Typography.Text>
              ))}
            </Space>
          </div>
        ) : null}
        <div>
          <Typography.Text className='block mb-6px'>
            {t('conversation.conduitDelivery.sandboxPathLabel')}
          </Typography.Text>
          <Input
            value={sandboxPath}
            placeholder={t('conversation.conduitDelivery.sandboxPathPlaceholder')}
            onChange={setSandboxPath}
          />
        </div>
        <Button type='primary' loading={isBinding} onClick={bindSandbox}>
          {t('conversation.conduitDelivery.bindSandbox')}
        </Button>
        <div>
          <Typography.Text className='block mb-6px'>
            {t('conversation.conduitDelivery.requirementLabel')}
          </Typography.Text>
          <Input.TextArea
            value={requirement}
            autoSize={{ minRows: 3, maxRows: 5 }}
            placeholder={t('conversation.conduitDelivery.requirementPlaceholder')}
            onChange={setRequirement}
          />
        </div>
        <Button type='primary' loading={isRunning} onClick={startRun}>
          {t('conversation.conduitDelivery.startRun')}
        </Button>
      </Space>
    </Drawer>
  );
};

export default ConduitDeliveryPanel;
