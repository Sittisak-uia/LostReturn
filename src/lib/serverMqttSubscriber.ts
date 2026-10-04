import mqtt, { MqttClient } from 'mqtt';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Global singleton pattern to prevent duplicate MQTT clients during Next.js hot reload in development
declare global {
  var __mqttLockerSubscriberClient: MqttClient | undefined;
  var __mqttSubscriberStatus: {
    connected: boolean;
    lastConnectedAt: string | null;
    lastMessageAt: string | null;
    lastMessageTopic: string | null;
    lastMessagePayload: string | null;
    lastError: string | null;
  } | undefined;
}

const statusState = globalThis.__mqttSubscriberStatus || {
  connected: false,
  lastConnectedAt: null,
  lastMessageAt: null,
  lastMessageTopic: null,
  lastMessagePayload: null,
  lastError: null,
};
globalThis.__mqttSubscriberStatus = statusState;

export function getMqttSubscriberStatus() {
  return { ...statusState };
}

/**
 * Initializes and starts the background server-side MQTT subscriber.
 * Listens to ESP32 locker telemetry (lostreturn/locker/+/status) and writes updates to Supabase 'lockers' table.
 */
export function startMqttLockerSubscriber(): MqttClient | null {
  if (typeof window !== 'undefined') {
    // This is strictly a server-side service
    return null;
  }

  // If already running and connected, return existing singleton
  if (globalThis.__mqttLockerSubscriberClient) {
    console.log('[MQTT Server Subscriber] Reusing existing MQTT subscriber client');
    return globalThis.__mqttLockerSubscriberClient;
  }

  const brokerUrl = process.env.MQTT_BROKER_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!brokerUrl) {
    const errorMsg = '[MQTT Server Subscriber] Missing MQTT_BROKER_URL environment variable';
    console.error(errorMsg);
    statusState.lastError = errorMsg;
    return null;
  }

  console.log('[MQTT Server Subscriber] Connecting to HiveMQ Cloud:', brokerUrl);

  const clientId = `lostreturn-server-sub-${process.pid || 'srv'}-${Math.random().toString(16).slice(2, 8)}`;

  const client = mqtt.connect(brokerUrl, {
    clientId,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
    username: username || undefined,
    password: password || undefined,
  });

  globalThis.__mqttLockerSubscriberClient = client;

  client.on('connect', () => {
    statusState.connected = true;
    statusState.lastConnectedAt = new Date().toISOString();
    statusState.lastError = null;
    console.log('[MQTT Server Subscriber] Successfully connected to HiveMQ Cloud broker');

    // Subscribe to locker status topics: lostreturn/locker/{lockerId}/status
    const topicPattern = 'lostreturn/locker/+/status';
    client.subscribe(topicPattern, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT Server Subscriber] Failed to subscribe to topic pattern:', topicPattern, err);
        statusState.lastError = `Subscription error: ${err.message}`;
      } else {
        console.log(`[MQTT Server Subscriber] Successfully subscribed to: ${topicPattern}`);
      }
    });

    // Also subscribe to wildcard status in case subtopics are used
    client.subscribe('lostreturn/locker/#', { qos: 1 }, (err) => {
      if (err) {
        console.warn('[MQTT Server Subscriber] Wildcard subscription warning:', err);
      }
    });
  });

  client.on('message', async (topic: string, message: Buffer) => {
    try {
      const rawPayload = message.toString().trim();
      statusState.lastMessageAt = new Date().toISOString();
      statusState.lastMessageTopic = topic;
      statusState.lastMessagePayload = rawPayload;

      console.log(`[MQTT Server Subscriber] Received message on topic "${topic}": ${rawPayload}`);

      // Topic format expected: lostreturn/locker/{lockerId}/status
      // e.g. "lostreturn/locker/1/status"
      const topicParts = topic.split('/');
      if (topicParts.length < 4 || topicParts[0] !== 'lostreturn' || topicParts[1] !== 'locker' || topicParts[3] !== 'status') {
        // Ignore commands or unrelated topics (e.g. lostreturn/locker/1/command)
        return;
      }

      const lockerId = parseInt(topicParts[2], 10);
      if (isNaN(lockerId)) {
        console.warn(`[MQTT Server Subscriber] Invalid locker ID in topic "${topic}"`);
        return;
      }

      if (!rawPayload) return;

      let payloadObj: Record<string, unknown> = {};
      try {
        payloadObj = JSON.parse(rawPayload);
      } catch {
        // Support non-JSON plain string payloads if hardware sends plain text (e.g. "CLOSED", "OPEN")
        const upper = rawPayload.toUpperCase();
        if (upper === 'CLOSED' || upper === 'OPEN') {
          payloadObj = { doorState: upper };
        } else if (upper === 'TRUE' || upper === 'FALSE') {
          payloadObj = { hasItem: upper === 'TRUE' };
        } else {
          console.warn(`[MQTT Server Subscriber] Non-JSON payload received for locker #${lockerId}: "${rawPayload}"`);
          return;
        }
      }

      // Build update payload object
      const updateData: {
        updated_at: string;
        door_state?: string;
        has_item?: boolean;
        solenoid?: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      // Check for keypad collection success event (e.g. {"keypad":"SUCCESS"})
      const keypadVal = payloadObj.keypad ?? payloadObj.KEYPAD;
      const isKeypadSuccess = typeof keypadVal === 'string' && keypadVal.trim().toUpperCase() === 'SUCCESS';

      if (isKeypadSuccess) {
        console.log(`[MQTT Server Subscriber] Keypad pickup SUCCESS event received for locker #${lockerId}`);

        // Find active deposited transaction for this locker
        const { data: activeTx, error: txError } = await supabaseAdmin
          .from('locker_transactions')
          .select('id, locker_id, user_id, collector_user_id')
          .eq('locker_id', lockerId)
          .eq('status', 'deposited')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (txError) {
          console.error(`[MQTT Server Subscriber] Error querying active transaction for locker #${lockerId}:`, txError);
        } else if (activeTx) {
          const { error: updateTxError } = await supabaseAdmin
            .from('locker_transactions')
            .update({
              status: 'collected',
              collected_at: new Date().toISOString(),
              collector_name: 'Keypad (หน้าตู้)',
              locked_by: null,
              locked_until: null,
              lock_reason: null,
            })
            .eq('id', activeTx.id);

          if (updateTxError) {
            console.error(`[MQTT Server Subscriber] Error completing transaction ${activeTx.id}:`, updateTxError);
          } else {
            console.log(`[MQTT Server Subscriber] Transaction ${activeTx.id} marked as 'collected' via Keypad`);
            try {
              await supabaseAdmin.rpc('mark_transaction_collected', { p_transaction_id: activeTx.id });
            } catch {
              // Non-blocking
            }
          }
        } else {
          console.warn(`[MQTT Server Subscriber] No active 'deposited' transaction found for locker #${lockerId}`);
        }

        // Force locker state to cleared (empty and closed)
        updateData.has_item = false;
        updateData.door_state = 'CLOSED';
        updateData.solenoid = 'LOCKED';
      }

      // 1. Check doorState (support case-insensitive: doorState, door_state, doorstate, DOORSTATE)
      const doorStateVal = payloadObj.doorState ?? payloadObj.door_state ?? payloadObj.doorstate ?? payloadObj.DOORSTATE;
      if (doorStateVal !== undefined && doorStateVal !== null && !isKeypadSuccess) {
        updateData.door_state = String(doorStateVal).trim().toUpperCase();
      }

      // 2. Check hasItem (support case-insensitive: hasItem, has_item, hasitem, HASITEM)
      const hasItemVal = payloadObj.hasItem ?? payloadObj.has_item ?? payloadObj.hasitem ?? payloadObj.HASITEM;
      if (hasItemVal !== undefined && hasItemVal !== null && !isKeypadSuccess) {
        updateData.has_item = hasItemVal === true || String(hasItemVal).trim().toLowerCase() === 'true';
      }

      // 3. Check solenoid (support case-insensitive: solenoid, SOLENOID)
      const solenoidVal = payloadObj.solenoid ?? payloadObj.SOLENOID;
      if (solenoidVal !== undefined && solenoidVal !== null && !isKeypadSuccess) {
        updateData.solenoid = String(solenoidVal).trim().toUpperCase();
      }

      // Only execute Supabase update if at least one status field is present
      if (updateData.door_state !== undefined || updateData.has_item !== undefined || updateData.solenoid !== undefined) {
        console.log(`[MQTT Server Subscriber] Updating Supabase lockers table for locker #${lockerId}:`, updateData);

        const { data, error } = await supabaseAdmin
          .from('lockers')
          .update(updateData)
          .eq('id', lockerId)
          .select();

        if (error) {
          console.error(`[MQTT Server Subscriber] Supabase update error for locker #${lockerId}:`, error);
          statusState.lastError = `DB update error for #${lockerId}: ${error.message}`;
        } else if (!data || data.length === 0) {
          console.warn(`[MQTT Server Subscriber] Locker #${lockerId} does not exist in 'lockers' table. Inserting new record...`);
          // If locker row does not exist, insert it
          const { error: insertError } = await supabaseAdmin
            .from('lockers')
            .insert({
              id: lockerId,
              ...updateData,
            });

          if (insertError) {
            console.error(`[MQTT Server Subscriber] Failed to insert locker #${lockerId}:`, insertError);
          } else {
            console.log(`[MQTT Server Subscriber] Successfully inserted locker #${lockerId} into Supabase`);
          }
        } else {
          console.log(`[MQTT Server Subscriber] Successfully updated locker #${lockerId} in Supabase:`, data[0]);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown message error';
      console.error('[MQTT Server Subscriber] Error handling incoming MQTT message:', err);
      statusState.lastError = errorMsg;
    }
  });

  client.on('error', (err) => {
    statusState.connected = false;
    statusState.lastError = err.message;
    console.error('[MQTT Server Subscriber] Client error:', err.message);
  });

  client.on('close', () => {
    statusState.connected = false;
    console.log('[MQTT Server Subscriber] Connection closed');
  });

  client.on('reconnect', () => {
    console.log('[MQTT Server Subscriber] Reconnecting to HiveMQ broker...');
  });

  return client;
}
