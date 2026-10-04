import mqtt from 'mqtt';

const brokerUrl = process.env.MQTT_BROKER_URL;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;

if (!brokerUrl) {
  console.warn('[MQTT Server] Warning: MQTT_BROKER_URL environment variable is not defined.');
}

/**
 * Publish an MQTT message securely from the server side.
 */
export async function publishMqttServer(topic: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!brokerUrl) {
      const errMessage = '[MQTT Server] Cannot publish message: MQTT_BROKER_URL environment variable is missing.';
      console.error(errMessage);
      return reject(new Error(errMessage));
    }

    const clientId = `lostreturn-server-${Math.random().toString(16).slice(2, 8)}`;
    const client = mqtt.connect(brokerUrl, {
      clientId,
      connectTimeout: 8000,
      username: username || undefined,
      password: password || undefined,
    });

    const timeout = setTimeout(() => {
      client.end(true);
      console.error('[MQTT Server] Connection timeout for topic:', topic);
      reject(new Error('MQTT connection timeout'));
    }, 6000);

    client.on('connect', () => {
      client.publish(topic, message, { qos: 1 }, (err) => {
        clearTimeout(timeout);
        client.end(true);
        if (err) {
          console.error('[MQTT Server] Publish error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      console.error('[MQTT Server] Error connecting to broker:', err);
      reject(err);
    });
  });
}
