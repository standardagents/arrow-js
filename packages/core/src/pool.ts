/**
 * A memory pool for reusing objects of the same type. This architecture
 * greatly minimizes the need for garbage collection, which is a major source
 * of slowdowns in JavaScript programs in general.
 */
export interface Pool<T, A extends unknown[]> {
  /**
   * Accepts user defined arguments and assigns those arguments to properties
   * on a pool object. This is the primary mechanism for "creating" and reusing
   * objects.
   * @param this - The pool object.
   * @param args - User defined arguments.
   */
  allocate: (this: Pool<T, A>, ...args: A) => T
  /**
   * Creates a new empty object for assignment in the pool.
   * @returns
   */
  create: () => T
  /**
   * The actual array of pool objects.
   */
  data: T[]
  /**
   * Frees a node object for reuse.
   * @param node - A node object to free.
   */
  free: (node: T) => T
  /**
   * Grow the size of the pool by a given number of nodes.
   * @param this - The pool object.
   * @param size - The number of nodes to add to the pool.
   */
  grow: (this: Pool<T, A>, size: number) => Pool<T, A>
  /**
   * The next free item in the pool.
   */
  head?: T
  /**
   * The initial size of the pool, used to grow the pool when it is exhausted.
   */
  size: number
  /**
   * Pops the next free item from the pool, growing the slab if necessary.
   */
  next: () => T
}

/**
 * Nodes in the memory pool must implement this interface.
 * @public
 */
export interface PoolNode<T> {
  /**
   * A reference to the "next" free node in the pool.
   */
  next?: T
}

/**
 * Creates a new memory pool. The pool is initialized with a number of nodes
 * which are created by the `create` function. The `allocate` function is used
 * anytime a new node is added to the pool. The allocate function can accept
 * any number of arguments, which are then assigned to the next free node in the
 * pool.
 *
 * It is the implementor's responsibility to retrieve the next free node
 * from the pool and assign the arguments to that node. `next()` pops the
 * current head node and advances the free list automatically. The allocate
 * function should return the populated node and should be written with the
 * `function` keyword, not the arrow function syntax.
 *
 * @param initialSize - The initial size of the pool.
 * @param create - A function that creates a new PoolNode of the desired shape.
 * @param allocate - A function that accepts user defined arguments and assigns them to the next free node.
 * @returns
 */
export function createPool<
  T extends PoolNode<T>,
  A extends unknown[]
>(
  size: number,
  create: () => T,
  allocate: (this: Pool<T, A>, ...args: A) => T
): Pool<T, A> {
  const data: T[] = []
  const pool: Pool<T, A> = {
    data,
    create,
    allocate,
    free,
    grow,
    head: undefined,
    size,
    next,
  }
  pool.grow(size)
  return pool
}

/**
 *
 * @param pool
 * @param create
 * @param size
 * @returns
 */
function grow<T extends PoolNode<T>, A extends unknown[]>(
  this: Pool<T, A>,
  size: number
): Pool<T, A> {
  let first: T | undefined
  let previous: T | undefined
  for (let i = 0; i < size; i++) {
    const node = this.create()
    this.data.push(node)
    if (previous) previous.next = node
    else first = node
    previous = node
  }
  if (previous) {
    previous.next = this.head
    this.head = first
  }
  return this
}

/**
 *
 * @param this - Free a node for reuse.
 * @param node -
 */
function free<T extends PoolNode<T>, A extends unknown[]>(
  this: Pool<T, A>,
  node: T
): T {
  node.next = this.head
  this.head = node
  return node
}

/**
 * Retrieves the next item from the pool, if necessary it will grow the pool.
 * @param this
 * @returns
 */
function next<T extends PoolNode<T>, A extends unknown[]>(this: Pool<T, A>): T {
  if (!this.head) this.grow(this.size)
  const node = this.head!
  this.head = node.next
  node.next = undefined
  return node
}
