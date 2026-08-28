export function Card({
  title,
  action,
  children,
  className = ""
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-admin-border bg-admin-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-admin-border px-5 py-4">
          {title && <h2 className="text-sm font-semibold text-admin-text">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
