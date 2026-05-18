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

  return (
    <>
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          if (!String(value || "").trim()) updateValue(BULLET, BULLET.length);
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange?.(nextValue.trim() ? ensureBulletValue(nextValue) : "");
        }}
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
    </>
  );
}
