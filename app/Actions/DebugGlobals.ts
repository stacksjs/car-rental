export default new Action({
  name: 'DebugGlobals',
  description: 'Show what globals are exposed',
  method: 'GET',

  async handle() {
    const g = globalThis as any
    return response.json({
      Action: typeof g.Action,
      response: typeof g.response,
      schema: typeof g.schema,
      Auth: typeof g.Auth,
      Car: typeof g.Car,
      User: typeof g.User,
      authedUserId: typeof g.authedUserId,
      resolveAuthedUser: typeof g.resolveAuthedUser,
      defineModel: typeof g.defineModel,
      Middleware: typeof g.Middleware,
      log: typeof g.log,
    })
  },
})
