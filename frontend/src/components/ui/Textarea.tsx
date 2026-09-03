import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea className="ui-control ui-textarea" ref={ref} {...props} />,
);

Textarea.displayName = 'Textarea';
