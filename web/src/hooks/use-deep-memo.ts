import { useRef, useMemo } from 'react';

const unserializableMap = new WeakMap<object, string>();
let unserializableIdCounter = 0;

export function useDeepMemo<T>(value: T): T {
  const stringify = (val: T) => {
    try {
      return JSON.stringify(val);
    } catch {
      if (val !== null && typeof val === 'object') {
        const existing = unserializableMap.get(val as object);
        if (existing) return existing;
        
        const token = `__UNSERIALIZABLE__${unserializableIdCounter++}`;
        unserializableMap.set(val as object, token);
        return token;
      }
      return `__UNSERIALIZABLE__${unserializableIdCounter++}`;
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
