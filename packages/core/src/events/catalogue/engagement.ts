/** Segment membership topics. Producer: PAP-195. */
import { z } from 'zod';
import { defineTopic } from '../registry.js';
import { at, key, uuid } from './_shared.js';

export const segmentEntered = defineTopic(
  'segment.entered',
  z.object({ segmentId: uuid, subjectType: key, subjectId: uuid, evaluatedAt: at }),
  {
    description: 'A person or account started matching a segment filter.',
    producer: 'PAP-195 segments',
    consumers: ['PAP-174 automation triggers', 'PAP-136 notifications', 'PAP-222 webhooks'],
  },
);

export const segmentExited = defineTopic(
  'segment.exited',
  z.object({ segmentId: uuid, subjectType: key, subjectId: uuid, evaluatedAt: at }),
  {
    description: 'A person or account stopped matching a segment filter.',
    producer: 'PAP-195 segments',
    consumers: ['PAP-174 automation triggers', 'PAP-136 notifications'],
  },
);

export const engagementTopics = {
  'segment.entered': segmentEntered,
  'segment.exited': segmentExited,
} as const;
