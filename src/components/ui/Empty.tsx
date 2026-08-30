import type { ReactNode } from 'react';

export function Empty({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? <div className="mb-5 text-chalk-faint">{icon}</div> : null}
      <h3 className="font-display text-lg tracking-tight text-chalk">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-chalk-faint">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
