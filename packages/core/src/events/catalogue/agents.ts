/** Agent session, review and release topics. Producers: PAP-96, PAP-60, PAP-111, PAP-94, PAP-88. */
import { z } from 'zod';
import { defineTopic } from '../registry.js';
import {
  amountMinor,
  at,
  currency,
  errorCode,
  issueKey,
  key,
  nullableUuid,
  reasonCode,
  uuid,
} from './_shared.js';

export const agentSessionStarted = defineTopic(
  'agent.session.started',
  z.object({ sessionId: uuid, character: key, issueKey, model: key, principalId: uuid }),
  {
    description: 'A Claude builder session claimed an issue and started work.',
    producer: 'PAP-96 orchestrator',
    consumers: ['PAP-113 agent console', 'PAP-97 orchestrator', 'PAP-136 notifications'],
  },
);

export const agentSessionFinished = defineTopic(
  'agent.session.finished',
  z.object({
    sessionId: uuid,
    character: key,
    issueKey,
    outcome: z.enum(['done', 'partial', 'failed', 'cancelled']),
    durationMs: z.number().int().nonnegative(),
    spentMinor: amountMinor,
    currency,
  }),
  {
    description: 'A builder session ended; the spend and outcome are final.',
    producer: 'PAP-96 orchestrator',
    consumers: ['PAP-113 agent console', 'PAP-60 agent principals', 'PAP-97 orchestrator'],
  },
);

export const agentSessionBlocked = defineTopic(
  'agent.session.blocked',
  z.object({ sessionId: uuid, character: key, issueKey, blockedOn: key, reasonCode }),
  {
    description: 'A session cannot continue without a decision or a merged dependency.',
    producer: 'PAP-96 orchestrator',
    consumers: ['PAP-136 notifications', 'PAP-113 agent console'],
  },
);

export const agentQuotaExceeded = defineTopic(
  'agent.quota.exceeded',
  z.object({
    principalId: uuid,
    character: key.nullable(),
    quota: z.enum(['daily_spend', 'tokens', 'sessions', 'requests']),
    limit: z.number().nonnegative(),
    observed: z.number().nonnegative(),
    windowEndsAt: at,
  }),
  {
    description: 'An agent principal hit its cap and was throttled.',
    producer: 'PAP-60 agent principals',
    consumers: ['PAP-111 spend caps', 'PAP-136 notifications'],
  },
);

export const issueNeedsJustin = defineTopic(
  'issue.needs_justin',
  z.object({ issueKey, decisionKey: key, urgency: z.enum(['normal', 'blocking']), raisedBy: key }),
  {
    description: 'An issue needs the single human decision-maker; nothing else unblocks it.',
    producer: 'PAP-94 review flow',
    consumers: ['PAP-136 notifications', 'PAP-97 orchestrator'],
  },
);

export const reviewGateFailed = defineTopic(
  'review.gate_failed',
  z.object({ issueKey, gate: key, runId: uuid, attempt: z.number().int().positive(), errorCode }),
  {
    description: 'A review gate (lint, types, tests, security, a11y) failed for an issue.',
    producer: 'PAP-88 gates, via PAP-239 gate reports',
    consumers: ['PAP-136 notifications', 'PAP-97 orchestrator'],
  },
);

export const reviewReady = defineTopic(
  'review.ready',
  z.object({ issueKey, runId: uuid, commitSha: key, reviewerCharacter: key.nullable() }),
  {
    description: 'Every gate is green and the change is ready for review.',
    producer: 'PAP-88 gates',
    consumers: ['PAP-97 orchestrator', 'PAP-136 notifications'],
  },
);

export const releaseCandidate = defineTopic(
  'release.candidate',
  z.object({
    releaseId: uuid,
    version: key,
    commitSha: key,
    channel: z.enum(['alpha', 'beta', 'stable']),
    previousReleaseId: nullableUuid,
  }),
  {
    description: 'A release candidate was cut from a green main.',
    producer: 'PAP-97 orchestrator',
    consumers: ['PAP-133 changelog', 'PAP-136 notifications'],
  },
);

export const agentTopics = {
  'agent.session.started': agentSessionStarted,
  'agent.session.finished': agentSessionFinished,
  'agent.session.blocked': agentSessionBlocked,
  'agent.quota.exceeded': agentQuotaExceeded,
  'issue.needs_justin': issueNeedsJustin,
  'review.gate_failed': reviewGateFailed,
  'review.ready': reviewReady,
  'release.candidate': releaseCandidate,
} as const;
