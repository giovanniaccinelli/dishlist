"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";
const KEYBOARD_VISIBLE_MARGIN = 18;

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

function getScrollableParent(element) {
  let current = element?.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(style.overflowY || "");
    if (canScrollY && current.scrollHeight > current.clientHeight + 1) return current;
    current = current.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function getVisibleBottom(keyboardHeight = 0) {
  if (keyboardHeight > 0) {
    return Math.max(KEYBOARD_VISIBLE_MARGIN, window.innerHeight - keyboardHeight - KEYBOARD_VISIBLE_MARGIN);
  }
  const viewport = window.visualViewport;
  if (viewport?.height) {
    return Math.max(KEYBOARD_VISIBLE_MARGIN, viewport.height + viewport.offsetTop - KEYBOARD_VISIBLE_MARGIN);
  }
  return window.innerHeight - KEYBOARD_VISIBLE_MARGIN;
}

function keepElementAboveKeyboard(element, keyboardHeight = 0) {
  if (!element?.getBoundingClientRect) return;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const visibleBottom = getVisibleBottom(keyboardHeight);
  const overflow = rect.bottom - visibleBottom;
  if (overflow <= 0) return;

  const scrollTarget = getScrollableParent(element);
  if (scrollTarget === document.documentElement || scrollTarget === document.body) {
    window.scrollBy(0, overflow);
    return;
  }
  scrollTarget.scrollTop += overflow;
}

function keepTypingSurfaceVisible(keyboardHeight = 0) {
  const activeElement = document.activeElement;
  if (isEditableElement(activeElement)) {
    keepElementAboveKeyboard(activeElement, keyboardHeight);
  }

  const uploadNextButton = document.querySelector(".dish-modal-next-btn");
  if (uploadNextButton) {
    keepElementAboveKeyboard(uploadNextButton, keyboardHeight);
  }
}

export default function KeyboardDismissManager() {
  useEffect(() => {
    const configureNativeKeyboard = () => {
      if (Capacitor.getPlatform() !== "ios") return;
      Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
      Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
    };

    const setKeyboardHeight = (keyboardHeight = 0) => {
      const height = Math.max(0, Number(keyboardHeight || 0));
      document.documentElement.style.setProperty("--keyboard-height", `${height}px`);
    };

    const markKeyboardOpen = (keyboardHeight = 0) => {
      setKeyboardHeight(keyboardHeight);
      document.documentElement.classList.add("native-keyboard-open");
      keepTypingSurfaceVisible(keyboardHeight);
    };

    const markKeyboardClosed = () => {
      document.documentElement.classList.remove("native-keyboard-open");
      document.documentElement.style.removeProperty("--keyboard-height");
    };

    const handleFocusIn = (event) => {
      const target = event.target;
      if (isEditableElement(target)) {
        markKeyboardOpen();
        keepTypingSurfaceVisible();
        window.requestAnimationFrame(() => keepTypingSurfaceVisible());
        window.setTimeout(() => keepTypingSurfaceVisible(), 80);
        window.setTimeout(() => keepTypingSurfaceVisible(), 180);
      }
      if (!shouldBlurOnEnter(target)) return;
      const nextInput = getNextKeyboardInput(target);
      target.setAttribute("enterkeyhint", nextInput ? "next" : "done");
    };

    const handleFocusOut = (event) => {
      const target = event.target;
      if (!isEditableElement(target)) return;
      window.setTimeout(() => {
        if (!isEditableElement(document.activeElement)) markKeyboardClosed();
      }, 60);
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

    configureNativeKeyboard();
    let keyboardShowListener;
    let keyboardHideListener;
    if (Capacitor.isNativePlatform()) {
      Keyboard.addListener("keyboardWillShow", (info) => {
        const keyboardHeight = Number(info?.keyboardHeight || 0);
        markKeyboardOpen(keyboardHeight);
        keepTypingSurfaceVisible(keyboardHeight);
        window.requestAnimationFrame(() => keepTypingSurfaceVisible(keyboardHeight));
      }).then((listener) => {
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
