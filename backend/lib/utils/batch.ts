/**
 * Batch processing utilities
 */

/**
 * Split an array into chunks of specified size
 * @param array - Array to split
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Process items in parallel batches with a limit on concurrent operations
 * @param items - Items to process
 * @param batchSize - Number of items to process in parallel
 * @param processor - Function to process each item
 * @returns Array of results
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const batches = chunk(items, batchSize)
  const results: R[] = []

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    const batchResults = await Promise.allSettled(
      batch.map((item, itemIndex) => {
        const globalIndex = batchIndex * batchSize + itemIndex
        return processor(item, globalIndex)
      })
    )

    // Collect results (throw if any rejected)
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        // Re-throw the error to be handled by caller
        throw result.reason
      }
    }
  }

  return results
}
