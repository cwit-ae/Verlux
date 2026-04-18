/**
 * Aho-Corasick automaton — finds every occurrence of any pattern in a text
 * in O(n + m + z) time, where n = text length, m = total pattern length,
 * z = number of matches. Independent of how many patterns are registered.
 *
 * Used for the `allowPartialMatch: true` tier: given a normalized input
 * string, locate any dictionary word that appears inside it (e.g. "fuck"
 * inside "fuuucking" after repeat-collapse). The previous implementation
 * iterated the dictionary per-input; AC flips that to a single text scan.
 *
 * Implementation notes:
 *   - Goto transitions live on per-node char→node maps (sparse, since
 *     profanity patterns share small alphabets).
 *   - Failure links are built via BFS from the root.
 *   - Output links chain every accepting state reachable via failure so
 *     all overlapping matches surface in one pass.
 */

export interface AhoMatch<T> {
  /** Pattern that matched */
  pattern: string;
  /** Value associated with the pattern when it was added */
  value: T;
  /** Start index in the scanned text (inclusive) */
  start: number;
  /** End index in the scanned text (exclusive) */
  end: number;
}

interface Node<T> {
  goto: Map<number, Node<T>>;
  fail: Node<T> | null;
  output: Node<T> | null;
  patterns: Array<{ pattern: string; value: T }>;
  depth: number;
}

export class AhoCorasick<T> {
  private root: Node<T>;
  private built: boolean = false;

  constructor() {
    this.root = this.makeNode(0);
    this.root.fail = this.root;
  }

  private makeNode(depth: number): Node<T> {
    return {
      goto: new Map(),
      fail: null,
      output: null,
      patterns: [],
      depth,
    };
  }

  /** Register a pattern. Must be called before `build()`. */
  add(pattern: string, value: T): void {
    if (!pattern) return;
    let node = this.root;
    for (let i = 0; i < pattern.length; i++) {
      const code = pattern.charCodeAt(i);
      let next = node.goto.get(code);
      if (!next) {
        next = this.makeNode(node.depth + 1);
        node.goto.set(code, next);
      }
      node = next;
    }
    node.patterns.push({ pattern, value });
  }

  /**
   * Finalize the automaton by computing failure and output links.
   * Safe to call repeatedly (idempotent after first build).
   */
  build(): void {
    if (this.built) return;
    const queue: Node<T>[] = [];

    // Depth-1 nodes: failure link is the root.
    for (const child of this.root.goto.values()) {
      child.fail = this.root;
      queue.push(child);
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const [code, child] of node.goto) {
        queue.push(child);

        // Walk failure chain from parent to find longest proper suffix
        // that is also a prefix in the trie.
        let fail = node.fail!;
        while (fail !== this.root && !fail.goto.has(code)) {
          fail = fail.fail!;
        }
        const candidate = fail.goto.get(code);
        child.fail = candidate && candidate !== child ? candidate : this.root;

        // Output link: nearest accepting ancestor along the failure chain.
        child.output = child.fail.patterns.length > 0 ? child.fail : child.fail.output;
      }
    }

    this.built = true;
  }

  /**
   * Scan `text` and yield every pattern occurrence. The automaton must be
   * built first; if not, `build()` is called lazily.
   */
  search(text: string): AhoMatch<T>[] {
    if (!this.built) this.build();
    const results: AhoMatch<T>[] = [];
    let node = this.root;

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      // Follow failure links until we find a goto or hit root.
      while (node !== this.root && !node.goto.has(code)) {
        node = node.fail!;
      }
      const next = node.goto.get(code);
      if (next) node = next;

      // Emit current node's patterns plus everything reachable via output links.
      if (node.patterns.length > 0) {
        for (const p of node.patterns) {
          results.push({
            pattern: p.pattern,
            value: p.value,
            start: i - p.pattern.length + 1,
            end: i + 1,
          });
        }
      }
      let out = node.output;
      while (out) {
        for (const p of out.patterns) {
          results.push({
            pattern: p.pattern,
            value: p.value,
            start: i - p.pattern.length + 1,
            end: i + 1,
          });
        }
        out = out.output;
      }
    }

    return results;
  }

  /** True if at least one pattern has been added. */
  get hasPatterns(): boolean {
    return this.root.goto.size > 0;
  }
}
