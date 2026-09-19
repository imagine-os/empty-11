/**
 * `ViewSpec`: the one schema every PaperOS view renders from.
 *
 * A strict superset of what an Airtable, Notion or ClickUp view can express: data source, fields
 * (projection), filter, sorts, groups, aggregations, kind-specific options, search, visibility,
 * permissions and sharing. The compiler (PAP-163), every view kind (PAP-165..PAP-170, PAP-619..
 * PAP-622), dashboards (PAP-173) and `page.spec.yaml` inline views (PAP-119) consume this type
 * unchanged. Every object is `.strict()`; unknown keys are a validation error, so a typo never
 * silently becomes "no filter".
 *
 * The current `version` is `VIEW_SPEC_VERSION`. `viewSpecSchema` accepts the current version
 * only; older specs go through `migrateViewSpec()` (migrate.ts) on read, never on write.
 */
import { z } from 'zod';
import { datasetRefSchema } from './dataset-ref.js';
import { fieldIdSchema } from './field.js';
import { audienceIdSchema, filterTreeSchema, uuidSchema, uuidV7Schema } from './shims.js';

export const VIEW_SPEC_VERSION = 3 as const;

/** The ten view kinds. `dashboard` is a page that composes views (PAP-173), not a kind. */
export const VIEW_KINDS = [
  'grid',
  'kanban',
  'calendar',
  'timeline',
  'gantt',
  'gallery',
  'list',
  'form',
  'map',
  'chart',
] as const;
export const viewKindSchema = z.enum(VIEW_KINDS).meta({ id: 'ViewKind' });
export type ViewKind = z.infer<typeof viewKindSchema>;

export const visibilitySchema = z.enum(['personal', 'shared', 'public']).meta({ id: 'Visibility' });
export type Visibility = z.infer<typeof visibilitySchema>;

export const rowHeightSchema = z
  .enum(['short', 'medium', 'tall', 'extraTall'])
  .meta({ id: 'RowHeight' });
export type RowHeight = z.infer<typeof rowHeightSchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']).meta({ id: 'SortDirection' });
export type SortDirection = z.infer<typeof sortDirectionSchema>;

/** Date bucket for grouping and chart axes. */
export const dateBucketSchema = z
  .enum(['day', 'week', 'month', 'quarter', 'year'])
  .meta({ id: 'DateBucket' });
export type DateBucket = z.infer<typeof dateBucketSchema>;

export const VIEW_LIMITS = {
  maxSorts: 5,
  maxGroups: 3,
  maxAggregations: 100,
  maxFields: 500,
  maxSeries: 10,
} as const;

/** Summary functions: the union of Airtable's summary bar, Notion's calculations and ClickUp's column totals. */
export const AGGREGATE_FNS = [
  'count',
  'countEmpty',
  'countFilled',
  'countUnique',
  'percentEmpty',
  'percentFilled',
  'percentUnique',
  'sum',
  'avg',
  'median',
  'min',
  'max',
  'range',
  'stdDev',
  'earliest',
  'latest',
  'dateRangeDays',
  'checked',
  'unchecked',
  'percentChecked',
  'concat',
] as const;
export const aggregateFnSchema = z.enum(AGGREGATE_FNS).meta({ id: 'AggregateFn' });
export type AggregateFn = z.infer<typeof aggregateFnSchema>;

// ---------------------------------------------------------------------------------------------
// Sub-shapes shared by every kind

/** Projection entry: which field shows, where, how wide, and whether it is frozen at the start edge. */
export const viewFieldSchema = z
  .object({
    fieldId: fieldIdSchema,
    /** Column width in CSS px (grid, gantt left grid). */
    width: z.number().int().min(24).max(2000).optional(),
    visible: z.boolean().default(true),
    /** Display order, ascending; ties break by array position. */
    order: z.number().int().min(0),
    /** Frozen at the reading-direction start edge (RTL flips it, PAP-341). */
    frozen: z.boolean().optional(),
  })
  .strict()
  .meta({ id: 'ViewField' });
export type ViewField = z.infer<typeof viewFieldSchema>;

export const sortSchema = z
  .object({
    fieldId: fieldIdSchema,
    direction: sortDirectionSchema,
    /** Where nulls sort; default follows the field type (PAP-163). */
    nulls: z.enum(['first', 'last']).optional(),
  })
  .strict()
  .meta({ id: 'Sort' });
export type Sort = z.infer<typeof sortSchema>;

export const groupSchema = z
  .object({
    fieldId: fieldIdSchema,
    direction: sortDirectionSchema.default('asc'),
    /**
     * Multi-value fields (multiSelect, user, relation): `false` groups by the value combination
     * (one row per record), `true` emits one row per value (a record appears in several groups).
     */
    expandMulti: z.boolean().default(false),
    /** Start collapsed. */
    collapsed: z.boolean().default(false),
    /** Bucket for date fields; ignored for other types. */
    dateBucket: dateBucketSchema.optional(),
    /** Hide groups with zero rows (kanban stacks, calendar lanes). */
    hideEmpty: z.boolean().default(false),
  })
  .strict()
  .meta({ id: 'Group' });
export type Group = z.infer<typeof groupSchema>;

export const aggregationSchema = z
  .object({
    fieldId: fieldIdSchema,
    fn: aggregateFnSchema,
    label: z.string().max(60).optional(),
    /** Footer of the whole view, per group header, or both. */
    scope: z.enum(['footer', 'group', 'both']).default('footer'),
  })
  .strict()
  .meta({ id: 'Aggregation' });
export type Aggregation = z.infer<typeof aggregationSchema>;

/** Saved quick search: the toolbar search box state (PAP-618). */
export const viewSearchSchema = z
  .object({
    query: z.string().max(200),
    /** Restrict to these fields; absent searches every visible text-like field. */
    fieldIds: z.array(fieldIdSchema).max(50).optional(),
  })
  .strict()
  .meta({ id: 'ViewSearch' });
export type ViewSearch = z.infer<typeof viewSearchSchema>;

/**
 * Who may edit through this view. Audiences resolve through `can()` (PAP-59). On an RLS-backed
 * entity dataset these lists only narrow what RLS already allows; they never widen it.
 */
export const viewPermissionsSchema = z
  .object({
    canEditRecords: z.array(audienceIdSchema).max(32),
    canEditView: z.array(audienceIdSchema).max(32),
  })
  .strict()
  .meta({ id: 'ViewPermissions' });
export type ViewPermissions = z.infer<typeof viewPermissionsSchema>;

/**
 * What a `public` view exposes. Share tokens, passwords and expiry live in `view_share`
 * (PAP-624) and are not part of the spec; this block is the projection and the switches the
 * public renderer honours.
 */
export const viewSharingSchema = z
  .object({
    /** Fields a public viewer sees; absent means every `visible` field. Hidden fields never leak. */
    publicFieldIds: z.array(fieldIdSchema).max(VIEW_LIMITS.maxFields).optional(),
    allowExport: z.boolean().default(false),
    allowEmbed: z.boolean().default(false),
    /** "Copy to my workspace" (Airtable "copy base", Notion "duplicate"). */
    allowCopy: z.boolean().default(false),
    /** Public viewers may add temporary filters (URL-held, never saved). */
    allowViewerFilters: z.boolean().default(false),
  })
  .strict()
  .meta({ id: 'ViewSharing' });
export type ViewSharing = z.infer<typeof viewSharingSchema>;

// ---------------------------------------------------------------------------------------------
// Kind-specific options, one named schema per kind

export const gridOptionsSchema = z
  .object({
    wrapText: z.boolean().default(false),
    showRowNumbers: z.boolean().default(true),
    /** Summary footer visible (aggregations render there). */
    showFooter: z.boolean().default(true),
    /** Column-header colour by field type (Airtable) or plain. */
    colorHeaders: z.boolean().default(false),
  })
  .strict()
  .meta({ id: 'GridOptions' });

export const kanbanOptionsSchema = z
  .object({
    /** A select, status or user field; each option is a stack. */
    stackByFieldId: fieldIdSchema,
    /** Optional second dimension: rows of stacks. */
    swimlaneFieldId: fieldIdSchema.optional(),
    coverFieldId: fieldIdSchema.optional(),
    /** Fields shown on a card, in order. */
    cardFieldIds: z.array(fieldIdSchema).max(20).default([]),
    hideEmptyStacks: z.boolean().default(false),
    /** WIP limit per stack option id; over-limit stacks highlight. */
    wipLimits: z.record(z.string(), z.number().int().min(0)).optional(),
    collapsedStackIds: z.array(z.string()).max(200).optional(),
    /** Explicit stack order by option id; absent follows the field's option order. */
    stackOrder: z.array(z.string()).max(200).optional(),
  })
  .strict()
  .meta({ id: 'KanbanOptions' });

export const calendarOptionsSchema = z
  .object({
    startFieldId: fieldIdSchema,
    endFieldId: fieldIdSchema.optional(),
    titleFieldId: fieldIdSchema.optional(),
    colorFieldId: fieldIdSchema.optional(),
    defaultMode: z.enum(['month', 'week', 'day', 'agenda']).default('month'),
    /** 0 = Sunday .. 6 = Saturday. */
    weekStartsOn: z.number().int().min(0).max(6).default(1),
    showWeekends: z.boolean().default(true),
    /** Visible hours in week and day mode. */
    dayStartHour: z.number().int().min(0).max(23).default(7),
    dayEndHour: z.number().int().min(1).max(24).default(19),
  })
  .strict()
  .meta({ id: 'CalendarOptions' });

export const timelineOptionsSchema = z
  .object({
    startFieldId: fieldIdSchema,
    endFieldId: fieldIdSchema,
    titleFieldId: fieldIdSchema.optional(),
    /** One lane per value of this field (rows on the vertical axis). */
    laneFieldId: fieldIdSchema.optional(),
    colorFieldId: fieldIdSchema.optional(),
    zoom: dateBucketSchema.default('week'),
    showDependencies: z.boolean().default(false),
    /** A relation field pointing at predecessor records. */
    dependencyFieldId: fieldIdSchema.optional(),
    showToday: z.boolean().default(true),
  })
  .strict()
  .meta({ id: 'TimelineOptions' });

export const ganttOptionsSchema = z
  .object({
    startFieldId: fieldIdSchema,
    endFieldId: fieldIdSchema,
    titleFieldId: fieldIdSchema.optional(),
    dependencyFieldId: fieldIdSchema.optional(),
    /** A percent or progress field rendered inside the bar. */
    progressFieldId: fieldIdSchema.optional(),
    /** A checkbox field; checked records render as milestones. */
    milestoneFieldId: fieldIdSchema.optional(),
    zoom: dateBucketSchema.default('week'),
    showCriticalPath: z.boolean().default(false),
    showBaseline: z.boolean().default(false),
    /** Columns of the frozen left grid, in order. */
    leftGridFieldIds: z.array(fieldIdSchema).max(10).default([]),
  })
  .strict()
  .meta({ id: 'GanttOptions' });

export const galleryOptionsSchema = z
  .object({
    /** An attachment field whose first file is the card cover. */
    coverFieldId: fieldIdSchema.optional(),
    coverFit: z.enum(['cover', 'contain']).default('cover'),
    cardSize: z.enum(['small', 'medium', 'large']).default('medium'),
    titleFieldId: fieldIdSchema.optional(),
    cardFieldIds: z.array(fieldIdSchema).max(20).default([]),
    showFieldNames: z.boolean().default(true),
  })
  .strict()
  .meta({ id: 'GalleryOptions' });

export const listOptionsSchema = z
  .object({
    titleFieldId: fieldIdSchema,
    subtitleFieldId: fieldIdSchema.optional(),
    /** Small meta chips under the subtitle. */
    metaFieldIds: z.array(fieldIdSchema).max(6).default([]),
    /** Avatar, cover or icon at the leading edge. */
    leadingFieldId: fieldIdSchema.optional(),
    /** Swipe actions by actions-registry id; also reachable from the row menu (never swipe-only). */
    swipeActions: z
      .object({
        start: z.string().min(1).max(64).optional(),
        end: z.string().min(1).max(64).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .meta({ id: 'ListOptions' });

export const formOptionsSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    submitLabel: z.string().max(60).optional(),
    successMessage: z.string().max(2000).optional(),
    redirectUrl: z.url().optional(),
    /** Public submission without a session (`/f/:token`, PAP-620). */
    allowAnonymous: z.boolean().default(false),
    allowMultipleSubmissions: z.boolean().default(true),
    showProgress: z.boolean().default(false),
    /** Reserved: conditional field logic and drafts; shape owned by PAP-620 `FormSpec`. */
    logic: z.unknown().optional(),
  })
  .strict()
  .meta({ id: 'FormOptions' });

export const mapOptionsSchema = z
  .object({
    /** A `geo` field. */
    geoFieldId: fieldIdSchema,
    titleFieldId: fieldIdSchema.optional(),
    colorFieldId: fieldIdSchema.optional(),
    cluster: z.boolean().default(true),
    /** Panning the map filters the list to the visible bounds. */
    boundsFilter: z.boolean().default(true),
    defaultBounds: z
      .object({
        west: z.number().min(-180).max(180),
        south: z.number().min(-90).max(90),
        east: z.number().min(-180).max(180),
        north: z.number().min(-90).max(90),
      })
      .strict()
      .optional(),
    style: z.enum(['streets', 'light', 'dark', 'satellite']).default('streets'),
  })
  .strict()
  .meta({ id: 'MapOptions' });

export const chartTypeSchema = z
  .enum(['bar', 'stackedBar', 'line', 'area', 'pie', 'donut', 'number'])
  .meta({ id: 'ChartType' });
export type ChartType = z.infer<typeof chartTypeSchema>;

export const chartSeriesSchema = z
  .object({
    /** Absent only for `count`. */
    fieldId: fieldIdSchema.optional(),
    fn: aggregateFnSchema,
    label: z.string().max(60).optional(),
    /** A design-token colour name (PAP-66), never a raw hex. */
    color: z.string().max(40).optional(),
  })
  .strict()
  .superRefine((series, ctx) => {
    if (series.fn !== 'count' && series.fieldId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fieldId'],
        message: `series fn '${series.fn}' needs a fieldId`,
      });
    }
  });
export type ChartSeries = z.infer<typeof chartSeriesSchema>;

export const chartOptionsSchema = z
  .object({
    chartType: chartTypeSchema,
    /** Category axis; absent for `number`. */
    xAxis: z
      .object({ fieldId: fieldIdSchema, dateBucket: dateBucketSchema.optional() })
      .strict()
      .optional(),
    series: z.array(chartSeriesSchema).min(1).max(VIEW_LIMITS.maxSeries),
    legend: z.boolean().default(true),
    /** Target line (bar, line, area) or target value (number). */
    goal: z.number().optional(),
    /** Clicking a segment emits a cross-filter to the dashboard bus (PAP-386). */
    emitFilter: z.boolean().default(true),
  })
  .strict()
  .superRefine((options, ctx) => {
    if (options.chartType !== 'number' && options.xAxis === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['xAxis'],
        message: `chart type '${options.chartType}' needs an xAxis`,
      });
    }
  })
  .meta({ id: 'ChartOptions' });

export const VIEW_OPTION_SCHEMAS = {
  grid: gridOptionsSchema,
  kanban: kanbanOptionsSchema,
  calendar: calendarOptionsSchema,
  timeline: timelineOptionsSchema,
  gantt: ganttOptionsSchema,
  gallery: galleryOptionsSchema,
  list: listOptionsSchema,
  form: formOptionsSchema,
  map: mapOptionsSchema,
  chart: chartOptionsSchema,
} as const satisfies Record<ViewKind, z.ZodType>;

export type ViewOptions<K extends ViewKind = ViewKind> = z.infer<(typeof VIEW_OPTION_SCHEMAS)[K]>;

// ---------------------------------------------------------------------------------------------
// ViewSpec

const viewSpecBase = z.object({
  /** UUIDv7 (`view.id`). */
  id: uuidV7Schema,
  version: z.literal(VIEW_SPEC_VERSION),
  datasetRef: datasetRefSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  fields: z.array(viewFieldSchema).max(VIEW_LIMITS.maxFields),
  /** Absent means no filter. `FilterTree` from PAP-279 (see shims.ts). */
  filter: filterTreeSchema.optional(),
  sorts: z.array(sortSchema).max(VIEW_LIMITS.maxSorts).default([]),
  groups: z.array(groupSchema).max(VIEW_LIMITS.maxGroups).default([]),
  aggregations: z.array(aggregationSchema).max(VIEW_LIMITS.maxAggregations).default([]),
  rowHeight: rowHeightSchema.default('short'),
  search: viewSearchSchema.optional(),
  visibility: visibilitySchema,
  /** The user who owns the view (`user.id`; global, so any UUID version). */
  ownerUserId: uuidSchema,
  permissions: viewPermissionsSchema,
  /** Required when `visibility` is `public`. */
  sharing: viewSharingSchema.optional(),
  /** Locked views reject spec edits from everyone but `permissions.canEditView`. */
  locked: z.boolean().default(false),
  /** Round 4: reserved; conditional formatting rules, shape owned by PAP-626. */
  formats: z.unknown().optional(),
  /** Round 4: reserved; record colouring source, shape owned by PAP-626. */
  colorBy: z.unknown().optional(),
});

function forKind<K extends ViewKind>(kind: K) {
  return viewSpecBase
    .extend({ kind: z.literal(kind), options: VIEW_OPTION_SCHEMAS[kind] })
    .strict()
    .meta({ id: `${kind[0]?.toUpperCase()}${kind.slice(1)}ViewSpec` });
}

export const gridViewSpecSchema = forKind('grid');
export const kanbanViewSpecSchema = forKind('kanban');
export const calendarViewSpecSchema = forKind('calendar');
export const timelineViewSpecSchema = forKind('timeline');
export const ganttViewSpecSchema = forKind('gantt');
export const galleryViewSpecSchema = forKind('gallery');
export const listViewSpecSchema = forKind('list');
export const formViewSpecSchema = forKind('form');
export const mapViewSpecSchema = forKind('map');
export const chartViewSpecSchema = forKind('chart');

type AnyViewSpecShape = { fields: ViewField[]; visibility: Visibility; sharing?: unknown };

function refineViewSpec(spec: AnyViewSpecShape, ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  spec.fields.forEach((field, index) => {
    if (seen.has(field.fieldId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['fields', index, 'fieldId'],
        message: `duplicate fieldId '${field.fieldId}' in fields`,
      });
    }
    seen.add(field.fieldId);
  });
  if (spec.visibility === 'public' && spec.sharing === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['sharing'],
      message: 'a public view must declare sharing',
    });
  }
}

/**
 * The strict `ViewSpec` schema: a discriminated union on `kind`, each member the base spec plus
 * that kind's named `options` schema. Rejects unknown keys anywhere, duplicate field ids, more
 * than 5 sorts or 3 groups, and a public view without a `sharing` block.
 */
export const viewSpecSchema = z
  .discriminatedUnion('kind', [
    gridViewSpecSchema,
    kanbanViewSpecSchema,
    calendarViewSpecSchema,
    timelineViewSpecSchema,
    ganttViewSpecSchema,
    galleryViewSpecSchema,
    listViewSpecSchema,
    formViewSpecSchema,
    mapViewSpecSchema,
    chartViewSpecSchema,
  ])
  .superRefine(refineViewSpec);

/** The parsed spec (defaults applied). */
export type ViewSpec = z.infer<typeof viewSpecSchema>;
/** What callers may pass in (defaults optional). */
export type ViewSpecInput = z.input<typeof viewSpecSchema>;
/** The spec narrowed to one kind. */
export type ViewSpecOf<K extends ViewKind> = Extract<ViewSpec, { kind: K }>;

/**
 * Every field id a spec references outside its `filter` (fields, sorts, groups, aggregations,
 * sharing and the kind options). The compiler flags ids missing from the dataset as `orphaned`
 * and skips them; the spec itself stays valid so a deleted field never breaks a saved view.
 */
export function referencedFieldIds(spec: ViewSpec): Set<FieldIdRef> {
  const ids = new Set<FieldIdRef>();
  for (const field of spec.fields) ids.add(field.fieldId);
  for (const sort of spec.sorts) ids.add(sort.fieldId);
  for (const group of spec.groups) ids.add(group.fieldId);
  for (const agg of spec.aggregations) ids.add(agg.fieldId);
  for (const id of spec.sharing?.publicFieldIds ?? []) ids.add(id);
  for (const id of spec.search?.fieldIds ?? []) ids.add(id);
  collectOptionFieldIds(spec.options, ids);
  return ids;
}
type FieldIdRef = string;

function collectOptionFieldIds(options: Record<string, unknown>, into: Set<string>): void {
  for (const [key, value] of Object.entries(options)) {
    if (key === 'fieldId' || key.endsWith('FieldId')) {
      if (typeof value === 'string') into.add(value);
    } else if (key.endsWith('FieldIds') && Array.isArray(value)) {
      for (const id of value) if (typeof id === 'string') into.add(id);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          collectOptionFieldIds(item as Record<string, unknown>, into);
        }
      }
    } else if (value && typeof value === 'object' && key !== 'wipLimits') {
      collectOptionFieldIds(value as Record<string, unknown>, into);
    }
  }
}

/** Field ids the spec references that the dataset does not have. Never throws. */
export function findOrphanedFieldIds(spec: ViewSpec, datasetFieldIds: Iterable<string>): string[] {
  const known = new Set(datasetFieldIds);
  return [...referencedFieldIds(spec)].filter((id) => !known.has(id)).sort();
}
