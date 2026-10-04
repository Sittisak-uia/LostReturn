/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server instance starts.
 * Initializes persistent background server services such as MQTT subscriber.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMqttLockerSubscriber } = await import('@/lib/serverMqttSubscriber');
    console.log('[Instrumentation] Starting server-side MQTT Locker Subscriber...');
    startMqttLockerSubscriber();
  }
}
