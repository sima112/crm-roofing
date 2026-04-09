"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, ZoomIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateJobFieldAction, deleteJobPhotoAction } from "../job-actions";

interface PhotoUploaderProps {
  jobId: string;
  businessId: string;
  type: "before" | "after";
  photos: string[];
}

export function PhotoUploader({
  jobId,
  businessId,
  type,
  photos,
}: PhotoUploaderProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const supabase = createClient();
    setUploading(true);
    setError(null);

    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.match(/image\/(jpeg|jpg|png|heic|heif|webp)/i)) {
        setError("Only JPG, PNG, HEIC, and WebP images are supported.");
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("Max file size is 20 MB.");
        continue;
      }

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${businessId}/${jobId}/${type}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("job-photos")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("job-photos")
        .getPublicUrl(path);

      newUrls.push(urlData.publicUrl);
    }

    if (newUrls.length > 0) {
      const field = type === "before" ? "before_photos" : "after_photos";
      await updateJobFieldAction(jobId, { [field]: [...photos, ...newUrls] });
      startTransition(() => router.refresh());
    }
    setUploading(false);
  };

  const handleDelete = async (url: string) => {
    await deleteJobPhotoAction(jobId, url, type);
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold capitalize">{type} Photos</h3>

      {/* Upload zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-input hover:border-primary/50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp"
          multiple
          capture="environment" // opens camera on mobile
          className="sr-only"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-6 h-6" />
            <p className="text-sm font-medium">
              Tap to add photos
            </p>
            <p className="text-xs">JPG, PNG, HEIC up to 20 MB</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url) => (
            <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                  onClick={() => setLightbox(url)}
                >
                  <ZoomIn className="w-4 h-4 text-foreground" />
                </button>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
                  onClick={() => handleDelete(url)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
