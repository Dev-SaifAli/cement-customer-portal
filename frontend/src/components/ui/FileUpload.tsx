import type { InputHTMLAttributes } from 'react';
export function FileUpload({
  label = 'Choose file',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="ui-upload">
      <span>{label}</span>
      <input type="file" {...props} />
    </label>
  );
}
