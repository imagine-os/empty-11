// shadcn/ui ships copied source, not a runtime package. This models the runtime
// cost of its `select` recipe: Radix Select plus the cn() helper every shadcn
// component imports (clsx + tailwind-merge) and class-variance-authority.
import { Select } from 'radix-ui';
import { cva } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';
import clsx, { type ClassValue } from 'clsx';
const cn = (...i: ClassValue[]) => twMerge(clsx(i));
const trigger = cva('flex items-center', { variants: { size: { sm: 'h-8', default: 'h-9' } }, defaultVariants: { size: 'default' } });
export function Demo({ items }: { items: { value: string; label: string }[] }) {
  return (
    <Select.Root>
      <Select.Trigger className={cn(trigger({ size: 'default' }))}><Select.Value /><Select.Icon /></Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={8}>
          <Select.Viewport>
            {items.map((i) => (
              <Select.Item key={i.value} value={i.value} className={cn('relative flex')}>
                <Select.ItemText>{i.label}</Select.ItemText>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
