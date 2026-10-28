import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { Photo } from "../types";
export default function PhotoUpload({
  label,
  photo,
  onChange,
  onBusy,
  onError,
}: {
  label: string;
  photo: Photo | null;
  onChange: (photo: Photo | null) => void;
  onBusy: (busy: boolean) => void;
  onError: (error: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [reading, setReading] = useState(false);
  async function choose(file?: File) {
    const current = ++generation.current;
    onChange(null);
    onError("");
    if (!file) {
      onBusy(false);
      setReading(false);
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      onError("Выберите JPEG, PNG или WebP не больше 2 МБ.");
      onBusy(false);
      setReading(false);
      return;
    }
    setReading(true);
    onBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (generation.current === current)
        onChange({ data, type: file.type, name: file.name });
    } catch {
      if (generation.current === current)
        onError("Не удалось прочитать фотографию.");
    } finally {
      if (generation.current === current) {
        setReading(false);
        onBusy(false);
      }
    }
  }
  return (
    <div className="full photo-field">
      <label className="upload">
        <ImagePlus size={24} />
        <span>
          <strong>{label}</strong>
          <small>
            {reading
              ? "Читаем файл…"
              : photo
                ? photo.name
                : "JPEG, PNG, WebP · до 2 МБ · необязательно"}
          </small>
        </span>
        <input
          ref={input}
          type="file"
          aria-label={label}
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </label>
      {photo && (
        <div className="photo-preview">
          <img alt={label} src={`data:${photo.type};base64,${photo.data}`} />
          <button
            type="button"
            className="text-button"
            onClick={() => {
              generation.current++;
              onChange(null);
              onBusy(false);
              setReading(false);
              if (input.current) input.current.value = "";
            }}
          >
            Убрать снимок
          </button>
        </div>
      )}
    </div>
  );
}
