const IGNORED_BROWSER_ERROR_MESSAGES = [
  "ResizeObserver loop completed with undelivered notifications.",
  "ResizeObserver loop limit exceeded",
];

let browserErrorFilterInstalled = false;

export function isIgnoredBrowserErrorMessage(message: unknown): boolean {
  return (
    typeof message === "string" &&
    IGNORED_BROWSER_ERROR_MESSAGES.some((ignored) => message.includes(ignored))
  );
}

export function installIgnoredBrowserErrorFilter(): void {
  if (typeof window === "undefined") return;
  if (browserErrorFilterInstalled) return;
  browserErrorFilterInstalled = true;

  window.addEventListener(
    "error",
    (event) => {
      if (!isIgnoredBrowserErrorMessage(event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );
}
