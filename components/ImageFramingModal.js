"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Move, RotateCcw, X } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getPointerDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const getPointerCenter = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function makeCroppedFile({ file, image, frame, offset, zoom }) {
  const frameWidth = Math.max(1, frame.width);
  const frameHeight = Math.max(1, frame.height);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const coverScale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
  const scale = coverScale * zoom;
  const sourceWidth = frameWidth / scale;
  const sourceHeight = frameHeight / scale;
  const sourceX = naturalWidth / 2 + (0 - frameWidth / 2 - offset.x) / scale;
  const sourceY = naturalHeight / 2 + (0 - frameHeight / 2 - offset.y) / scale;
  const safeSourceX = clamp(sourceX, 0, Math.max(0, naturalWidth - sourceWidth));
  const safeSourceY = clamp(sourceY, 0, Math.max(0, naturalHeight - sourceHeight));
  const outputWidth = 1200;
  const outputHeight = Math.round(outputWidth * (frameHeight / frameWidth));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#0B0B0B";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(image, safeSourceX, safeSourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const baseName = file?.name ? file.name.replace(/\.[^.]+$/, "") : "dish";
        resolve(new File([blob], `${baseName}-framed.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  });
}

export default function ImageFramingModal({ open, file, onCancel, onConfirm, dishName = "", ownerName = "" }) {
  const { darkMode, language } = useLanguage();
  const frameRef = useRef(null);
  const imageRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [objectUrl, setObjectUrl] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const copy = useMemo(
    () =>
      language === "it"
        ? {
            title: "Inquadra la foto",
            subtitle: "Trascina per spostarla. Pizzica con due dita per ingrandire.",
            zoom: "Trascina e pizzica",
            reset: "Ripristina",
            cancel: "Annulla",
            confirm: "Usa questa foto",
            previewName: "Nome piatto",
          }
        : {
            title: "Frame the photo",
            subtitle: "Drag to move it. Pinch with two fingers to zoom.",
            zoom: "Drag and pinch",
            reset: "Reset",
            cancel: "Cancel",
            confirm: "Use this photo",
            previewName: "Dish name",
          },
    [language]
  );

  useEffect(() => {
    if (!open || !file) return undefined;
    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    offsetRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setImageSize({ width: 0, height: 0 });
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file, open]);

  useEffect(() => {
    if (!open) {
      pointersRef.current.clear();
      gestureRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const updateFrame = () => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (rect) setFrameSize({ width: rect.width, height: rect.height });
    };
    updateFrame();
    window.addEventListener("resize", updateFrame);
    return () => window.removeEventListener("resize", updateFrame);
  }, [open]);

  const getBoundsForZoom = (nextZoom) => {
    const frameWidth = frameSize.width || 1;
    const frameHeight = frameSize.height || 1;
    const imageWidth = imageSize.width || 1;
    const imageHeight = imageSize.height || 1;
    const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
    const displayWidth = imageWidth * coverScale * nextZoom;
    const displayHeight = imageHeight * coverScale * nextZoom;
    return {
      x: Math.max(0, (displayWidth - frameWidth) / 2),
      y: Math.max(0, (displayHeight - frameHeight) / 2),
      displayWidth,
      displayHeight,
    };
  };

  const bounds = useMemo(
    () => getBoundsForZoom(zoom),
    [frameSize.height, frameSize.width, imageSize.height, imageSize.width, zoom]
  );

  useEffect(() => {
    setOffset((prev) => {
      const nextOffset = {
        x: clamp(prev.x, -bounds.x, bounds.x),
        y: clamp(prev.y, -bounds.y, bounds.y),
      };
      offsetRef.current = nextOffset;
      return nextOffset;
    });
  }, [bounds.x, bounds.y]);

  const getFramePoint = (point) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: point.x - rect.left - rect.width / 2,
      y: point.y - rect.top - rect.height / 2,
    };
  };

  const clampOffsetForZoom = (nextOffset, nextZoom = zoom) => {
    const nextBounds = getBoundsForZoom(nextZoom);
    return {
      x: clamp(nextOffset.x, -nextBounds.x, nextBounds.x),
      y: clamp(nextOffset.y, -nextBounds.y, nextBounds.y),
    };
  };

  const startPanGesture = (pointer) => {
    gestureRef.current = {
      type: "pan",
      pointerId: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      startOffset: offsetRef.current,
    };
  };

  const startPinchGesture = () => {
    const pointers = Array.from(pointersRef.current.values()).slice(0, 2);
    if (pointers.length < 2) return;
    const center = getPointerCenter(pointers[0], pointers[1]);
    gestureRef.current = {
      type: "pinch",
      pointerIds: [pointers[0].id, pointers[1].id],
      startCenter: getFramePoint(center),
      startDistance: Math.max(1, getPointerDistance(pointers[0], pointers[1])),
      startOffset: offsetRef.current,
      startZoom: zoomRef.current,
    };
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
    if (pointersRef.current.size >= 2) {
      startPinchGesture();
    } else {
      startPanGesture({ id: event.pointerId, x: event.clientX, y: event.clientY });
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });

    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.type === "pinch") {
      const [firstId, secondId] = gesture.pointerIds;
      const first = pointersRef.current.get(firstId);
      const second = pointersRef.current.get(secondId);
      if (!first || !second) return;
      const currentDistance = Math.max(1, getPointerDistance(first, second));
      const currentCenter = getFramePoint(getPointerCenter(first, second));
      const nextZoom = clamp(gesture.startZoom * (currentDistance / gesture.startDistance), 1, 3);
      const zoomRatio = nextZoom / gesture.startZoom;
      const nextOffset = {
        x: currentCenter.x + (gesture.startOffset.x - gesture.startCenter.x) * zoomRatio,
        y: currentCenter.y + (gesture.startOffset.y - gesture.startCenter.y) * zoomRatio,
      };
      setZoom(nextZoom);
      zoomRef.current = nextZoom;
      offsetRef.current = clampOffsetForZoom(nextOffset, nextZoom);
      setOffset(offsetRef.current);
      return;
    }

    if (gesture.pointerId !== event.pointerId || pointersRef.current.size > 1) return;
    const nextOffset = clampOffsetForZoom({
      x: gesture.startOffset.x + event.clientX - gesture.startX,
      y: gesture.startOffset.y + event.clientY - gesture.startY,
    });
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {}
    if (pointersRef.current.size >= 2) {
      startPinchGesture();
      return;
    }
    if (pointersRef.current.size === 1) {
      startPanGesture(Array.from(pointersRef.current.values())[0]);
      return;
    }
    gestureRef.current = null;
  };

  const handleWheel = (event) => {
    if (!imageSize.width) return;
    event.preventDefault();
    const zoomDelta = -event.deltaY * 0.002;
    const currentZoom = zoomRef.current;
    const currentOffset = offsetRef.current;
    const nextZoom = clamp(currentZoom * (1 + zoomDelta), 1, 3);
    if (nextZoom === currentZoom) return;
    const framePoint = getFramePoint({ x: event.clientX, y: event.clientY });
    const zoomRatio = nextZoom / currentZoom;
    setZoom(nextZoom);
    zoomRef.current = nextZoom;
    const nextOffset = clampOffsetForZoom(
      {
        x: framePoint.x + (currentOffset.x - framePoint.x) * zoomRatio,
        y: framePoint.y + (currentOffset.y - framePoint.y) * zoomRatio,
      },
      nextZoom
    );
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const handleConfirm = async () => {
    if (!file || !imageRef.current || !frameRef.current || saving) return;
    setSaving(true);
    try {
      const cropped = await makeCroppedFile({
        file,
        image: imageRef.current,
        frame: frameRef.current.getBoundingClientRect(),
        offset,
        zoom,
      });
      onConfirm?.(cropped);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && file ? (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/76 px-4 py-5 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className={`flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border shadow-[0_30px_90px_rgba(0,0,0,0.45)] ${
              darkMode ? "border-white/12 bg-[#0D0D0D] text-white" : "border-black/10 bg-[#F8F6F0] text-black"
            }`}
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 18, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
              <div>
                <div className="text-[1.35rem] font-bold leading-none">{copy.title}</div>
                <div className={`mt-1 text-sm leading-5 ${darkMode ? "text-white/58" : "text-black/58"}`}>{copy.subtitle}</div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${darkMode ? "bg-white/8 text-white" : "bg-black/6 text-black"}`}
                aria-label={copy.cancel}
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <div
                ref={frameRef}
                className="relative mx-auto aspect-[3/4.35] max-h-[54vh] w-full max-w-[20rem] touch-none overflow-hidden rounded-[1.65rem] border-2 border-white/12 bg-black"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              >
                {objectUrl ? (
                  <img
                    ref={imageRef}
                    src={objectUrl}
                    alt=""
                    draggable={false}
                    onLoad={(event) => {
                      setImageSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                    style={{
                      width: bounds.displayWidth || "100%",
                      height: bounds.displayHeight || "100%",
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                      objectFit: "fill",
                    }}
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/44 via-black/16 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%] bg-gradient-to-t from-black/54 via-black/26 to-transparent" />
                <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 text-white">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/60 bg-black/30 text-xs font-bold">
                    {(ownerName?.[0] || "U").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="max-w-[12rem] truncate text-[0.95rem] font-semibold leading-tight">{ownerName || "You"}</div>
                    <div className="mt-0.5 text-[0.78rem] font-medium leading-none text-white/72">now</div>
                  </div>
                </div>
                <div className="pointer-events-none absolute bottom-5 left-5 right-5 text-white">
                  <div className="truncate text-2xl font-bold">{dishName || copy.previewName}</div>
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-[1.65rem] ring-1 ring-white/14" />
              </div>

              <div className={`mt-4 rounded-[1.3rem] border px-4 py-3 ${darkMode ? "border-white/10 bg-white/6" : "border-black/8 bg-white"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Move size={16} />
                    {copy.zoom}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      zoomRef.current = 1;
                      offsetRef.current = { x: 0, y: 0 };
                      setZoom(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${darkMode ? "bg-white/8 text-white/72" : "bg-black/6 text-black/62"}`}
                  >
                    <RotateCcw size={13} />
                    {copy.reset}
                  </button>
                </div>
              </div>
            </div>

            <div className={`grid grid-cols-[0.8fr,1.2fr] gap-2 border-t p-4 ${darkMode ? "border-white/10 bg-[#111111]" : "border-black/8 bg-white/70"}`}>
              <button
                type="button"
                onClick={onCancel}
                className={`rounded-full px-4 py-3 text-sm font-semibold ${darkMode ? "bg-white/8 text-white/72" : "bg-black/6 text-black/62"}`}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || !imageSize.width}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FFC247] px-4 py-3 text-sm font-black text-black disabled:opacity-50"
              >
                <Check size={16} />
                {saving ? "..." : copy.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
