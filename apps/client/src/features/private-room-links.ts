interface HashTarget {
  readonly location: { hash: string };
  addEventListener(type: "hashchange", listener: () => void): void;
  removeEventListener(type: "hashchange", listener: () => void): void;
}

/** Join the current code and any later code set by same-tab hash navigation. */
export function watchPrivateCodeHash(target: HashTarget, join: (code: string) => void): () => void {
  const check = () => {
    const code = new URLSearchParams(target.location.hash.slice(1)).get("code");
    if (code) join(code);
  };
  check();
  target.addEventListener("hashchange", check);
  return () => target.removeEventListener("hashchange", check);
}
