/**
 * Minimal toast system backing the "not wired yet" org standard
 * (CLAUDE.md "Placeholders are marked"): any control that isn't wired shows
 * a tooltip plus this toast on activation, and stays visibly marked in dev
 * mode. `<AppShell>` renders one `<ToastViewport>`; `<NotWiredYet>` wraps a
 * placeholder control and fires it on click/Enter/Space.
 */
import {
  type ButtonHTMLAttributes,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import { isDevMode } from './dev-mode.js';

interface ToastMessage {
  readonly id: string;
  readonly text: string;
}

interface ToastContextValue {
  readonly show: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [messages, setMessages] = useState<readonly ToastMessage[]>([]);

  const show = useCallback((text: string) => {
    const id = `toast-${Math.random().toString(36).slice(2)}`;
    setMessages((current) => [...current, { id, text }]);
    setTimeout(() => setMessages((current) => current.filter((m) => m.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="paperos-toast-viewport" role="status" aria-live="polite">
        {messages.map((message) => (
          <div className="paperos-toast" key={message.id}>
            {message.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx)
    throw new Error('useToast must be used inside <ToastProvider> (rendered by <AppShell>).');
  return ctx;
}

export interface NotWiredYetProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What the toast/tooltip says is not wired, e.g. "Export to CSV". */
  readonly label: string;
  readonly children?: ReactNode;
}

/**
 * Wrap any not-yet-functional control in this instead of leaving it a silent
 * dead button. Shows a native tooltip (`title`) always, and in dev mode gets
 * a visible dashed outline plus a `data-not-wired` marker in addition to the
 * click-time toast.
 */
export function NotWiredYet({ label, children, onClick, className, ...rest }: NotWiredYetProps) {
  const { show } = useToast();
  const tooltipId = useId();
  const [dev, setDev] = useState(false);

  useEffect(() => {
    setDev(isDevMode());
  }, []);

  return (
    <button
      type="button"
      {...rest}
      className={dev ? `${className ?? ''} paperos-not-wired`.trim() : className}
      data-not-wired={dev ? 'true' : undefined}
      title={`${label} — not wired yet`}
      aria-describedby={tooltipId}
      onClick={(event) => {
        show(`"${label}" is not wired yet.`);
        onClick?.(event);
      }}
    >
      {children}
      <span id={tooltipId} className="paperos-visually-hidden">
        Not wired yet
      </span>
    </button>
  );
}
