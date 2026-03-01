import { useRef, useMemo } from 'react';

export function useDeepMemo<T>(value: T): T {
  const ref = useRef<{ value: T; json: string }>({
    value,
    json: JSON.stringify(value),
  });

  return useMemo(() => {
    const json = JSON.stringify(value);
    if (json !== ref.current.json) {
      ref.current = { value, json };
    }
    return ref.current.value;
  }, [value]);
}
