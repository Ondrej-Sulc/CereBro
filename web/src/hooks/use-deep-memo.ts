import { useRef, useMemo } from 'react';

let unserializableCounter = 0;

export function useDeepMemo<T>(value: T): T {
  const stringify = (val: T) => {
    try {
      return JSON.stringify(val);
    } catch {
      return `__UNSERIALIZABLE__${unserializableCounter++}`;
    }
  };

  const ref = useRef<{ value: T; json: string }>({
    value,
    json: stringify(value),
  });

  return useMemo(() => {
    const json = stringify(value);
    if (json !== ref.current.json) {
      ref.current = { value, json };
    }
    return ref.current.value;
  }, [value]);
}
