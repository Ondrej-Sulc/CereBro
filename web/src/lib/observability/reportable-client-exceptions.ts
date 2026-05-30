const ignoredDomEventConstructorNames = new Set([
  "CustomEvent",
  "Event",
  "ProgressEvent",
]);

export function isReportableClientException(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return true;
  }

  if (typeof Event !== "undefined" && error instanceof Event) {
    return false;
  }

  const constructorName = (error as { constructor?: { name?: string } }).constructor
    ?.name;
  return !(
    constructorName && ignoredDomEventConstructorNames.has(constructorName)
  );
}
