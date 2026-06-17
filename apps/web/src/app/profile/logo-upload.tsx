"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface LogoUploadProps {
  logoUrl?: string | null;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}

export function LogoUpload({
  logoUrl,
  onFileChange,
  onRemove,
}: LogoUploadProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    logoUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : (logoUrl ?? null));
    onFileChange(file);
  }

  function handleRemove() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onRemove();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Upload logo"
        className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-bg-subtle transition hover:border-brand"
      >
        {logoPreview ? (
          <Image
            src={logoPreview}
            alt="Logo preview"
            width={80}
            height={80}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-xs text-text-subtle">Upload logo</span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoChange}
      />
      {(logoFile || logoPreview) && (
        <button
          type="button"
          onClick={handleRemove}
          className="text-xs text-text-subtle underline hover:text-text"
        >
          Remove
        </button>
      )}
    </div>
  );
}
