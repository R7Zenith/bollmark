"use client";

export function ColorAutoSubmitInput({
  name,
  defaultValue,
  className
}: {
  name: string;
  defaultValue: string;
  className: string;
}) {
  return (
    <input
      type="color"
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}
