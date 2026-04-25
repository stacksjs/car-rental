import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'


export default new Job({
  name: 'ReindexCars',
  description: 'Bulk-reindex active cars into Meilisearch',
  queue: 'default',
  tries: 3,
  backoff: 120,
  rate: Every.Day,

  handle: async () => {
    try {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      const search = (useSearchEngine as any)()
      if (!search?.add) return { skipped: true }

      const cars = await Car.query().where('status', 'active').get()
      for (const car of cars as any[]) {
        await search.add('cars', car)
      }
      return { indexed: (cars as any[]).length }
    } catch (err) {
      return { error: (err as Error).message }
    }
  },
})
