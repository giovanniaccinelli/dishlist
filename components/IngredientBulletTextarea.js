"use client";

import { useRef } from "react";

const BULLET = "• ";

function ensureBulletValue(value = "") {
  const text = String(value || "");
  if (!text.trim()) return BULLET;
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return BULLET;
      return line.trimStart().startsWith("•") ? line : `${BULLET}${line.trimStart()}`;
    })
    .join("\n");
}

function insertAtCursor(node, insertText) {
  const start = node.selectionStart ?? node.value.length;
  const end = node.selectionEnd ?? node.value.length;
  return {
    value: `${node.value.slice(0, start)}${insertText}${node.value.slice(end)}`,
    cursor: start + insertText.length,
  };
}

export default function IngredientBulletTextarea({
  value,
  onChange,
  className = "",
  placeholder = "Ingredients",
  rows = 3,
  disabled = false,
}) {
  const textareaRef = useRef(null);

  const updateValue = (nextValue, cursor = null) => {
    onChange?.(nextValue);
    if (cursor == null) return;
    window.requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(cursor, cursor);
      textareaRef.current?.focus();
    });
  };

  const addBullet = () => {
    const node = textareaRef.current;
    if (!node) {
      updateValue(ensureBulletValue(value));
      return;
    }
    const current = ensureBulletValue(node.value);
    if (current !== node.value) {
      updateValue(current, current.length);
      return;
    }
    const prefix = current.endsWith("\n") || !current ? "" : "\n";
    const next = insertAtCursor(node, `${prefix}${BULLET}`);
    updateValue(next.value, next.cursor);
  };

  return (
    <div>
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          if (!String(value || "").trim()) updateValue(BULLET, BULLET.length);
        }}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const next = insertAtCursor(event.currentTarget, `\n${BULLET}`);
          updateValue(next.value, next.cursor);
        }}
        className={className}
        rows={rows}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={addBullet}
        disabled={disabled}
        className="mt-2 inline-flex items-center rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-bold text-black/60 transition active:scale-[0.98] disabled:opacity-45"
      >
        + ingrediente
      </button>
    </div>
  );
}
