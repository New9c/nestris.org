export class CircularBuffer<T> {
    private buffer: Array<T | undefined>;
    private size: number;
    private start: number = 0;
    private count: number = 0;
  
    /**
     * Creates a new CircularBuffer with the specified capacity
     * @param capacity The maximum number of elements the buffer can hold
     */
    constructor(capacity: number) {
      if (capacity <= 0) {
        throw new Error("Capacity must be greater than 0");
      }
      this.size = capacity;
      this.buffer = new Array<T | undefined>(capacity);
    }
  
    /**
     * Adds an element to the buffer, potentially overwriting the oldest element
     * if the buffer is full
     * @param item The item to add to the buffer
     * @returns The overwritten item, if any
     */
    push(item: T): T | undefined {
      const overwritten = this.isFull() ? this.buffer[(this.start + this.count - 1) % this.size] : undefined;
      
      if (this.isFull()) {
        // If buffer is full, we'll overwrite the oldest element
        this.start = (this.start + 1) % this.size;
      } else {
        // If buffer isn't full yet, increment the count
        this.count++;
      }
      
      // Add new item at the end
      const end = (this.start + this.count - 1) % this.size;
      this.buffer[end] = item;
      
      return overwritten;
    }
  
    /**
     * Retrieves and removes the oldest element from the buffer
     * @returns The oldest element, or undefined if the buffer is empty
     */
    pop(): T | undefined {
      if (this.isEmpty()) {
        return undefined;
      }
  
      const item = this.buffer[this.start];
      this.buffer[this.start] = undefined;
      this.start = (this.start + 1) % this.size;
      this.count--;
      
      return item;
    }
  
    /**
     * Gets the element at the specified index
     * @param index The index of the element to retrieve (0 is the oldest element)
     * @returns The element at the specified index
     */
    get(index: number): T | undefined {
      if (index < 0 || index >= this.count) {
        return undefined;
      }
      
      return this.buffer[(this.start + index) % this.size];
    }
  
    /**
     * @returns The oldest element in the buffer without removing it
     */
    peek(): T | undefined {
      if (this.isEmpty()) {
        return undefined;
      }
      
      return this.buffer[this.start];
    }
  
    /**
     * @returns The newest element in the buffer without removing it
     */
    peekLast(): T | undefined {
      if (this.isEmpty()) {
        return undefined;
      }
      
      return this.buffer[(this.start + this.count - 1) % this.size];
    }
  
    /**
     * @returns Whether the buffer is empty
     */
    isEmpty(): boolean {
      return this.count === 0;
    }
  
    /**
     * @returns Whether the buffer is full
     */
    isFull(): boolean {
      return this.count === this.size;
    }
  
    /**
     * @returns The current number of elements in the buffer
     */
    length(): number {
      return this.count;
    }
  
    /**
     * @returns The maximum capacity of the buffer
     */
    capacity(): number {
      return this.size;
    }
  
    /**
     * Clears all elements from the buffer
     */
    clear(): void {
      this.buffer.fill(undefined);
      this.start = 0;
      this.count = 0;
    }
  
    /**
     * Converts the buffer to an array, with the oldest element first
     * @returns An array containing all elements in the buffer
     */
    toArray(): T[] {
      const result: T[] = [];
      
      for (let i = 0; i < this.count; i++) {
        const item = this.buffer[(this.start + i) % this.size];
        if (item !== undefined) {
          result.push(item);
        }
      }
      
      return result;
    }
  
    /**
     * Creates an iterator that yields each element in the buffer from oldest to newest
     */
    *[Symbol.iterator](): Iterator<T> {
      for (let i = 0; i < this.count; i++) {
        const item = this.buffer[(this.start + i) % this.size];
        if (item !== undefined) {
          yield item;
        }
      }
    }
  }