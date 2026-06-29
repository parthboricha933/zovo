import { db } from './db'
import { pushToUser } from './realtime-push'

export interface CreateNotificationInput {
  userId: string
  type: string
  title: string
  body: string
  data?: any
}

/**
 * Persists a notification and pushes it to the user via the realtime service.
 */
export async function notify({ userId, type, title, body, data }: CreateNotificationInput) {
  const n = await db.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      dataJson: data ? JSON.stringify(data) : null,
    },
  })
  await pushToUser(userId, 'notification', {
    id: n.id,
    type,
    title,
    body,
    data,
    createdAt: n.createdAt,
    readAt: null,
  })
  return n
}
