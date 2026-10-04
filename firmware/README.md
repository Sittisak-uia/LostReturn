# LostReturn Smart Locker - ESP32 Firmware

เฟิร์มแวร์ ESP32 สำหรับควบคุมตู้ LostReturn Smart Locker (4 ช่อง) สื่อสารผ่าน MQTT (HiveMQ Cloud TLS)

---

## 🛠️ อุปกรณ์ฮาร์ดแวร์ที่ใช้
- **Microcontroller:** ESP32 NodeMCU / DevKit
- **Sensors:**
  - Time-of-Flight (ToF) Distance Sensors: `VL53L0X` x4 (ผ่าน I2C Multiplexer `TCA9548A`)
  - Magnetic Reed Switch (Door Sensor) x4 ต่อขา GPIO 13, 14, 26, 27 (Active LOW / INPUT_PULLUP)
- **Actuators:**
  - Solenoid Lock 12V ควบคุมผ่าน Relay 4 ช่อง (GPIO 32, 33, 25, 19)
- **User Interface:**
  - จอแสดงผล OLED: `SH1106` 128x64 I2C (Address 0x3C)
  - แป้นพิมพ์ปุ่มกด: 4x4 Keypad ผ่านบอร์ดแปลง I2C `PCF8574` (Address 0x20)
  - หลอดไฟสถานะ: `WS2812B NeoPixel` x4 (GPIO 4)
  - ลำโพงบัซเซอร์: Passive / Active Buzzer (GPIO 23)

---

## 📦 ไลบรารีที่จำเป็นใน Arduino IDE
สามารถค้นหาและติดตั้งผ่าน **Library Manager** ใน Arduino IDE ได้ทันที:
1. `WiFiManager` by tzapu (v2.0.17 ขึ้นไป)
2. `PubSubClient` by Nick O'Leary
3. `ArduinoJson` by Benoît Blanchon (v6 หรือ v7)
4. `Adafruit_VL53L0X` by Adafruit
5. `Adafruit_GFX` by Adafruit
6. `Adafruit_SH110X` by Adafruit
7. `I2CKeyPad` by Rob Tillaart
8. `Adafruit NeoPixel` by Adafruit

---

## ⚙️ การตั้งค่าก่อนแฟลช (First-time Setup)
1. คัดลอกไฟล์ `secrets.h.example` และเปลี่ยนชื่อเป็น `secrets.h`
2. ใส่ค่า **MQTT Host**, **Username**, **Password** ของ HiveMQ Cloud และตรวจ Root CA Certificate
3. เปิดไฟล์ `firmware.ino` ใน Arduino IDE แล้วเลือกบอร์ดเป็น **ESP32 Dev Module**
4. อัปโหลดลงบอร์ด ESP32
5. **การตั้งค่า Wi-Fi ครั้งแรก:**
   - เมื่อเปิดเครื่องครั้งแรก ESP32 จะปล่อย Wi-Fi Access Point ชื่อ `Locker-Setup` (รหัสผ่าน: `12345678`)
   - ใช้โทรศัพท์มือถือเชื่อมต่อ Wi-Fi ดังกล่าว หน้าเว็บ Captive Portal จะเด้งขึ้นมาให้เลือกชื่อ Wi-Fi ประจำสถานที่และกรอกรหัสผ่าน
   - หากต้องการรีเซ็ต Wi-Fi ให้กดปุ่ม `[D]` บน Keypad ค้างไว้ตอนเปิดเครื่อง 2 วินาที

---

## 📡 MQTT Topic Mapping
| Direction | Topic | Payload Example |
| :--- | :--- | :--- |
| **ESP32 Subscribe** | `lostreturn/locker/+/command` | `"OPEN"`, `{"otp":"123456"}`, `{"action":"DEPOSIT"}` |
| **ESP32 Publish** | `lostreturn/locker/{id}/status` | `{"doorState":"OPEN"}` / `{"hasItem":true}` / `{"keypad":"SUCCESS"}` |
