"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Upload } from "lucide-react";

type Props = {
  onFiles: (files: FileList) => void;
  uploading: boolean;
};

export function KwUploadZone({ onFiles, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        className="gap-2 rounded-xl text-xs"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <LoadingSpinner variant="dot" size="xs" />
        ) : (
          <Upload className="size-4" />
        )}
        {uploading ? "インポート中…" : "CSV インポート"}
      </Button>

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-400/10">
          <p className="text-lg font-semibold text-cyan-300">CSV をドロップしてインポート</p>
        </div>
      )}

      {/* Invisible drop zone covering the page */}
      <div
        className="fixed inset-0 z-40"
        style={{ pointerEvents: dragOver ? "auto" : "none" }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
      />
      {/* Trigger layer to activate drop zone */}
      {!dragOver && (
        <div
          className="pointer-events-auto fixed inset-0 z-30"
          style={{ pointerEvents: "none" }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
        />
      )}
    </>
  );
}
