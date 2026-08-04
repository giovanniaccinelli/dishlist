"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { getIngredientColor, inferIngredientColorId, normalizeIngredientItems, normalizeIngredientName } from "../app/lib/ingredients";

export default function IngredientPillEditor({
  value = [],
  onChange,
  placeholder = "Add ingredient",
  disabled = false,
  className = "",
}) {
  const [draft, setDraft] = useState("");
  const items = useMemo(() => normalizeIngredientItems(value), [value]);

  const commitDraft = () => {
    const name = normalizeIngredientName(draft);
    if (!name || disabled) return;
    onChange?.(normalizeIngredientItems([...items, { name, color: inferIngredientColorId(name) }]));
    setDraft("");
  };

  const removeItem = (key) => {
    if (disabled) return;
    onChange?.(items.filter((item) => item.key !== key));
  };

  return (
    <div className={`rounded-[1rem] border border-[#E4B43F]/55 bg-white px-3 py-3 text-black ${className}`}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const color = getIngredientColor(item.color);
          return (
            <span
              key={item.key}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold leading-none"
              style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text, WebkitTextFillColor: color.text }}
            >
              {item.name}
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                className="no-accent-border -mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/8"
                disabled={disabled}
                aria-label={`Remove ${item.name}`}
              >
                <X size={12} strokeWidth={2.4} />
              </button>
            </span>
          );
        })}
        <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-full border-2 border-[#E4B43F]/65 bg-[#FFF9E8] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <Pencil size={15} className="shrink-0 text-[#A36F00]" strokeWidth={2.2} />
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              commitDraft();
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-black/34"
            style={{ fontSize: 16 }}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={commitDraft}
            className="no-accent-border inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E4B43F] text-black"
            disabled={disabled || !draft.trim()}
            aria-label="Add ingredient"
          >
            <Plus size={16} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}
