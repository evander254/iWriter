import { useRef, useState, type DragEvent } from "react";
import { Download, FileText, Paperclip, Trash2, UploadCloud, X } from "lucide-react";
import { Button, IconButton } from "../common";
import { cx } from "../../lib/utils";
import { formatFileSize, getSignedUrl, pathFromUrl, validateFile } from "../../services/storage";
import { useToast } from "../../contexts/ToastContext";

/* ------------------------------------------------------------------ */
/* Staged upload dropzone                                              */
/* ------------------------------------------------------------------ */

export interface FileUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  hint?: string;
  maxFiles?: number;
}

export function FileUpload({ files, onChange, disabled, hint, maxFiles = 10 }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length >= maxFiles) {
        toast.warning("Too many files", `You can attach up to ${maxFiles} files.`);
        break;
      }
      const invalid = validateFile(file);
      if (invalid) {
        toast.error("File not accepted", invalid);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    onChange(next);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    addFiles(event.dataTransfer.files);
  };

  return (
    <div className="stack iw-gap-3">
      <div
        className={cx("iw-dropzone", dragging && "is-dragover")}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={disabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
      >
        <span className="iw-dropzone__icon">
          <UploadCloud size={22} strokeWidth={2.1} />
        </span>
        <span className="iw-dropzone__title">Click to upload or drag and drop</span>
        <span className="iw-dropzone__hint">{hint ?? "PDF, DOCX, PPTX, XLSX, ZIP, images — up to 25 MB each"}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          disabled={disabled}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="iw-filelist">
          {files.map((file, index) => (
            <li className="iw-file" key={`${file.name}-${file.size}-${index}`}>
              <span className="iw-file__icon">
                <FileText size={18} strokeWidth={2.1} />
              </span>
              <div className="iw-file__meta">
                <div className="iw-file__name truncate">{file.name}</div>
                <div className="iw-file__sub">{formatFileSize(file.size)} · ready to upload</div>
              </div>
              <IconButton
                icon={X}
                label={`Remove ${file.name}`}
                size="sm"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stored files (open via signed URL)                                  */
/* ------------------------------------------------------------------ */

export interface StoredFile {
  id: string;
  file_name: string | null;
  file_url: string | null;
  uploaded_at?: string;
  file_size?: number | null;
}

export function StoredFileList({
  files,
  onRemove,
  emptyLabel = "No files attached.",
}: {
  files: StoredFile[];
  onRemove?: (file: StoredFile) => void;
  emptyLabel?: string;
}) {
  const toast = useToast();

  const open = async (file: StoredFile) => {
    const path = pathFromUrl(file.file_url);
    const url = await getSignedUrl(path);
    if (!url) {
      toast.error("Unable to open file", "The file may have been removed.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (files.length === 0) {
    return <div className="text-sm text-secondary">{emptyLabel}</div>;
  }

  return (
    <ul className="iw-filelist">
      {files.map((file) => (
        <li className="iw-file" key={file.id}>
          <span className="iw-file__icon">
            <Paperclip size={17} strokeWidth={2.1} />
          </span>
          <div className="iw-file__meta">
            <div className="iw-file__name truncate">{file.file_name ?? "Attachment"}</div>
            <div className="iw-file__sub">
              {file.file_size ? `${formatFileSize(file.file_size)} · ` : ""}Click to open securely
            </div>
          </div>
          <Button size="sm" variant="ghost" icon={Download} onClick={() => void open(file)}>
            Open
          </Button>
          {onRemove && (
            <IconButton icon={Trash2} label={`Remove ${file.file_name ?? "file"}`} size="sm" onClick={() => onRemove(file)} />
          )}
        </li>
      ))}
    </ul>
  );
}
