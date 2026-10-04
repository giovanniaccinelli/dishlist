"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";

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

function isFocusableInput(element) {
  if (!isEditableElement(element)) return false;
  if (element.disabled || element.readOnly) return false;
  if (element.tagName === "INPUT") {
    const type = String(element.type || "text").toLowerCase();
    return !["button", "checkbox", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(type);
  }
  return true;
}

function getKeyboardInputs() {
  return [...document.querySelectorAll(EDITABLE_SELECTOR)].filter((element) => {
    if (!isFocusableInput(element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function getNextKeyboardInput(element) {
  const inputs = getKeyboardInputs();
  const currentIndex = inputs.indexOf(element);
  return currentIndex >= 0 ? inputs[currentIndex + 1] : null;
}

export default function KeyboardDismissManager() {
  useEffect(() => {
    const hideNativeAccessoryBar = () => {
      if (Capacitor.getPlatform() !== "ios") return;
      Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
      Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
    };

    const markKeyboardOpen = () => {
      document.documentElement.classList.add("native-keyboard-open");
    };

    const markKeyboardClosed = () => {
      document.documentElement.classList.remove("native-keyboard-open");
    };

    const handleFocusIn = (event) => {
      hideNativeAccessoryBar();
      const target = event.target;
      if (isEditableElement(target)) markKeyboardOpen();
      if (!shouldBlurOnEnter(target)) return;
      const nextInput = getNextKeyboardInput(target);
      target.setAttribute("enterkeyhint", nextInput ? "next" : "done");
    };

    const handleFocusOut = (event) => {
      const target = event.target;
      if (!isEditableElement(target)) return;
      window.setTimeout(() => {
        if (!isEditableElement(document.activeElement)) markKeyboardClosed();
      }, 80);
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target;
      if (!shouldBlurOnEnter(target)) return;
      const nextInput = getNextKeyboardInput(target);
      window.requestAnimationFrame(() => {
        if (nextInput) {
          nextInput.focus?.();
          return;
        }
        target.blur?.();
      });
    };

    const handlePointerDown = (event) => {
      const activeElement = document.activeElement;
      if (!isEditableElement(activeElement)) return;
      const target = event.target;
      if (target?.closest?.(`${EDITABLE_SELECTOR}, [data-keep-keyboard='true']`)) return;
      activeElement.blur?.();
      markKeyboardClosed();
    };

    hideNativeAccessoryBar();
    let keyboardShowListener;
    let keyboardHideListener;
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener("keyboardWillShow", markKeyboardOpen).then((listener) => {
        keyboardShowListener = listener;
      }).catch(() => {});
      Keyboard.addListener("keyboardWillHide", markKeyboardClosed).then((listener) => {
        keyboardHideListener = listener;
      }).catch(() => {});
    }
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      markKeyboardClosed();
      keyboardShowListener?.remove?.();
      keyboardHideListener?.remove?.();
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  return null;
}
