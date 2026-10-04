"use client";

import { useEffect } from "react";

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";

function isEditableElement(element) {
  return Boolean(element?.matches?.(EDITABLE_SELECTOR));
}

function shouldBlurOnEnter(element) {
  if (!element || element.tagName === "TEXTAREA" || element.isContentEditable) return false;
  if (element.tagName === "SELECT") return true;
  if (element.tagName !== "INPUT") return false;
  const type = String(element.type || "text").toLowerCase();
  return !["button", "checkbox", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(type);
}

export default function KeyboardDismissManager() {
  useEffect(() => {
    const handleFocusIn = (event) => {
      const target = event.target;
      if (!shouldBlurOnEnter(target)) return;
      if (!target.getAttribute("enterkeyhint")) {
        target.setAttribute("enterkeyhint", "done");
      }
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target;
      if (!shouldBlurOnEnter(target)) return;
      window.requestAnimationFrame(() => target.blur?.());
    };

    const handlePointerDown = (event) => {
      const activeElement = document.activeElement;
      if (!isEditableElement(activeElement)) return;
      const target = event.target;
      if (target?.closest?.(`${EDITABLE_SELECTOR}, [data-keep-keyboard='true']`)) return;
      activeElement.blur?.();
    };

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  return null;
}
