import type { CollectionHighlight, Cost, OpStep, OpTrace, StructureDef } from './types';

/**
 * SortedDictionary<int, int>. In .NET it stores KeyValuePairs in a TreeSet (a SortedSet), which is a
 * red-black tree built top-down: on the way down an insert splits 4-nodes (a black node with two red
 * children) and a remove turns 2-nodes into 3- or 4-nodes, with rotations where needed. This is a direct
 * port of SortedSet<T>.AddIfNotPresent / DoRemove / FindNode and their Node helpers, so the shapes match .NET.
 * https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/SortedSet.cs
 * https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/SortedDictionary.cs
 */
export interface RBNode {
  id: number;
  key: number;
  value: number;
  red: boolean;
  left: RBNode | null;
  right: RBNode | null;
}
export interface SortedState {
  root: RBNode | null;
  count: number;
  nextId: number;
}

export const MAX_SORTED = 15;
const COST: Cost = { ops: '`SortedDictionary<TKey, TValue>`', cost: 'O(log n) per op', source: 'notes' };

const cloneNode = (n: RBNode | null): RBNode | null => (n ? { ...n, left: cloneNode(n.left), right: cloneNode(n.right) } : null);
export const cloneSorted = (s: SortedState): SortedState => ({ ...s, root: cloneNode(s.root) });

const isRed = (n: RBNode | null): n is RBNode => n !== null && n.red;
const isNullOrBlack = (n: RBNode | null) => n === null || !n.red;
const is2Node = (n: RBNode) => !n.red && isNullOrBlack(n.left) && isNullOrBlack(n.right);
const is4Node = (n: RBNode) => isRed(n.left) && isRed(n.right);

function rotateLeft(n: RBNode): RBNode {
  const child = n.right!;
  n.right = child.left;
  child.left = n;
  return child;
}
function rotateRight(n: RBNode): RBNode {
  const child = n.left!;
  n.left = child.right;
  child.right = n;
  return child;
}
function rotateLeftRight(n: RBNode): RBNode {
  const child = n.left!;
  const grand = child.right!;
  n.left = grand.right;
  grand.right = n;
  child.right = grand.left;
  grand.left = child;
  return grand;
}
function rotateRightLeft(n: RBNode): RBNode {
  const child = n.right!;
  const grand = child.left!;
  n.right = grand.left;
  grand.left = n;
  child.left = grand.right;
  grand.right = child;
  return grand;
}
type Rotation = 'Left' | 'Right' | 'LeftRight' | 'RightLeft';
function getRotation(parent: RBNode, current: RBNode, sibling: RBNode): Rotation {
  const currentIsLeftChild = parent.left === current;
  return isRed(sibling.left) ? (currentIsLeftChild ? 'RightLeft' : 'Right') : currentIsLeftChild ? 'Left' : 'LeftRight';
}
function rotate(n: RBNode, r: Rotation): RBNode {
  switch (r) {
    case 'Right':
      n.left!.left!.red = false;
      return rotateRight(n);
    case 'Left':
      n.right!.right!.red = false;
      return rotateLeft(n);
    case 'RightLeft':
      return rotateRightLeft(n);
    case 'LeftRight':
      return rotateLeftRight(n);
  }
}
const sibling = (parent: RBNode, node: RBNode) => (node === parent.left ? parent.right! : parent.left!);

class Tree {
  steps: OpStep<SortedState>[] = [];
  compares = 0;
  constructor(public s: SortedState) {}
  push(narration: string, hl: CollectionHighlight = {}) {
    this.steps.push({ state: cloneSorted(this.s), narration, hl });
  }
  private replaceChildOrRoot(parent: RBNode | null, child: RBNode, newChild: RBNode | null) {
    if (parent) {
      if (parent.left === child) parent.left = newChild;
      else parent.right = newChild;
    } else this.s.root = newChild;
  }
  /** Returns the (possibly new) parent, mirroring `ref Node parent`. */
  private insertionBalance(current: RBNode, parent: RBNode, grandParent: RBNode, greatGrandParent: RBNode | null): RBNode {
    const parentIsOnRight = grandParent.right === parent;
    const currentIsOnRight = parent.right === current;
    let newChild: RBNode;
    let newParent = parent;
    if (parentIsOnRight === currentIsOnRight) newChild = currentIsOnRight ? rotateLeft(grandParent) : rotateRight(grandParent);
    else {
      newChild = currentIsOnRight ? rotateLeftRight(grandParent) : rotateRightLeft(grandParent);
      newParent = greatGrandParent!;
    }
    grandParent.red = true;
    newChild.red = false;
    this.replaceChildOrRoot(greatGrandParent, grandParent, newChild);
    this.push(`Two reds in a row: ${parentIsOnRight === currentIsOnRight ? 'a single' : 'a double'} rotation at ${grandParent.key} lifts ${newChild.key} up and recolours, so the tree stays balanced.`, { write: [newChild.id, grandParent.id] });
    return newParent;
  }

  findNode(key: number): RBNode | null {
    let current = this.s.root;
    while (current) {
      this.compares++;
      const order = Math.sign(key - current.key);
      this.push(order === 0 ? `${key} == ${current.key}: found.` : `${key} ${order < 0 ? '<' : '>'} ${current.key}: go ${order < 0 ? 'left' : 'right'}.`, order === 0 ? { found: [current.id] } : { compare: [current.id] });
      if (order === 0) return current;
      current = order < 0 ? current.left : current.right;
    }
    this.push(`Fell off the tree: ${key} is not a key.`);
    return null;
  }

  /** SortedSet<T>.AddIfNotPresent. */
  add(key: number, value: number): boolean {
    if (!this.s.root) {
      this.s.root = { id: this.s.nextId++, key, value, red: false, left: null, right: null };
      this.s.count = 1;
      this.push(`The tree was empty: ${key} becomes the (black) root.`, { write: [this.s.root.id] });
      return true;
    }
    let current: RBNode | null = this.s.root;
    let parent: RBNode | null = null;
    let grandParent: RBNode | null = null;
    let greatGrandParent: RBNode | null = null;
    let order = 0;
    while (current) {
      this.compares++;
      order = Math.sign(key - current.key);
      if (order === 0) {
        this.s.root.red = false;
        this.push(`${key} == ${current.key}: the key is already there.`, { found: [current.id] });
        return false;
      }
      this.push(`${key} ${order < 0 ? '<' : '>'} ${current.key}: go ${order < 0 ? 'left' : 'right'}.`, { compare: [current.id] });
      if (is4Node(current)) {
        current.red = true;
        current.left!.red = false;
        current.right!.red = false;
        this.push(`${current.key} has two red children (a 4-node): split it on the way down by recolouring.`, { active: [current.id, current.left!.id, current.right!.id] });
        if (isRed(parent)) parent = this.insertionBalance(current, parent, grandParent!, greatGrandParent);
      }
      greatGrandParent = grandParent;
      grandParent = parent;
      parent = current;
      current = order < 0 ? current.left : current.right;
    }
    const node: RBNode = { id: this.s.nextId++, key, value, red: true, left: null, right: null };
    if (order > 0) parent!.right = node;
    else parent!.left = node;
    this.s.count++;
    this.push(`Attach ${key} as a red ${order > 0 ? 'right' : 'left'} child of ${parent!.key}.`, { write: [node.id] });
    if (parent!.red) this.insertionBalance(node, parent!, grandParent!, greatGrandParent);
    if (this.s.root.red) {
      this.s.root.red = false;
      this.push('The root is always black, so recolour it.', { active: [this.s.root.id] });
    }
    return true;
  }

  /** SortedSet<T>.DoRemove. */
  remove(key: number): boolean {
    if (!this.s.root) {
      this.push(`The dictionary is empty: Remove returns false.`);
      return false;
    }
    let current: RBNode | null = this.s.root;
    let parent: RBNode | null = null;
    let grandParent: RBNode | null = null;
    let match: RBNode | null = null;
    let parentOfMatch: RBNode | null = null;
    let foundMatch = false;
    while (current) {
      if (is2Node(current)) {
        if (!parent) {
          current.red = true;
        } else {
          let sib = sibling(parent, current);
          if (sib.red) {
            if (parent.right === sib) rotateLeft(parent);
            else rotateRight(parent);
            parent.red = true;
            sib.red = false;
            this.replaceChildOrRoot(grandParent, parent, sib);
            grandParent = sib;
            if (parent === match) parentOfMatch = sib;
            sib = sibling(parent, current);
            this.push(`On the way down, ${current.key} is a 2-node with a red sibling: rotate at ${parent.key} first.`, { write: [grandParent.id, parent.id] });
          }
          if (is2Node(sib)) {
            parent.red = false;
            current.red = true;
            sib.red = true;
            this.push(`${current.key} and its sibling ${sib.key} are both 2-nodes: merge them with ${parent.key} by recolouring.`, { active: [parent.id, current.id, sib.id] });
          } else {
            const newGrandParent = rotate(parent, getRotation(parent, current, sib));
            newGrandParent.red = parent.red;
            parent.red = false;
            current.red = true;
            this.replaceChildOrRoot(grandParent, parent, newGrandParent);
            if (parent === match) parentOfMatch = newGrandParent;
            this.push(`${current.key} is a 2-node: borrow from its sibling with a rotation at ${parent.key}.`, { write: [newGrandParent.id, parent.id] });
          }
        }
      }
      let order: number;
      if (foundMatch) order = -1;
      else {
        this.compares++;
        order = Math.sign(key - current.key);
        this.push(order === 0 ? `${key} == ${current.key}: this is the node to remove. Keep going right, then left, to find its successor.` : `${key} ${order < 0 ? '<' : '>'} ${current.key}: go ${order < 0 ? 'left' : 'right'}.`, order === 0 ? { found: [current.id] } : { compare: [current.id] });
      }
      if (order === 0) {
        foundMatch = true;
        match = current;
        parentOfMatch = parent;
      }
      grandParent = parent;
      parent = current;
      current = order < 0 ? current.left : current.right;
    }
    if (match) {
      const successor = parent!;
      this.replaceNode(match, parentOfMatch, successor, grandParent);
      this.s.count--;
      this.push(successor === match ? `Remove ${key}: it had no right subtree, so its left child takes its place.` : `Replace ${key} with its in-order successor ${successor.key}, then unlink the successor's old spot.`, successor === match ? {} : { write: [successor.id] });
    } else this.push(`${key} is not a key: Remove returns false.`);
    if (this.s.root) this.s.root.red = false;
    return foundMatch;
  }

  private replaceNode(match: RBNode, parentOfMatch: RBNode | null, successor: RBNode, parentOfSuccessor: RBNode | null) {
    let succ: RBNode | null = successor;
    if (successor === match) succ = match.left;
    else {
      if (successor.right) successor.right.red = false;
      if (parentOfSuccessor !== match) {
        parentOfSuccessor!.left = successor.right;
        successor.right = match.right;
      }
      successor.left = match.left;
    }
    if (succ) succ.red = match.red;
    this.replaceChildOrRoot(parentOfMatch, match, succ);
  }
}

export function sortedFrom(keys: readonly number[]): SortedState {
  const t = new Tree({ root: null, count: 0, nextId: 0 });
  keys.forEach((k, i) => t.add(k, i + 1));
  return t.s;
}

/** Keys in order (what foreach yields). */
export function inOrder(n: RBNode | null, out: RBNode[] = []): RBNode[] {
  if (n) {
    inOrder(n.left, out);
    out.push(n);
    inOrder(n.right, out);
  }
  return out;
}

const work = (t: Tree) => `${t.compares} key comparison${t.compares === 1 ? '' : 's'}`;

export const SORTED_DEF: StructureDef<SortedState> = {
  id: 'sorted-dictionary',
  title: 'SortedDictionary<TKey, TValue>',
  variable: 'dict',
  section: '## 4. Ordered / Sorted Structures',
  costs: [COST],
  initial: () => sortedFrom([40, 20, 60, 10, 30, 50, 70]),
  setup: 'var dict = new SortedDictionary<int, int>(); // then dict[40] = 1, dict[20] = 2, … dict[70] = 7',
  ops: [
    {
      id: 'set',
      label: 'dict[key] = value',
      arg: 'key-value',
      run: (s, k, v) => {
        const call = `dict[${k}] = ${v};`;
        const t = new Tree(cloneSorted(s));
        const node = t.findNode(k);
        if (node) {
          const old = node.value;
          node.value = v;
          t.push(`${k} is already a key: replace its value ${old} with ${v}. The tree's shape does not change.`, { write: [node.id] });
        } else {
          if (s.count >= MAX_SORTED) return { call, cost: COST, work: 'nothing', steps: [], error: `This demo stops at ${MAX_SORTED} keys.` };
          t.push('Not found, so the indexer calls Add, which walks down from the root again.');
          t.add(k, v);
        }
        return { call, cost: COST, work: work(t), steps: t.steps };
      },
    },
    {
      id: 'add',
      label: 'Add(key, value)',
      arg: 'key-value',
      run: (s, k, v) => {
        const call = `dict.Add(${k}, ${v});`;
        if (s.count >= MAX_SORTED) return { call, cost: COST, work: 'nothing', steps: [], error: `This demo stops at ${MAX_SORTED} keys.` };
        const t = new Tree(cloneSorted(s));
        const added = t.add(k, v);
        return added
          ? { call, cost: COST, work: work(t), steps: t.steps }
          : { call, cost: COST, work: work(t), steps: t.steps, error: `ArgumentException: the key ${k} is already in the dictionary.` };
      },
    },
    {
      id: 'contains',
      label: 'ContainsKey(key)',
      arg: 'key',
      run: (s, k) => {
        const t = new Tree(cloneSorted(s));
        const found = t.findNode(k) !== null;
        t.push(`ContainsKey returns ${found}.`, t.steps.at(-1)?.hl ?? {});
        return { call: `dict.ContainsKey(${k});`, cost: COST, work: work(t), steps: t.steps };
      },
    },
    {
      id: 'remove',
      label: 'Remove(key)',
      arg: 'key',
      run: (s, k) => {
        const t = new Tree(cloneSorted(s));
        const ok = t.remove(k);
        t.push(`Remove returns ${ok}.`);
        return { call: `dict.Remove(${k});`, cost: COST, work: work(t), steps: t.steps };
      },
    },
    {
      id: 'foreach',
      label: 'foreach (in order)',
      arg: 'none',
      run: (s) => {
        const t = new Tree(cloneSorted(s));
        const seen: number[] = [];
        for (const n of inOrder(t.s.root)) {
          seen.push(n.id);
          t.push(`Yields [${n.key}, ${n.value}]. An in-order walk always visits keys from smallest to largest.`, { found: [...seen.slice(0, -1)], active: [n.id] });
        }
        if (!seen.length) t.push('The dictionary is empty: the loop body never runs.');
        return { call: 'foreach (var (key, value) in dict)', cost: null, work: `visited ${seen.length} key${seen.length === 1 ? '' : 's'} in sorted order`, steps: t.steps };
      },
    },
  ],
  simplified: 'Red and black are shown as thin and thick rings, not as colours, so they do not clash with the step colours.',
  summary: (s) => `Count ${s.count} · height ${height(s.root)}`,
};

export function height(n: RBNode | null): number {
  return n ? 1 + Math.max(height(n.left), height(n.right)) : 0;
}
