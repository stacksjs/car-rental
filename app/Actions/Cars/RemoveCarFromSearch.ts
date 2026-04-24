import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'RemoveCarFromSearch',
  description: 'Remove a Car document from Meilisearch',

  async handle(car: any) {
    try {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      const search = (useSearchEngine as any)()
      if (search?.delete) await search.delete('cars', car?.id)
    } catch {
      // search engine optional
    }
    return { success: true }
  },
})
