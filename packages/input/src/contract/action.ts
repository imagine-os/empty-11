import { z } from 'zod';
import { ChordSchema } from './keyboard.js';
import { InputModalitySchema } from './primitives.js';

/**
 * The actions registry.
 *
 * Every page declares its actions. One declaration serves four consumers at
 * once, which is why it lives in the input contract and not in any one of them:
 *
 * * the command registry (PAP-151 / PAP-289) binds chords and fills the palette;
 * * the voice controller matches `intent.en` / `intent.es` against a transcript
 *   and emits a `voice` InputEvent carrying `id`;
 * * the WebMCP surface exposes agent-callable actions as tools, gated by
 *   `permission`;
 * * `docs/reference/surfaces.md` and the native menu are generated from it.
 *
 * A UI change that adds, renames or removes a control changes this declaration
 * in the same commit. There is no second source of truth.
 */

/** Where an action is visible: innermost scope wins on a chord conflict. */
export const ActionScopeSchema = z.enum(['global', 'page', 'component', 'selection']);

export type ActionScope = z.infer<typeof ActionScopeSchema>;

/**
 * Spoken phrases that resolve to this action, per shipped locale.
 *
 * Both locales are required so Spanish is never a later pass that silently
 * leaves half the product unreachable by voice. Phrases are lower-case,
 * unpunctuated, and may contain `{slot}` placeholders: `abrir {query}`.
 */
export const IntentPhrasesSchema = z
  .object({
    en: z.array(z.string().min(1)).min(1),
    es: z.array(z.string().min(1)).min(1),
  })
  .describe('Voice intent phrases per locale; {slot} placeholders allowed.');

export type IntentPhrases = z.infer<typeof IntentPhrasesSchema>;

/**
 * The serialisable half of an action: everything except the handler.
 *
 * This is the shape written to `actions.registry.json`, read by the WebMCP
 * surface and rendered into `docs/reference/surfaces.md`.
 */
export const ActionDeclarationSchema = z
  .object({
    /** Dot-namespaced, stable, unique across the app: `record.duplicate`. */
    id: z
      .string()
      .regex(
        /^[a-z][a-z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/,
        'Action ids are dot-namespaced, e.g. record.duplicate',
      ),
    /** Message-catalog key, never a literal string (English + Spanish rule). */
    titleKey: z.string().min(1),
    descriptionKey: z.string().min(1).nullable(),
    intent: IntentPhrasesSchema,
    /** Permission the caller needs, or null for an always-available action. */
    permission: z.string().min(1).nullable(),
    scope: ActionScopeSchema,
    /** Default chord, portable form. Keymaps (PAP-153) may override it. */
    shortcut: ChordSchema.nullable(),
    /** Which modalities may invoke it; empty means every modality. */
    modalities: z.array(InputModalitySchema),
    /** Exposed to agents over WebMCP / `commands.execute`. */
    agentCallable: z.boolean(),
    /** Declared but not implemented: the UI shows "not wired yet". */
    placeholder: z.boolean(),
    /** Arbitrary JSON Schema for the action's arguments, or null. */
    argsSchema: z.unknown().nullable(),
  })
  .describe('One declared action: the WebMCP surface and the voice vocabulary.');

export type ActionDeclaration = z.infer<typeof ActionDeclarationSchema>;

/** The registry file a page (or the whole app) publishes. */
export const ActionRegistrySchema = z.object({
  contract: z.string().min(1),
  /** Page route or `app` for globals. */
  owner: z.string().min(1),
  actions: z.array(ActionDeclarationSchema),
});

export type ActionRegistry = z.infer<typeof ActionRegistrySchema>;

/** Context handed to an action handler when it runs. */
export interface ActionContext {
  /** How the action was invoked. */
  readonly source: 'keyboard' | 'pointer' | 'voice' | 'gamepad' | 'menu' | 'palette' | 'agent';
  /** Locale in effect, BCP-47. */
  readonly locale: string;
  /** Slot values from a voice utterance or palette argument prompt. */
  readonly args: Readonly<Record<string, unknown>>;
  /** Permissions the caller holds; `permission` was already checked. */
  readonly permissions: readonly string[];
  /** Abort signal: long-running handlers must honour it. */
  readonly signal: AbortSignal;
}

/**
 * A declaration plus its handler. The handler is a function, so it is not part
 * of the Zod schema and never serialised; `ActionDeclarationSchema` validates
 * everything that crosses a wire.
 */
export interface Action<Result = void> extends ActionDeclaration {
  run(context: ActionContext): Result | Promise<Result>;
}

/**
 * Declare an action.
 *
 * Fields with an obvious default are optional here and filled in, so a page
 * declares intent phrases and a handler and nothing else. The result is
 * validated, which means a malformed id or a missing Spanish phrase fails at
 * module load rather than at the microphone.
 */
export function defineAction<Result = void>(
  input: Pick<Action<Result>, 'id' | 'titleKey' | 'intent' | 'run'> &
    Partial<Omit<Action<Result>, 'id' | 'titleKey' | 'intent' | 'run'>>,
): Action<Result> {
  const declaration: ActionDeclaration = {
    id: input.id,
    titleKey: input.titleKey,
    descriptionKey: input.descriptionKey ?? null,
    intent: input.intent,
    permission: input.permission ?? null,
    scope: input.scope ?? 'page',
    shortcut: input.shortcut ?? null,
    modalities: input.modalities ?? [],
    agentCallable: input.agentCallable ?? false,
    placeholder: input.placeholder ?? false,
    argsSchema: input.argsSchema ?? null,
  };
  return { ...ActionDeclarationSchema.parse(declaration), run: input.run };
}

/** Strip the handler, leaving the serialisable declaration. */
export function toDeclaration(action: Action<unknown>): ActionDeclaration {
  const { run: _run, ...declaration } = action;
  return declaration;
}
