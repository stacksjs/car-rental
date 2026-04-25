export default new Action({
  name: 'IndexCarInSearch',
  description: 'Push/update a Car document in Meilisearch',

  async handle(car: any) {
    try {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      const search = (useSearchEngine as any)()
      if (search?.add) await search.add('cars', car)
    } catch {
      // search engine optional in dev
    }
    return { success: true }
  },
})
