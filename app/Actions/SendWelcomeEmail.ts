export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Sends a welcome email to newly registered users',

  async handle(input: UserRegisteredEvent | RequestInstance) {
    // Runs in two contexts:
    //   1. As a `user:registered` event listener — input is the
    //      `UserRegisteredEvent` payload dispatched by RegisterAction.
    //   2. As a request-driven action — input is a RequestInstance whose
    //      fields are read through `.get(key)`.
    // Detect by checking for the request-shaped accessor and fall back to
    // plain property access otherwise.
    const isRequest = (v: unknown): v is RequestInstance =>
      typeof (v as { get?: unknown })?.get === 'function'
    const to = isRequest(input)
      ? (input.get('to') as string | undefined) ?? (input.get('email') as string | undefined)
      : (input.to ?? input.email)
    const name = (isRequest(input)
      ? input.get('name') as string | undefined
      : input.name) || 'there'

    if (!to) {
      log.warn('[SendWelcomeEmail] no recipient resolved — skipping')
      return { success: false, message: 'no recipient' }
    }

    log.debug(`[action] Sending welcome email to ${to}`)

    const { html, text } = await template('welcome', {
      subject: 'Welcome to Drivly!',
      variables: { name, email: to },
    })

    await mail.send({
      to,
      subject: 'Welcome to Drivly!',
      html,
      text,
    })

    log.info(`[action] Welcome email sent to ${to}`)

    return {
      success: true,
      message: `Welcome email sent to ${to}`,
    }
  },
})
