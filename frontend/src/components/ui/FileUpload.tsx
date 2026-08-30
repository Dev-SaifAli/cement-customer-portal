import { FileText, Upload, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
export function FileUpload({
  label = 'Choose file',
  file,
  onRemove,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  file?: File;
  onRemove?: () => void;
}) {
  return (
    <div className="ui-upload">
      <label className="ui-upload__picker">
        <input className="ui-upload__input" type="file" {...props} />
        <Upload size={17} aria-hidden="true" />
        <span>{file ? 'Replace file' : label}</span>
      </label>
      {file && (
        <div className="ui-upload__file">
          <FileText size={17} aria-hidden="true" />
          <div>
            <strong title={file.name}>{file.name}</strong>
            <small>
              {file.type || 'Unknown file type'} | {formatFileSize(file.size)}
            </small>
          </div>
          {onRemove && (
            <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}>
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
