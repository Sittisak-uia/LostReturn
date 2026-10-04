#include <WiFi.h>
#include <WiFiManager.h> // ⭐️ https://github.com/tzapu/WiFiManager — ติดตั้งผ่าน Library Manager
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "Adafruit_VL53L0X.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include "oled_bitmaps.h" // ⭐️ ชุดภาพไอคอนและข้อความภาษาไทยสำหรับ OLED (รวมถึง enum DepositStep, PickupStep)
void drawDepositScreen(int boxId, DepositStep step);
void drawPickupScreen(int boxId, PickupStep step);
void drawAFKScreen();
void updateDisplay();
#include <I2CKeyPad.h> 
#include <Adafruit_NeoPixel.h>
#include <esp_task_wdt.h> // ⭐️ Watchdog Timer ของฮาร์ดแวร์ กันเครื่องค้างสนิทแบบไม่ตอบสนองเลย
#define WDT_TIMEOUT_SEC 10 // ถ้า loop() ไม่ feed watchdog ภายในเวลานี้ ชิปจะรีสตาร์ทตัวเองอัตโนมัติ

// --- ⭐️ ตั้งค่า LED สถานะตู้ (WS2812B x4, ต่อ Daisy Chain) ---
#define LED_PIN 4          // ขา Data ของหลอดแรก
#define LED_COUNT 4        // 1 ดวงต่อ 1 ตู้
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// --- ⭐️ ตั้งค่า Buzzer (นำโค้ดทดสอบมาใช้โดยตรง ให้เสียงคมชัดและตรงจังหวะ) ---
#define BUZZER_PIN 23      // ขาที่ต่อกับ Buzzer
#define BUZZER_FREQ 1000   // ความถี่ 1000 Hz

// ฟังก์ชันสำหรับสร้างเสียงบี๊บ (Non-blocking สำหรับเสียงคลิกกดปุ่ม ไม่หน่วงระบบ)
unsigned long buzzerOffTime = 0;
void beepNonBlocking(int durationMs, int freq = BUZZER_FREQ) {
  tone(BUZZER_PIN, freq);
  buzzerOffTime = millis() + durationMs;
}

// ฟังก์ชันสำหรับสร้างเสียงบี๊บแบบบล็อกเวลา (สำหรับจังหวะเตือนหรือปลดล็อก)
void beep(int durationMs) {
  tone(BUZZER_PIN, BUZZER_FREQ);
  delay(durationMs);
  noTone(BUZZER_PIN);
}

// เสียงปี๊บๆ (ปี๊บสั้น 2 ครั้ง) สำหรับตอนปิดตู้หรือปลดล็อกสำเร็จ
void doubleBeep() {
  beep(150);
  delay(100);
  beep(150);
}

void serviceBuzzer() {
  if (buzzerOffTime > 0 && millis() >= buzzerOffTime) {
    noTone(BUZZER_PIN);
    buzzerOffTime = 0;
  }
}

// --- 1. ตั้งค่า Wi-Fi และ MQTT ---
// ⭐️ ย้าย credentials ทั้งหมดไปไว้ใน secrets.h แล้ว (ไฟล์แยก ไม่ commit ขึ้น git)
#include "secrets.h"
const char* locker_topic = "lostreturn/locker/+/command";

WiFiClientSecure espClient;
PubSubClient client(espClient);
WiFiManager wm; // ⭐️ จัดการเชื่อมต่อ WiFi แบบ captive portal ไม่ต้อง hardcode ssid/password อีกต่อไป
unsigned long lastMqttReconnect = 0; 

String validOTPs[4] = {"", "", "", ""};
unsigned long otpTimestamp[4] = {0, 0, 0, 0}; // ⭐️ เวลาที่แต่ละ OTP ถูกตั้ง (millis())
const unsigned long OTP_TIMEOUT_MS = 10UL * 60UL * 1000UL; // ⭐️ OTP หมดอายุใน 10 นาที (ตรงกับฝั่งเว็บ/software)

// ⭐️ ป้องกันการเดา PIN (brute-force): กรอกผิดครบ 3 ครั้งติด ล็อกคีย์แพด 30 วินาที
int wrongPinAttempts = 0;
unsigned long keypadLockoutUntil = 0;
const int MAX_WRONG_ATTEMPTS = 3;
const unsigned long KEYPAD_LOCKOUT_MS = 30UL * 1000UL;

// --- ⭐️ NEW: ป้องกัน unlockBox() ถูกเรียกซ้อนตัวเอง (re-entrant) ---
//    สาเหตุที่พบบ่อย: retained MQTT message บน topic command, หรือผู้ใช้กด/ส่งคำสั่ง OPEN ซ้ำระหว่างกำลังปลดล็อกอยู่
//    ถ้าไม่กันไว้ client.loop() ที่ถูกเรียกซ้อนอยู่ข้างใน while() ของ unlockBox() จะ trigger callback()
//    แล้วเรียก unlockBox() ซ้อนตัวเองไปเรื่อยๆ ทำให้ดูเหมือน "ค้าง ไม่ทำงานต่อ" (เพราะไม่เคย return ออกมาจริงๆ)
bool isUnlocking[4] = {false, false, false, false};

// ⭐️ ระบบติดตาม 4 เงื่อนไขก่อนส่งสถานะ SUCCESS ไปยัง Software:
//    1. พิมพ์รหัส OTP ผ่าน key-pad ถูกต้อง (otpAuthCompleted)
//    2. เปิดตู้ (doorWasOpened)
//    3. นำของออกจากตู้ (itemWasRemoved)
//    4. ปิดตู้ (currentDoorState == "CLOSED" && !currentHasItem)
bool otpAuthCompleted[4]  = {false, false, false, false}; // เงื่อนไข 1: พิมพ์รหัส OTP ถูกต้อง
bool doorWasOpened[4]     = {false, false, false, false}; // เงื่อนไข 2: เปิดตู้แล้ว
bool itemWasRemoved[4]    = {false, false, false, false}; // เงื่อนไข 3: นำของออกจากตู้แล้ว
unsigned long otpAuthTime[4] = {0, 0, 0, 0};              // เวลาที่กรอก OTP ถูกต้อง (timeout 2 นาที)

// ⭐️ ตัวแปรควบคุมสถานะการ "ฝากของ" (enum DepositStep ประกาศไว้ใน oled_bitmaps.h แล้ว)
DepositStep currentDepositStep = DEPOSIT_NONE;
int depositLockerId = 0;
unsigned long depositStartTime = 0;
unsigned long depositSuccessTime = 0;

// ⭐️ ตัวแปรควบคุมสถานะการ "รับของ" (enum PickupStep ประกาศไว้ใน oled_bitmaps.h แล้ว)
PickupStep currentPickupStep = PICKUP_NONE;
int pickupLockerId = 0;
unsigned long pickupStartTime = 0;
unsigned long pickupSuccessTime = 0;

// --- ⭐️ NEW: Debounce สถานะประตู (เดิมไม่มี debounce เลย ใช้ digitalRead() ดิบๆ อัปเดต/publish ทันที
//    ทำให้ reed switch สั่น/สัมผัสหลวมแค่เสี้ยววินาที ก็ publish สถานะผิดออกไปได้)
String doorCandidate[4]  = {"UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"};
unsigned long doorCandidateSince[4] = {0, 0, 0, 0};
#define DOOR_STABLE_MS 50      // ⭐️ ค่าใหม่ต้องนิ่งต่อเนื่องกี่ ms ถึงยอมรับว่าประตูเปลี่ยนสถานะจริง
                               //    ใช้เกณฑ์ "เวลา" แทน "จำนวนรอบ" เพราะ checkSensorsOnly() ถูกเรียกไม่สม่ำเสมอ
                               //    (ถูกเรียกเพิ่มทุกครั้งที่กดคีย์แพด) เกณฑ์นับรอบจึงเชื่อถือไม่ได้

// ⭐️ NEW: อ่านขาประตูแบบ "ต้องเห็นตรงกันทุกครั้ง" (unanimous sampling)
//    ลดเวลาหน่วงจากเดิม 1000us x 6 (24ms ต่อ loop) เหลือ 20us x 3 (0.24ms ต่อ loop) ไวขึ้น 100 เท่า!
//    ตัดสไปก์ความถี่สูง (inductive spikes จากโซลินอยด์) ได้หมดจด โดยไม่หน่วง loop และยังมี DOOR_STABLE_MS (50ms) ซ้อนช่วย debounce
int readDoorPinStable(int pin) {
  int first = digitalRead(pin);
  for (int s = 1; s < 4; s++) {
    delayMicroseconds(20);
    if (digitalRead(pin) != first) return -1; // ค่าไม่นิ่ง = มี noise แทรก
  }
  return first;
}

// ⭐️ NEW: ช่วง "ห้ามเชื่อเซนเซอร์ประตู" หลังรีเลย์/โซลินอยด์สลับสถานะ
//    ตอนโซลินอยด์ตัด/ต่อไฟ จะเกิดกระแสกระชากทำให้ GND ทั้งระบบแกว่ง (ground bounce)
//    ค่าที่อ่านได้ในช่วงนี้เชื่อไม่ได้ทั้ง 4 ตู้ ไม่ใช่แค่ตู้ที่สั่งเปิด -> จึงเป็น blackout แบบ global
unsigned long doorBlackoutUntil = 0;
#define DOOR_BLACKOUT_MS 500

void markRelaySwitched() {
  doorBlackoutUntil = millis() + DOOR_BLACKOUT_MS;
}

// --- ตัวแปรสถานะ ---
String lastDoorState[4] = {"UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"};
String lastPublishedDoorState[4] = {"UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"}; // ⭐️ แยกจาก lastDoorState เพื่อ retry publish ได้อิสระ
String lastHasItemState[4] = {"UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"};
String lastPublishedHasItem[4] = {"UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"}; // ⭐️ แยกจาก lastHasItemState เพื่อ retry publish ได้อิสระ
int currentDistances[4] = {-1, -1, -1, -1}; 

int detectCount[4] = {0, 0, 0, 0}; 
int clearCount[4] = {0, 0, 0, 0};  
const int ITEM_CONFIRM_COUNT = 3;  

// ระบบคณิตศาสตร์ขั้นสูง (Auto-Calibrate & EMA Filter)
int ITEM_THRESHOLDS[4] = {250, 250, 250, 250}; 
float smoothedDistances[4] = {0.0, 0.0, 0.0, 0.0}; 

// ⭐️ ใหม่: ค่าอ้างอิงพื้นตู้ที่ได้จากการ calibrate อย่างละเอียด
int FLOOR_DISTANCE[4] = {0, 0, 0, 0};        // ระยะพื้นตู้เฉลี่ย (mm)
int NOISE_MARGIN[4]   = {8, 8, 8, 8};        // ระยะเผื่อ noise ต่อตู้ (คำนวณจาก std dev ตอน calibrate)
float FLOOR_SIGNAL[4] = {0.0, 0.0, 0.0, 0.0}; // ความแรงสัญญาณสะท้อนกลับของพื้นตู้เปล่า (MCPS)
float SIGNAL_MARGIN[4] = {0.02, 0.02, 0.02, 0.02}; // ⭐️ ระยะเผื่อสัญญาณแบบ adaptive ต่อตู้ (คำนวณจาก std dev ตอน calibrate)

// ⭐️ Baseline drift tracking: ตอนตู้ว่างต่อเนื่องนานๆ ค่อยๆ ปรับพื้นฐานตามการดริฟท์ของเซนเซอร์
//    (อุณหภูมิ/ฝุ่น) โดยไม่ต้อง reboot ไป calibrate ใหม่
int consecutiveClearChecks[4] = {0, 0, 0, 0};
#define DRIFT_ADAPT_AFTER_CHECKS 20     // ต้องว่างต่อเนื่องกี่รอบ (รอบละ ~500ms) ก่อนเริ่มปรับ baseline
#define DRIFT_ADAPT_RATE 0.01f          // อัตราปรับ baseline แบบช้าๆ (ยิ่งน้อยยิ่งช้า ป้องกันหลุดตามของจริง)

// ⭐️ ปรับไวขึ้นสำหรับของชิ้นเล็ก/บาง: เพิ่มจำนวนตัวอย่างต่อรอบ (จับจังหวะที่ลำแสงโดนของบางได้ดีขึ้น)
#define SAMPLES_PER_CHECK 2            // ⚡️ ปรับลดจาก 5 เป็น 2 เพื่อให้อ่าน ToF เร็วขึ้น 2.5 เท่า ไม่หน่วงคีย์แพด

// ⭐️ ป้องกันค่าแกว่ง (flicker) ระหว่าง true/false
#define CLEAR_HYSTERESIS_MM 8            // กันชนระยะทาง
#define SIGNAL_CLEAR_RATIO 0.5f          // โซนก้ำกึ่งฝั่งสัญญาณ
#define STATE_CHANGE_LOCKOUT_MS 2500    // ล็อกสถานะไว้อย่างน้อยเท่านี้หลังเปลี่ยนสถานะ
unsigned long lastStateChangeTime[4] = {0, 0, 0, 0};

// ⭐️ ประวัติการเปิดประตู — ใช้เป็นเงื่อนไขบังคับก่อนยอมรับว่า hasItem เปลี่ยนสถานะจริง
bool doorEverOpenedSinceLastConfirm[4] = {false, false, false, false};

#define TCAADDR 0x70

// --- ตั้งค่าจอ OLED และ Keypad ---
#define i2c_Address 0x3C 
#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
#define OLED_RESET -1 
Adafruit_SH1106G display = Adafruit_SH1106G(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

#define KEYPAD_I2C_ADDR 0x20 
I2CKeyPad keyPad(KEYPAD_I2C_ADDR);

char keys[] = "123A456B789C*0#D";
String enteredPIN = ""; 
uint8_t lastKeyIndex = 16; 
unsigned long lastKeyPressTime = 0; 
const unsigned long PIN_TIMEOUT = 10000; 
bool isKeypadActive = false; // ⭐️ ตัวแปรบอกสถานะว่ากำลังกดคีย์แพดอยู่หรือไม่ 

// --- กำหนดพิน ---
const int doorPin1 = 13; const int doorPin2 = 14;
const int doorPin3 = 26; const int doorPin4 = 27;
const int relayPins[4] = {32, 33, 25, 19}; 

Adafruit_VL53L0X lox1 = Adafruit_VL53L0X();
Adafruit_VL53L0X lox2 = Adafruit_VL53L0X();
Adafruit_VL53L0X lox3 = Adafruit_VL53L0X();
Adafruit_VL53L0X lox4 = Adafruit_VL53L0X();

unsigned long lastUpdate = 0; 

void tcaselect(uint8_t i) {
  if (i > 7) return;
  Wire.beginTransmission(TCAADDR);
  Wire.write(1 << i);
  Wire.endTransmission();
}

// ⭐️ ฟังก์ชันตัดการเชื่อมต่อบัสย่อยทั้งหมดบน TCA9548A เพื่อคืนบัส I2C ให้ Keypad และ OLED
void tcaDisable() {
  Wire.beginTransmission(TCAADDR);
  Wire.write(0);
  Wire.endTransmission();
}

// ⭐️ ตรวจจับ + กู้คืนบัส I2C ค้าง (เกิดง่ายจาก EMI ตอนรีเลย์/โซลินอยด์ตัดไฟ)
#define SDA_PIN 21
#define SCL_PIN 22
int i2cFailStreak = 0;
const int I2C_FAIL_RECOVERY_THRESHOLD = 4; // ล้มเหลวติดกันกี่รอบ ถึงจะสั่งกู้คืน
int i2cRecoveryCount = 0;                   // นับจำนวนครั้งที่เคยต้องกู้คืนบัส
unsigned long lastI2cRecoveryTime = 0;

void recoverI2CBus() {
  Serial.println("[I2C] ตรวจพบบัสค้างต่อเนื่อง กำลังกู้คืน...");

  // 1. บิตแบง SCL ปลดล็อกอุปกรณ์ที่อาจค้าง SDA ไว้
  pinMode(SDA_PIN, INPUT_PULLUP);
  pinMode(SCL_PIN, OUTPUT);
  if (digitalRead(SDA_PIN) == LOW) {
    for (int i = 0; i < 9; i++) {
      digitalWrite(SCL_PIN, LOW);  delayMicroseconds(5);
      digitalWrite(SCL_PIN, HIGH); delayMicroseconds(5);
    }
  }

  // 2. รีสตาร์ทบัส I2C และ config เซนเซอร์ทั้ง 4 ตัวใหม่ทั้งหมด
  Wire.end();
  delay(50);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  Wire.setTimeOut(50); // ⭐️ จำกัดเวลาบล็อกของ I2C ไว้ที่ 50ms

  Adafruit_VL53L0X* sensors[] = {&lox1, &lox2, &lox3, &lox4};
  for (int i = 0; i < 4; i++) {
    tcaselect(i);
    delay(10);
    if (sensors[i]->begin()) {
      sensors[i]->configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_DEFAULT);
      Serial.print("[I2C] Sensor "); Serial.print(i + 1); Serial.println(" กู้คืนสำเร็จ");
    } else {
      Serial.print("[I2C] Sensor "); Serial.print(i + 1); Serial.println(" กู้คืนไม่สำเร็จ");
    }
  }
  tcaDisable(); // ⭐️ ปิดบัสย่อยหลังกู้คืนเสร็จ

  i2cFailStreak = 0;
  i2cRecoveryCount++;
  lastI2cRecoveryTime = millis();
  Serial.println("[I2C] กู้คืนบัสเสร็จสิ้น");

  // ⭐️ ถ้าต้องกู้คืนซ้ำๆ ถี่ๆ (3 ครั้งภายใน 2 นาที) ให้รีสตาร์ทเครื่อง
  if (i2cRecoveryCount >= 3) {
    Serial.println("[I2C] กู้คืนซ้ำถี่เกินไป กำลังรีสตาร์ทเครื่องทั้งหมด...");
    delay(500);
    ESP.restart();
  }
}

// ⭐️ อัปเกรดฟังก์ชันจำค่าพื้นตู้อัตโนมัติ + เก็บค่า noise/signal อ้างอิง
void calibrateSensors() {
  display.clearDisplay(); 
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(15, 20);
  display.println("WARMING UP...");
  display.display();
  Serial.println("\n--- วอร์มอัปเซนเซอร์ (ทิ้งค่าแกว่งตอนบูต) ---");

  Adafruit_VL53L0X* sensors[] = {&lox1, &lox2, &lox3, &lox4};

  // 1. ⭐️ อ่านทิ้งอ่านขว้าง 10 รอบ เพื่อให้เซนเซอร์ปรับโฟกัสนิ่ง
  for (int s = 0; s < 10; s++) {
    for (int i = 0; i < 4; i++) {
      VL53L0X_RangingMeasurementData_t measure;
      tcaselect(i);
      sensors[i]->rangingTest(&measure, false);
    }
    delay(100);
  }

  display.clearDisplay(); 
  display.setCursor(15, 20);
  display.println("CALIBRATING...");
  display.display();
  Serial.println("--- เริ่มต้นจดจำระยะอ้างอิง (Baseline) ---");

  const int NUM_SAMPLES = 40;
  int rawDistances[4][NUM_SAMPLES];
  float rawSignals[4][NUM_SAMPLES];
  int count[4] = {0, 0, 0, 0};

  // 2. ⭐️ เก็บตัวอย่าง 40 ครั้ง
  for (int s = 0; s < NUM_SAMPLES; s++) {
    for (int i = 0; i < 4; i++) {
      VL53L0X_RangingMeasurementData_t measure;
      tcaselect(i);
      sensors[i]->rangingTest(&measure, false);

      // เอาเฉพาะค่าที่อ่านได้จริง และไม่เกิน 600mm
      if (measure.RangeStatus != 4 && measure.RangeMilliMeter < 600) {
        if (count[i] < NUM_SAMPLES) {
          rawDistances[i][count[i]] = measure.RangeMilliMeter;
          rawSignals[i][count[i]] = measure.SignalRateRtnMegaCps / 65536.0f; // float MCPS
          count[i]++;
        }
      }
    }
    delay(30);
  }

  // คำนวณพื้นตู้ + ค่าเบี่ยงเบนมาตรฐาน (noise) + ตั้ง threshold แบบ adaptive
  for (int i = 0; i < 4; i++) {
    if (count[i] > 10) {
      // 1. เรียงลำดับข้อมูลเพื่อเตรียมตัด Outliers
      for (int a = 0; a < count[i] - 1; a++) {
        for (int b = 0; b < count[i] - a - 1; b++) {
          if (rawDistances[i][b] > rawDistances[i][b + 1]) {
            int tempD = rawDistances[i][b];
            rawDistances[i][b] = rawDistances[i][b + 1];
            rawDistances[i][b + 1] = tempD;
            
            float tempS = rawSignals[i][b];
            rawSignals[i][b] = rawSignals[i][b + 1];
            rawSignals[i][b + 1] = tempS;
          }
        }
      }

      // 2. ตัดหัวท้ายออกฝั่งละ 15%
      int trimCount = count[i] * 0.15;
      int startIdx = trimCount;
      int endIdx = count[i] - trimCount;
      int validCount = endIdx - startIdx;

      long sum = 0, sumSq = 0;
      float sumSignal = 0, sumSignalSq = 0;

      for (int j = startIdx; j < endIdx; j++) {
        int d = rawDistances[i][j];
        float sig = rawSignals[i][j];
        sum += d;
        sumSq += (long)d * d;
        sumSignal += sig;
        sumSignalSq += sig * sig;
      }

      int avgFloor = sum / validCount;
      float mean = (float)avgFloor;
      float variance = ((float)sumSq / validCount) - (mean * mean);
      if (variance < 0) variance = 0;
      float stddev = sqrt(variance);

      // 3. ปรับค่า Margin ให้กว้างขึ้นเพื่อป้องกันปัญหาตู้ไม่ยอมว่าง
      int margin = max(25, min(50, (int)(stddev * 3.0f)));

      FLOOR_DISTANCE[i]  = avgFloor;
      NOISE_MARGIN[i]    = margin;
      ITEM_THRESHOLDS[i] = avgFloor - margin;
      smoothedDistances[i] = avgFloor;

      float sigMean = sumSignal / validCount;
      float sigVariance = (sumSignalSq / validCount) - (sigMean * sigMean);
      if (sigVariance < 0) sigVariance = 0;
      float sigStddev = sqrt(sigVariance);
      FLOOR_SIGNAL[i] = sigMean;
      
      // 4. ตั้งค่า Signal Margin ให้สูงพอที่จะไม่ถูกรบกวนจาก Noise 
      SIGNAL_MARGIN[i] = max(2.5f, max(sigStddev * 4.0f, FLOOR_SIGNAL[i] * 0.2f));

      Serial.print("ตู้ "); Serial.print(i + 1);
      Serial.print(" พื้นจริง: "); Serial.print(avgFloor);
      Serial.print("mm | Noise(std): "); Serial.print(stddev, 2);
      Serial.print("mm | Margin: "); Serial.print(margin);
      Serial.print("mm | Threshold: "); Serial.print(ITEM_THRESHOLDS[i]);
      Serial.print("mm | SignalStd: "); Serial.print(sigStddev, 4);
      Serial.print(" | SignalMargin: "); Serial.print(SIGNAL_MARGIN[i], 4);
      Serial.print("mm | Signal พื้น: "); Serial.print(FLOOR_SIGNAL[i], 3);
      Serial.println(" MCPS");
    } else {
      Serial.print("ตู้ "); Serial.print(i + 1);
      Serial.println(" Error: อ่านค่าไม่ได้พอ ใช้ค่า Default (250mm)");
    }
  }
  tcaDisable(); // ⭐️ ปิดบัสย่อยหลัง calibrate เสร็จ
}

// ⭐️ DEBUG: อ่านค่าดิบจากเซนเซอร์ทั้ง 4 ตัวแบบไม่ผ่านการกรอง/threshold
void debugRawReadAllSensors() {
  Adafruit_VL53L0X* sensors[] = {&lox1, &lox2, &lox3, &lox4};
  bool anyHealthy = false;

  Serial.print("[RAW] ");
  for (int i = 0; i < 4; i++) {
    tcaselect(i);
    VL53L0X_RangingMeasurementData_t measure;
    sensors[i]->rangingTest(&measure, false);
    float sig = measure.SignalRateRtnMegaCps / 65536.0f;

    if (measure.RangeStatus <= 14) anyHealthy = true;

    Serial.print("B"); Serial.print(i + 1);
    Serial.print("[status="); Serial.print(measure.RangeStatus);
    Serial.print(",d="); Serial.print(measure.RangeMilliMeter);
    Serial.print("mm,sig="); Serial.print(sig, 3);
    Serial.print("] ");
  }
  tcaDisable(); // ⭐️ ปิดบัสย่อยหลังอ่านค่าดิบเสร็จ

  int dPins[4] = {doorPin1, doorPin2, doorPin3, doorPin4};
  Serial.print("| DOOR raw=");
  for (int i = 0; i < 4; i++) { Serial.print(digitalRead(dPins[i])); }
  Serial.print(" state=");
  for (int i = 0; i < 4; i++) { Serial.print(lastDoorState[i] == "CLOSED" ? "C" : (lastDoorState[i] == "OPEN" ? "O" : "?")); }
  if (millis() < doorBlackoutUntil) Serial.print(" [BLACKOUT]");
  Serial.print(" | i2cFailStreak="); Serial.print(i2cFailStreak);
  Serial.print(" i2cRecoveryCount="); Serial.println(i2cRecoveryCount);

  if (!anyHealthy) {
    i2cFailStreak++;
    if (i2cFailStreak >= I2C_FAIL_RECOVERY_THRESHOLD) {
      recoverI2CBus();
    }
  } else {
    i2cFailStreak = 0;
  }
}

bool publishMQTTStatus(int lockerId, String key, String value, bool isString) {
  if (!client.connected()) return false;
  String topic = "lostreturn/locker/" + String(lockerId) + "/status";
  String payload = "{";
  if (isString) payload += "\"" + key + "\":\"" + value + "\"";
  else payload += "\"" + key + "\":" + value;
  payload += "}";
  bool ok = client.publish(topic.c_str(), payload.c_str());
  Serial.print(">> Published -> ");
  Serial.print(topic); Serial.print(" : "); Serial.print(payload);
  Serial.println(ok ? " [OK]" : " [FAILED - จะลองใหม่รอบถัดไป]");
  return ok;
}

// ⭐️ ฟังก์ชันเช็คประตูแบบเร็ว
void checkDoorsFast() {
  int doorPins[] = {doorPin1, doorPin2, doorPin3, doorPin4};

  if (millis() < doorBlackoutUntil) {
    for (int i = 0; i < 4; i++) doorCandidateSince[i] = 0;
    return;
  }

  for (int i = 0; i < 4; i++) {
    int rawLevel = readDoorPinStable(doorPins[i]);
    if (rawLevel != -1) {
      String rawDoorState = (rawLevel == LOW) ? "CLOSED" : "OPEN";

      bool isAnySolenoidActive = false;
      for (int j = 0; j < 4; j++) {
        if (isUnlocking[j]) { isAnySolenoidActive = true; break; }
      }

      if (isAnySolenoidActive) {
        if (!isUnlocking[i]) {
          if (lastDoorState[i] != "UNKNOWN") {
            rawDoorState = lastDoorState[i];
          }
        } else {
          if (lastDoorState[i] == "OPEN" && rawDoorState == "CLOSED") {
            rawDoorState = "OPEN";
          }
        }
      }

      if (rawDoorState != doorCandidate[i]) {
        doorCandidate[i] = rawDoorState;
        doorCandidateSince[i] = millis();
      } else if (doorCandidateSince[i] != 0 &&
                 millis() - doorCandidateSince[i] >= DOOR_STABLE_MS) {
        if (lastDoorState[i] != doorCandidate[i]) {
          if (doorCandidate[i] == "OPEN" && otpAuthCompleted[i]) {
            doorWasOpened[i] = true;
            Serial.print("[Auth-Flow] ตู้ "); Serial.print(i + 1); Serial.println(": [เงื่อนไข 2/4 ผ่าน] เปิดตู้เรียบร้อย");
            if (currentPickupStep == PICKUP_STEP_OPEN_DOOR && pickupLockerId == (i + 1)) {
              currentPickupStep = PICKUP_STEP_TAKE_ITEM;
              Serial.print("[Pickup-Flow] ตู้ "); Serial.print(pickupLockerId);
              Serial.println(": [ขั้นตอน 2/4] เปิดตู้เรียบร้อย -> รอผู้ใช้หยิบสิ่งของออกจากช่องตู้");
              updateDisplay();
            }
          }

          if (doorCandidate[i] == "OPEN" && currentDepositStep == DEPOSIT_STEP_OPEN_DOOR && depositLockerId == (i + 1)) {
            currentDepositStep = DEPOSIT_STEP_PLACE_ITEM;
            Serial.print("[Deposit-Flow] ตู้ "); Serial.print(depositLockerId);
            Serial.println(": [ขั้นตอน 2/4] เปิดตู้เรียบร้อย -> รอผู้ใช้นำสิ่งของวางในตู้");
            updateDisplay();
          }

          if (doorCandidate[i] == "CLOSED" && currentDepositStep == DEPOSIT_STEP_CLOSE_DOOR && depositLockerId == (i + 1)) {
            currentDepositStep = DEPOSIT_STEP_SUCCESS;
            depositSuccessTime = millis();
            updateDisplay();
          }

          if (doorCandidate[i] == "CLOSED" && lastDoorState[i] == "OPEN") {
            doubleBeep();
          }
          lastDoorState[i] = doorCandidate[i];
        }
      }
    }
  }
}

// ⭐️ ฟังก์ชันเช็คเซนเซอร์ ToF
void checkSensorsOnly() {
  Adafruit_VL53L0X* sensors[] = {&lox1, &lox2, &lox3, &lox4};
  bool anySensorHealthyThisCycle = false;

  for (int i = 0; i < 4; i++) {
    String currentDoorState = lastDoorState[i];
    if (currentDoorState != lastPublishedDoorState[i]) {
      if (publishMQTTStatus(i + 1, "doorState", currentDoorState, true)) {
        lastPublishedDoorState[i] = currentDoorState;
      }
    }
    if (currentDoorState == "OPEN") {
      doorEverOpenedSinceLastConfirm[i] = true;
    }

    tcaselect(i);
    delayMicroseconds(500);

    int minValid = -1;
    float avgSignal = 0.0f;
    int validCount = 0;

    for (int s = 0; s < SAMPLES_PER_CHECK; s++) {
      VL53L0X_RangingMeasurementData_t measure;
      sensors[i]->rangingTest(&measure, false);

      if (measure.RangeMilliMeter < 600 &&
          (measure.RangeStatus == 0 || measure.RangeStatus == 1 || measure.RangeStatus == 2)) {
        int d = measure.RangeMilliMeter;
        if (minValid == -1 || d < minValid) minValid = d;
        avgSignal += measure.SignalRateRtnMegaCps / 65536.0f;
        validCount++;
        anySensorHealthyThisCycle = true;
      }
    }

    bool signalDetect = false;
    bool signalClear = false;
    if (validCount > 0) {
      avgSignal /= validCount;
      if (avgSignal > FLOOR_SIGNAL[i] + SIGNAL_MARGIN[i]) {
        signalDetect = true;
      } else {
        signalClear = true;
      }
    } else {
      signalClear = true;
    }

    bool distanceDetect = false;
    bool distanceClear = false;
    if (minValid != -1) {
      smoothedDistances[i] = (smoothedDistances[i] * 0.5f) + (minValid * 0.5f);
      currentDistances[i] = (int)smoothedDistances[i];
      if (minValid <= ITEM_THRESHOLDS[i]) {
        distanceDetect = true;
      } else if (minValid >= ITEM_THRESHOLDS[i] + CLEAR_HYSTERESIS_MM) {
        distanceClear = true;
      }
    } else {
      currentDistances[i] = -1;
      distanceClear = true;
    }

    bool rawDetect = distanceDetect || signalDetect;
    bool rawClear  = distanceClear && signalClear;

    if (rawDetect) {
      detectCount[i]++;
      clearCount[i] = 0;
    } else if (rawClear) {
      clearCount[i]++;
      detectCount[i] = 0;
    }

    bool candidateHasItem;
    if (detectCount[i] >= ITEM_CONFIRM_COUNT) {
      candidateHasItem = true;
      detectCount[i] = ITEM_CONFIRM_COUNT;
    } else if (clearCount[i] >= ITEM_CONFIRM_COUNT) {
      candidateHasItem = false;
      clearCount[i] = ITEM_CONFIRM_COUNT;
    } else {
      candidateHasItem = (lastHasItemState[i] == "true");
    }

    if (!candidateHasItem && rawClear && minValid != -1) {
      consecutiveClearChecks[i]++;
      if (consecutiveClearChecks[i] >= DRIFT_ADAPT_AFTER_CHECKS) {
        FLOOR_DISTANCE[i] = (int)((FLOOR_DISTANCE[i] * (1.0f - DRIFT_ADAPT_RATE)) + (minValid * DRIFT_ADAPT_RATE));
        FLOOR_SIGNAL[i]   = (FLOOR_SIGNAL[i] * (1.0f - DRIFT_ADAPT_RATE)) + (avgSignal * DRIFT_ADAPT_RATE);
        ITEM_THRESHOLDS[i] = FLOOR_DISTANCE[i] - NOISE_MARGIN[i];
      }
    } else {
      consecutiveClearChecks[i] = 0;
    }

    bool currentHasItem;
    bool wantsChange = (candidateHasItem != (lastHasItemState[i] == "true"));
    bool isInitialReading = (lastHasItemState[i] == "UNKNOWN");

    if (wantsChange && !isInitialReading && !doorEverOpenedSinceLastConfirm[i]) {
      wantsChange = false;
    }

    if (wantsChange && (millis() - lastStateChangeTime[i] < STATE_CHANGE_LOCKOUT_MS)) {
      currentHasItem = (lastHasItemState[i] == "true");
    } else {
      currentHasItem = wantsChange ? candidateHasItem : (lastHasItemState[i] == "true");
      if (wantsChange) {
        lastStateChangeTime[i] = millis();
        doorEverOpenedSinceLastConfirm[i] = false;
      }
    }

    strip.setPixelColor(LED_COUNT - 1 - i, currentHasItem ? strip.Color(255, 0, 0) : strip.Color(0, 255, 0));

    String currentHasItemStr = currentHasItem ? "true" : "false";
    lastHasItemState[i] = currentHasItemStr;
    if (currentHasItemStr != lastPublishedHasItem[i]) {
      if (publishMQTTStatus(i + 1, "hasItem", currentHasItemStr, false)) {
        lastPublishedHasItem[i] = currentHasItemStr;
      }
    }

    if (otpAuthCompleted[i] && (millis() - otpAuthTime[i] > 120000UL)) {
      otpAuthCompleted[i] = false;
      doorWasOpened[i] = false;
      itemWasRemoved[i] = false;
      Serial.print("[Auth-Flow] ตู้ "); Serial.print(i + 1); Serial.println(": หมดเวลารอทำรายการ (Timeout 2 นาที)");
    }

    if (otpAuthCompleted[i] && doorWasOpened[i] && !currentHasItem) {
      if (!itemWasRemoved[i]) {
        itemWasRemoved[i] = true;
        Serial.print("[Auth-Flow] ตู้ "); Serial.print(i + 1); Serial.println(": [เงื่อนไข 3/4 ผ่าน] นำของออกจากตู้เรียบร้อย (เซนเซอร์ตรวจพบตู้ว่าง)");
        if (currentPickupStep == PICKUP_STEP_TAKE_ITEM && pickupLockerId == (i + 1)) {
          currentPickupStep = PICKUP_STEP_CLOSE_DOOR;
          Serial.print("[Pickup-Flow] ตู้ "); Serial.print(pickupLockerId);
          Serial.println(": [ขั้นตอน 3/4] ตรวจพบการหยิบของออกแล้ว -> รอปิดประตูตู้");
          beepNonBlocking(80);
          updateDisplay();
        }
      }
    }
    if (currentPickupStep == PICKUP_STEP_CLOSE_DOOR && pickupLockerId == (i + 1) && currentHasItem) {
      currentPickupStep = PICKUP_STEP_TAKE_ITEM;
      itemWasRemoved[i] = false;
      updateDisplay();
    }

    if (currentDepositStep == DEPOSIT_STEP_PLACE_ITEM && depositLockerId == (i + 1) && currentHasItem) {
      currentDepositStep = DEPOSIT_STEP_CLOSE_DOOR;
      Serial.print("[Deposit-Flow] ตู้ "); Serial.print(depositLockerId);
      Serial.println(": [ขั้นตอน 3/4] ตรวจพบสิ่งของในตู้แล้ว -> รอปิดประตูตู้");
      beepNonBlocking(80);
      updateDisplay();
    }
    if (currentDepositStep == DEPOSIT_STEP_CLOSE_DOOR && depositLockerId == (i + 1) && !currentHasItem) {
      currentDepositStep = DEPOSIT_STEP_PLACE_ITEM;
      updateDisplay();
    }

    if (currentDepositStep != DEPOSIT_NONE && currentDepositStep != DEPOSIT_STEP_SUCCESS && (millis() - depositStartTime > 120000UL)) {
      currentDepositStep = DEPOSIT_NONE;
      depositLockerId = 0;
      Serial.println("[Deposit-Flow] หมดเวลาทำรายการฝากของ (Timeout 2 นาที)");
      updateDisplay();
    }

    if (otpAuthCompleted[i] && doorWasOpened[i] && itemWasRemoved[i] && (currentDoorState == "CLOSED") && (!currentHasItem)) {
      otpAuthCompleted[i] = false;
      doorWasOpened[i] = false;
      itemWasRemoved[i] = false;

      currentPickupStep = PICKUP_STEP_SUCCESS;
      pickupSuccessTime = millis();

      Serial.println("\n==================================================");
      Serial.print("[Auth-Flow] ตู้ "); Serial.print(i + 1); 
      Serial.println(" ครบ 4 เงื่อนไขสมบูรณ์! (OTP ถูก -> เปิดตู้ -> นำของออก -> ปิดตู้)");
      Serial.println(">> กำลังส่งสถานะ {\"keypad\":\"SUCCESS\"} ไปยังฝั่ง Software...");
      Serial.println("==================================================");

      publishMQTTStatus(i + 1, "keypad", "SUCCESS", true);

      doubleBeep();
      updateDisplay();
    }
  }

  tcaDisable();
  strip.show();

  if (!anySensorHealthyThisCycle) {
    i2cFailStreak++;
    if (i2cFailStreak >= I2C_FAIL_RECOVERY_THRESHOLD) {
      recoverI2CBus();
    }
  } else {
    i2cFailStreak = 0;
    if (i2cRecoveryCount > 0 && millis() - lastI2cRecoveryTime > 5UL * 60UL * 1000UL) {
      i2cRecoveryCount = 0;
    }
  }
}

void unlockBox(int boxNum, int relayPin) {
  if (isUnlocking[boxNum - 1]) {
    Serial.print("[Unlock] กล่อง "); Serial.print(boxNum);
    Serial.println(" กำลังปลดล็อกอยู่แล้ว - ข้ามคำสั่งซ้ำ");
    return;
  }
  isUnlocking[boxNum - 1] = true;

  if (currentDepositStep != DEPOSIT_NONE || currentPickupStep != PICKUP_NONE) {
    updateDisplay();
  } else {
    display.clearDisplay(); display.setTextSize(3); 
    display.setCursor(10, 10); display.print("UNLOCK");
    display.setCursor(28, 40); display.print("BOX "); display.print(boxNum);
    display.display();
  }
  
  publishMQTTStatus(boxNum, "solenoid", "UNLOCKED", true);
  beep(1000);

  digitalWrite(relayPin, LOW); 
  markRelaySwitched();
  
  unsigned long startWait = millis();
  while (millis() - startWait < 3000) {
    esp_task_wdt_reset();
    client.loop(); 
    serviceBuzzer();
    checkDoorsFast();
    if (millis() - lastUpdate >= 500) { 
      lastUpdate = millis(); checkSensorsOnly(); 
    }
  }
  
  digitalWrite(relayPin, HIGH); 
  markRelaySwitched();
  publishMQTTStatus(boxNum, "solenoid", "LOCKED", true);
  
  if (currentDepositStep != DEPOSIT_NONE || currentPickupStep != PICKUP_NONE) {
    updateDisplay();
  } else {
    display.clearDisplay(); display.setTextSize(3);
    display.setCursor(10, 20); display.print("LOCKED");
    display.display();
  }
  
  startWait = millis();
  while (millis() - startWait < 1000) {
    esp_task_wdt_reset();
    client.loop();
    serviceBuzzer();
    if (millis() - lastUpdate >= 500) {
      lastUpdate = millis(); checkSensorsOnly(); 
    }
  }

  isUnlocking[boxNum - 1] = false;
}

void drawDepositScreen(int boxId, DepositStep step) {
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  display.setCursor(2, 1);
  display.print("BOX #0"); display.print(boxId);
  display.setCursor(78, 1);
  display.print("STEP "); display.print((int)step); display.print("/4");
  display.drawLine(0, 10, 127, 10, SH110X_WHITE);

  if (step == DEPOSIT_STEP_OPEN_DOOR) {
    display.drawBitmap((128 - BMP_ICON_UNLOCK_W) / 2, 12, bmp_icon_unlock, BMP_ICON_UNLOCK_W, BMP_ICON_UNLOCK_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_OPEN_DOOR_W) / 2, 38, bmp_txt_open_door, BMP_TXT_OPEN_DOOR_W, BMP_TXT_OPEN_DOOR_H, SH110X_WHITE);
    display.setCursor(16, 55);
    display.print("PLEASE OPEN DOOR");
  }
  else if (step == DEPOSIT_STEP_PLACE_ITEM) {
    display.drawBitmap((128 - BMP_ICON_BOX_W) / 2, 12, bmp_icon_box, BMP_ICON_BOX_W, BMP_ICON_BOX_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_PLACE_ITEM_W) / 2, 38, bmp_txt_place_item, BMP_TXT_PLACE_ITEM_W, BMP_TXT_PLACE_ITEM_H, SH110X_WHITE);
    display.setCursor(16, 55);
    display.print("PLACE ITEM INSIDE");
  }
  else if (step == DEPOSIT_STEP_CLOSE_DOOR) {
    display.drawBitmap((128 - BMP_ICON_LOCK_W) / 2, 12, bmp_icon_lock, BMP_ICON_LOCK_W, BMP_ICON_LOCK_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_ITEM_DETECTED_W) / 2, 37, bmp_txt_item_detected, BMP_TXT_ITEM_DETECTED_W, BMP_TXT_ITEM_DETECTED_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_CLOSE_DOOR_W) / 2, 49, bmp_txt_close_door, BMP_TXT_CLOSE_DOOR_W, BMP_TXT_CLOSE_DOOR_H, SH110X_WHITE);
  }
  else if (step == DEPOSIT_STEP_SUCCESS) {
    display.drawBitmap((128 - BMP_ICON_SUCCESS_W) / 2, 12, bmp_icon_success, BMP_ICON_SUCCESS_W, BMP_ICON_SUCCESS_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_SUCCESS_W) / 2, 38, bmp_txt_success, BMP_TXT_SUCCESS_W, BMP_TXT_SUCCESS_H, SH110X_WHITE);
    display.setCursor(10, 55);
    display.print("DEPOSIT COMPLETED!");
  }
}

void drawPickupScreen(int boxId, PickupStep step) {
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  display.setCursor(2, 1);
  display.print("BOX #0"); display.print(boxId);
  display.setCursor(78, 1);
  display.print("STEP "); display.print((int)step); display.print("/4");
  display.drawLine(0, 10, 127, 10, SH110X_WHITE);

  if (step == PICKUP_STEP_OPEN_DOOR) {
    display.drawBitmap((128 - BMP_ICON_UNLOCK_W) / 2, 12, bmp_icon_unlock, BMP_ICON_UNLOCK_W, BMP_ICON_UNLOCK_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_OPEN_DOOR_W) / 2, 38, bmp_txt_open_door, BMP_TXT_OPEN_DOOR_W, BMP_TXT_OPEN_DOOR_H, SH110X_WHITE);
    display.setCursor(16, 55);
    display.print("PLEASE OPEN DOOR");
  }
  else if (step == PICKUP_STEP_TAKE_ITEM) {
    display.drawBitmap((128 - BMP_ICON_BOX_W) / 2, 12, bmp_icon_box, BMP_ICON_BOX_W, BMP_ICON_BOX_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_TAKE_ITEM_W) / 2, 38, bmp_txt_take_item, BMP_TXT_TAKE_ITEM_W, BMP_TXT_TAKE_ITEM_H, SH110X_WHITE);
    display.setCursor(12, 55);
    display.print("TAKE YOUR ITEM OUT");
  }
  else if (step == PICKUP_STEP_CLOSE_DOOR) {
    display.drawBitmap((128 - BMP_ICON_LOCK_W) / 2, 12, bmp_icon_lock, BMP_ICON_LOCK_W, BMP_ICON_LOCK_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_ITEM_TAKEN_W) / 2, 37, bmp_txt_item_taken, BMP_TXT_ITEM_TAKEN_W, BMP_TXT_ITEM_TAKEN_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_CLOSE_DOOR_W) / 2, 49, bmp_txt_close_door, BMP_TXT_CLOSE_DOOR_W, BMP_TXT_CLOSE_DOOR_H, SH110X_WHITE);
  }
  else if (step == PICKUP_STEP_SUCCESS) {
    display.drawBitmap((128 - BMP_ICON_SUCCESS_W) / 2, 12, bmp_icon_success, BMP_ICON_SUCCESS_W, BMP_ICON_SUCCESS_H, SH110X_WHITE);
    display.drawBitmap((128 - BMP_TXT_PICKUP_SUCCESS_W) / 2, 38, bmp_txt_pickup_success, BMP_TXT_PICKUP_SUCCESS_W, BMP_TXT_PICKUP_SUCCESS_H, SH110X_WHITE);
    display.setCursor(14, 55);
    display.print("PICKUP COMPLETED!");
  }
}

void drawAFKScreen() {
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  bool hasActiveOTP = false;
  for (int i = 0; i < 4; i++) {
    if (validOTPs[i] != "" && (millis() - otpTimestamp[i] <= OTP_TIMEOUT_MS)) {
      hasActiveOTP = true;
      break;
    }
  }

  display.setCursor(2, 1);
  display.print("LOSTRETURN");
  display.setCursor(75, 1);
  if (hasActiveOTP) {
    display.print("[OTP:RDY]");
  } else if (client.connected()) {
    display.print("[WiFi:OK]");
  } else {
    display.print("[WiFi:ERR]");
  }
  display.drawLine(0, 10, 127, 10, SH110X_WHITE);

  unsigned long afkCycle = millis() % 6000;

  if (afkCycle < 4200) {
    display.fillRoundRect(36, 16, 18, 22, 6, SH110X_WHITE);
    display.fillRoundRect(74, 16, 18, 22, 6, SH110X_WHITE);
    display.fillCircle(41, 22, 3, SH110X_BLACK);
    display.fillCircle(79, 22, 3, SH110X_BLACK);
    display.fillCircle(48, 30, 2, SH110X_BLACK);
    display.fillCircle(86, 30, 2, SH110X_BLACK);
    display.drawLine(28, 34, 32, 34, SH110X_WHITE);
    display.drawLine(96, 34, 100, 34, SH110X_WHITE);
    display.drawLine(61, 35, 64, 38, SH110X_WHITE);
    display.drawLine(64, 38, 67, 35, SH110X_WHITE);
  }
  else if (afkCycle < 4600) {
    display.drawLine(36, 26, 45, 19, SH110X_WHITE);
    display.drawLine(45, 19, 54, 26, SH110X_WHITE);
    display.drawLine(74, 26, 83, 19, SH110X_WHITE);
    display.drawLine(83, 19, 92, 26, SH110X_WHITE);
    display.fillCircle(30, 32, 2, SH110X_WHITE);
    display.fillCircle(98, 32, 2, SH110X_WHITE);
    display.drawLine(61, 34, 64, 37, SH110X_WHITE);
    display.drawLine(64, 37, 67, 34, SH110X_WHITE);
  }
  else {
    display.fillRoundRect(36, 16, 18, 22, 6, SH110X_WHITE);
    display.fillRoundRect(74, 16, 18, 22, 6, SH110X_WHITE);
    display.fillCircle(38, 22, 3, SH110X_BLACK);
    display.fillCircle(76, 22, 3, SH110X_BLACK);
    display.fillCircle(45, 30, 2, SH110X_BLACK);
    display.fillCircle(83, 30, 2, SH110X_BLACK);
    display.drawLine(28, 34, 32, 34, SH110X_WHITE);
    display.drawLine(96, 34, 100, 34, SH110X_WHITE);
    display.drawLine(61, 35, 64, 38, SH110X_WHITE);
    display.drawLine(64, 38, 67, 35, SH110X_WHITE);
  }

  display.drawLine(0, 48, 127, 48, SH110X_WHITE);
  display.setCursor(4, 52);
  for (int i = 0; i < 4; i++) {
    display.print("B"); display.print(i + 1);
    if (lastHasItemState[i] == "true") display.print(":USE ");
    else display.print(":OK ");
  }
}

void updateDisplay() {
  display.clearDisplay(); 
  display.setTextColor(SH110X_WHITE);

  if (enteredPIN.length() > 0) {
    display.setTextSize(1);
    display.setCursor(12, 2);
    display.print("ENTER 6-DIGIT PIN");
    display.drawLine(0, 12, 127, 12, SH110X_WHITE);

    display.drawRoundRect(4, 16, 120, 32, 4, SH110X_WHITE);

    display.setTextSize(2);
    for (int i = 0; i < 6; i++) {
      display.setCursor(14 + i * 18, 24);
      if (i < enteredPIN.length()) {
        display.print(enteredPIN[i]);
      } else {
        display.print("-");
      }
    }

    display.setTextSize(1);
    display.setCursor(4, 53);
    display.print("*:Clear     D:Delete");

  } else if (currentDepositStep != DEPOSIT_NONE) {
    drawDepositScreen(depositLockerId, currentDepositStep);
  } else if (currentPickupStep != PICKUP_NONE) {
    drawPickupScreen(pickupLockerId, currentPickupStep);
  } else {
    drawAFKScreen();
  }
  Wire.setClock(400000);
  display.display(); 
  Wire.setClock(100000);
}

void updateSystemStatus() {
  checkSensorsOnly(); 
  updateDisplay();
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  int targetLocker = 0;
  sscanf(topic, "lostreturn/locker/%d/command", &targetLocker);

  Serial.print("[MQTT IN] t="); Serial.print(millis());
  Serial.print(" topic="); Serial.print(topic);
  Serial.print(" msg="); Serial.println(message);

  if (message == "OPEN" && targetLocker >= 1 && targetLocker <= 4) {
    if (lastHasItemState[targetLocker - 1] != "true") {
      currentDepositStep = DEPOSIT_STEP_OPEN_DOOR;
      depositLockerId = targetLocker;
      depositStartTime = millis();
    }
    unlockBox(targetLocker, relayPins[targetLocker - 1]);
    updateDisplay();
    return;
  }

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (!error && targetLocker >= 1 && targetLocker <= 4) {
    if (doc.containsKey("otp")) {
      validOTPs[targetLocker - 1] = String((const char*)doc["otp"]);
      otpTimestamp[targetLocker - 1] = millis();
    }
    else if (doc.containsKey("action")) {
      String action = doc["action"];
      if (action == "DEPOSIT" || (action == "OPEN" && lastHasItemState[targetLocker - 1] != "true")) {
        currentDepositStep = DEPOSIT_STEP_OPEN_DOOR;
        depositLockerId = targetLocker;
        depositStartTime = millis();
        unlockBox(targetLocker, relayPins[targetLocker - 1]);
        updateDisplay();
      }
      else if (action == "AUTH_SUCCESS") {
        currentPickupStep = PICKUP_STEP_OPEN_DOOR;
        pickupLockerId = targetLocker;
        pickupStartTime = millis();
        otpAuthCompleted[targetLocker - 1] = true;
        doorWasOpened[targetLocker - 1] = false;
        itemWasRemoved[targetLocker - 1] = false;
        otpAuthTime[targetLocker - 1] = millis();

        unlockBox(targetLocker, relayPins[targetLocker - 1]);
        validOTPs[targetLocker - 1] = "";
        wrongPinAttempts = 0;
        updateDisplay();
      }
      else if (action == "AUTH_FAILED") {
        beep(100);
        display.clearDisplay(); 
        display.setTextColor(SH110X_WHITE);
        display.setTextSize(2); 
        display.setCursor(10, 24);
        display.print("WRONG PIN"); 
        Wire.setClock(400000); display.display(); Wire.setClock(100000);
        delay(1500);
      }
    }
  }
}

boolean reconnect() {
  if (WiFi.status() != WL_CONNECTED) return false;
  Serial.print("[MQTT] กำลังเชื่อมต่อ Broker... ");
  String clientId = "ESP32-"; clientId += String(random(0xffff), HEX);
  if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
    Serial.println("สำเร็จ [OK]");
    client.subscribe(locker_topic);
    for(int i = 0; i < 4; i++) {
      lastPublishedDoorState[i] = "UNKNOWN";
      lastPublishedHasItem[i] = "UNKNOWN";
    }
    return true;
  }
  Serial.print("ล้มเหลว (rc=");
  Serial.print(client.state());
  Serial.println(") จะลองใหม่ใน 5 วินาที");
  return false;
}

void setup() {
  Serial.begin(115200);
  pinMode(doorPin1, INPUT_PULLUP); pinMode(doorPin2, INPUT_PULLUP);
  pinMode(doorPin3, INPUT_PULLUP); pinMode(doorPin4, INPUT_PULLUP);
  for(int i=0; i<4; i++) { pinMode(relayPins[i], OUTPUT); digitalWrite(relayPins[i], HIGH); }
  
  Wire.begin(SDA_PIN, SCL_PIN); 
  Wire.setClock(100000); 
  Wire.setTimeOut(50); 
  delay(200);

  if(display.begin(i2c_Address, true)) { 
    display.clearDisplay(); 
    display.setTextColor(SH110X_WHITE);
    Serial.println("[OLED] เชื่อมต่อสำเร็จ (0x3C)");
  } else {
    Serial.println("[OLED] ไม่พบจอ OLED ที่ 0x3C! กรุณาตรวจสายไฟ I2C");
  }

  if (keyPad.begin()) {
    Serial.print("[Keypad] เชื่อมต่อสำเร็จที่ Address: 0x");
    Serial.println(KEYPAD_I2C_ADDR, HEX);
  } else {
    Serial.print("[Keypad] ไม่พบ Keypad ที่ Address 0x");
    Serial.println(KEYPAD_I2C_ADDR, HEX);
  }

  strip.begin();
  strip.setBrightness(190);
  strip.show();

  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  tcaselect(0);
  if (lox1.begin()) { lox1.configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_DEFAULT); Serial.println("[Sensor 1] OK"); }
  else Serial.println("[Sensor 1] INIT FAILED!");

  tcaselect(1);
  if (lox2.begin()) { lox2.configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_DEFAULT); Serial.println("[Sensor 2] OK"); }
  else Serial.println("[Sensor 2] INIT FAILED!");

  tcaselect(2);
  if (lox3.begin()) { lox3.configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_DEFAULT); Serial.println("[Sensor 3] OK"); }
  else Serial.println("[Sensor 3] INIT FAILED!");

  tcaselect(3);
  if (lox4.begin()) { lox4.configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_DEFAULT); Serial.println("[Sensor 4] OK"); }
  else Serial.println("[Sensor 4] INIT FAILED!");

  tcaDisable();

  calibrateSensors();
  delay(1500);

  display.clearDisplay(); display.setTextSize(1); display.setCursor(0, 10);
  display.println("Hold [D] now to");
  display.println("reset WiFi config");
  display.display();
  bool forceWifiReset = false;
  unsigned long bootCheckStart = millis();
  while (millis() - bootCheckStart < 2000) {
    uint8_t k = keyPad.getKey();
    if (k < 16 && keys[k] == 'D') { forceWifiReset = true; break; }
    delay(50);
  }
  if (forceWifiReset) {
    Serial.println("[WiFi] ผู้ใช้ขอรีเซ็ตค่า WiFi ตอนบูต");
    wm.resetSettings();
  }

  display.clearDisplay(); display.setCursor(15, 20);
  display.println("WIFI SETUP..."); display.display();

  wm.setConfigPortalTimeout(180);
  bool wifiOk = wm.autoConnect("Locker-Setup", "12345678");

  if (!wifiOk) {
    Serial.println("[WiFi] ตั้งค่าไม่สำเร็จภายในเวลาที่กำหนด กำลังรีสตาร์ท...");
    display.clearDisplay(); display.setTextSize(1); display.setCursor(10, 20);
    display.println("WIFI SETUP TIMEOUT");
    display.println("Rebooting...");
    display.display();
    delay(2000);
    ESP.restart();
  }
  Serial.print("[WiFi] เชื่อมต่อสำเร็จ IP: ");
  Serial.println(WiFi.localIP());

  display.clearDisplay(); display.setCursor(15, 20);
  display.println("SYNCING TIME..."); display.display();
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Waiting for NTP time sync");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(300);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println(" OK");

  espClient.setCACert(root_ca);
  espClient.setTimeout(3);
  client.setServer(mqtt_broker, mqtt_port); client.setCallback(callback);

  #if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    esp_task_wdt_config_t wdt_config = {
      .timeout_ms = WDT_TIMEOUT_SEC * 1000,
      .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
      .trigger_panic = true
    };
    esp_task_wdt_init(&wdt_config);
    esp_task_wdt_add(NULL);
  #else
    esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
    esp_task_wdt_add(NULL);
  #endif
}

void loop() {
  esp_task_wdt_reset();
  serviceBuzzer();
  checkDoorsFast();

  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      if (millis() - lastMqttReconnect > 5000) { 
        lastMqttReconnect = millis(); 
        reconnect(); 
      }
    } else {
      client.loop(); 
    }
  } else {
    static unsigned long lastWifiRetry = 0;
    if (millis() - lastWifiRetry >= 5000) {
      lastWifiRetry = millis();
      Serial.println("[WiFi] ⚠️ สัญญาณ Wi-Fi ขาดหาย กำลังรอเชื่อมต่อใหม่อัตโนมัติ...");
      WiFi.reconnect();
    }
  } 

  uint8_t keyIndex = keyPad.getKey();
  bool isLockedOut = (millis() < keypadLockoutUntil);

  if (isLockedOut) {
    static unsigned long lastLockoutDisplay = 0;
    if (millis() - lastLockoutDisplay >= 1000) {
      lastLockoutDisplay = millis();
      unsigned long remainSec = (keypadLockoutUntil - millis()) / 1000 + 1;
      display.clearDisplay(); 
      display.setTextColor(SH110X_WHITE);
      display.setTextSize(2); 
      display.setCursor(4, 16);
      display.print("LOCKED OUT");
      display.setTextSize(1); 
      display.setCursor(38, 42);
      display.print("wait "); display.print(remainSec); display.print("s");
      Wire.setClock(400000); display.display(); Wire.setClock(100000);
    }
  } else if (keyIndex < 16 && keyIndex != lastKeyIndex) {
    char key = keys[keyIndex]; 
    lastKeyPressTime = millis(); 
    bool inputChanged = false;

    Serial.print(">> [Keypad] กดปุ่ม: '");
    Serial.print(key);
    Serial.print("' | Index: ");
    Serial.println(keyIndex);

    if (key == '*') { 
      enteredPIN = ""; 
      inputChanged = true; 
      beepNonBlocking(50); 
    }
    else if (key == 'D') { 
      if (enteredPIN.length() > 0) { 
        enteredPIN.remove(enteredPIN.length() - 1); 
        inputChanged = true; 
        beepNonBlocking(35); 
      } 
    }
    else if (key >= '0' && key <= '9') { 
      if (enteredPIN.length() < 6) { 
        enteredPIN += key; 
        inputChanged = true; 
        beepNonBlocking(25);
      }
    }

    if (inputChanged) {
      updateDisplay();
    }

    if (enteredPIN.length() == 6) {
      delay(150); 
      bool isCorrect = false;
      for (int i = 0; i < 4; i++) {
        if (validOTPs[i] != "") {
          if (millis() - otpTimestamp[i] > OTP_TIMEOUT_MS) {
            validOTPs[i] = "";
            continue;
          }
          if (enteredPIN == validOTPs[i]) {
            otpAuthCompleted[i] = true;
            doorWasOpened[i] = false;
            itemWasRemoved[i] = false;
            otpAuthTime[i] = millis();

            currentPickupStep = PICKUP_STEP_OPEN_DOOR;
            pickupLockerId = i + 1;
            pickupStartTime = millis();

            Serial.print(">> [Keypad] ตู้ "); Serial.print(i + 1);
            Serial.println(": [เงื่อนไข 1/4 ผ่าน] รหัส OTP ถูกต้อง -> ปลดล็อกตู้ (รอผู้ใช้: เปิดตู้ -> นำของออก -> ปิดตู้)");

            doubleBeep();
            display.clearDisplay(); 
            display.setTextColor(SH110X_WHITE);
            display.setTextSize(2); 
            display.setCursor(16, 16);
            display.print("CORRECT!");
            display.setTextSize(1); 
            display.setCursor(19, 42);
            display.print("Unlocking Box "); display.print(i + 1);
            Wire.setClock(400000); display.display(); Wire.setClock(100000);
            delay(1000);

            unlockBox(i + 1, relayPins[i]); 
            validOTPs[i] = ""; 
            isCorrect = true;
            wrongPinAttempts = 0;
            enteredPIN = "";
            lastKeyPressTime = 0;
            isKeypadActive = false;
            updateDisplay();
            break; 
          }
        }
      }
      if (!isCorrect) {
        wrongPinAttempts++;
        Serial.print(">> [Keypad] กรอกรหัสผิด (ครั้งที่ ");
        Serial.print(wrongPinAttempts);
        Serial.println(") -> แจ้งเตือนหน้าจอให้กรอกใหม่ (ไม่ส่ง MQTT)");

        if (wrongPinAttempts >= MAX_WRONG_ATTEMPTS) {
          keypadLockoutUntil = millis() + KEYPAD_LOCKOUT_MS;
          wrongPinAttempts = 0;
          beep(500);
          display.clearDisplay(); 
          display.setTextColor(SH110X_WHITE);
          display.setTextSize(2); 
          display.setCursor(16, 15);
          display.print("TOO MANY");
          display.setCursor(28, 38);
          display.print("TRIES!");
          Wire.setClock(400000); display.display(); Wire.setClock(100000);
          delay(1500);
        } else {
          beep(250);
          display.clearDisplay(); 
          display.setTextColor(SH110X_WHITE);
          display.setTextSize(2); 
          display.setCursor(10, 16);
          display.print("WRONG PIN");
          display.setTextSize(1); 
          display.setCursor(16, 42);
          display.print("Please Try Again");
          Wire.setClock(400000); display.display(); Wire.setClock(100000);
          delay(1200);
        }
      }
      enteredPIN = ""; 
      updateDisplay(); 
    }
  }
  lastKeyIndex = keyIndex; 

  if (enteredPIN.length() > 0 && (millis() - lastKeyPressTime >= PIN_TIMEOUT)) {
    enteredPIN = ""; 
    updateDisplay(); 
  }

  isKeypadActive = (enteredPIN.length() > 0) || (lastKeyPressTime > 0 && (millis() - lastKeyPressTime < 2000));

  if (!isKeypadActive && (millis() - lastUpdate >= 1000)) {
    lastUpdate = millis(); 
    checkSensorsOnly();
    updateDisplay();
  }

  if (currentDepositStep == DEPOSIT_STEP_SUCCESS && (millis() - depositSuccessTime >= 3500)) {
    currentDepositStep = DEPOSIT_NONE;
    depositLockerId = 0;
    updateDisplay();
  }

  if (currentPickupStep == PICKUP_STEP_SUCCESS && (millis() - pickupSuccessTime >= 3500)) {
    currentPickupStep = PICKUP_NONE;
    pickupLockerId = 0;
    updateDisplay();
  }

  if (currentDepositStep != DEPOSIT_NONE && currentDepositStep != DEPOSIT_STEP_SUCCESS && (millis() - depositStartTime >= 120000UL)) {
    currentDepositStep = DEPOSIT_NONE;
    depositLockerId = 0;
    updateDisplay();
  }

  if (currentPickupStep != PICKUP_NONE && currentPickupStep != PICKUP_SUCCESS && (millis() - pickupStartTime >= 120000UL)) {
    currentPickupStep = PICKUP_NONE;
    pickupLockerId = 0;
    updateDisplay();
  }

  static unsigned long lastAfkAnim = 0;
  if (currentDepositStep == DEPOSIT_NONE && currentPickupStep == PICKUP_NONE && enteredPIN.length() == 0 && !isKeypadActive) {
    if (millis() - lastAfkAnim >= 200) {
      lastAfkAnim = millis();
      updateDisplay();
    }
  }

  static unsigned long lastDebugPrint = 0;
  if (millis() - lastDebugPrint >= 5000) {
    lastDebugPrint = millis();

    if (isKeypadActive) {
      Serial.print("[STATUS] ⌨️ คีย์แพดกำลังทำงาน (PIN ที่กรอก: ");
      Serial.print(enteredPIN.length());
      Serial.print("/6 หลัก");
      if (enteredPIN.length() > 0) {
        unsigned long elapsedKey = millis() - lastKeyPressTime;
        unsigned long remainKey = (elapsedKey < PIN_TIMEOUT) ? (PIN_TIMEOUT - elapsedKey) / 1000 : 0;
        Serial.print(" | เคลียร์อัตโนมัติใน ");
        Serial.print(remainKey);
        Serial.print("s");
      }
      Serial.println(")");
    } else {
      if (currentDepositStep != DEPOSIT_NONE) {
        const char* dStepStr = (currentDepositStep == DEPOSIT_STEP_OPEN_DOOR)  ? "1/4 [รอเปิดตู้]" :
                               (currentDepositStep == DEPOSIT_STEP_PLACE_ITEM) ? "2/4 [รอวางของ]" :
                               (currentDepositStep == DEPOSIT_STEP_CLOSE_DOOR) ? "3/4 [รอปิดตู้]" :
                               (currentDepositStep == DEPOSIT_STEP_SUCCESS)    ? "4/4 [ฝากสำเร็จ]" : "UNKNOWN";
        unsigned long dElapsed = millis() - depositStartTime;
        unsigned long dRemain = (dElapsed < 120000UL) ? (120000UL - dElapsed) / 1000 : 0;
        Serial.print("[STATUS] 📦 อยู่ในขั้นตอนฝากของ ตู้ ");
        Serial.print(depositLockerId);
        Serial.print(" ขั้นตอน: ");
        Serial.print(dStepStr);
        Serial.print(" | เหลือเวลา Timeout: ");
        Serial.print(dRemain);
        Serial.println("s");
      } else if (currentPickupStep != PICKUP_NONE) {
        const char* pStepStr = (currentPickupStep == PICKUP_STEP_OPEN_DOOR)  ? "1/4 [รอเปิดตู้]" :
                               (currentPickupStep == PICKUP_STEP_TAKE_ITEM)  ? "2/4 [รอหยิบของ]" :
                               (currentPickupStep == PICKUP_STEP_CLOSE_DOOR) ? "3/4 [รอปิดตู้]" :
                               (currentPickupStep == PICKUP_STEP_SUCCESS)    ? "4/4 [รับสำเร็จ]" : "UNKNOWN";
        unsigned long pElapsed = millis() - pickupStartTime;
        unsigned long pRemain = (pElapsed < 120000UL) ? (120000UL - pElapsed) / 1000 : 0;
        Serial.print("[STATUS] 🔑 อยู่ในขั้นตอนรับของ ตู้ ");
        Serial.print(pickupLockerId);
        Serial.print(" ขั้นตอน: ");
        Serial.print(pStepStr);
        Serial.print(" | เหลือเวลา Timeout: ");
        Serial.print(pRemain);
        Serial.println("s");
      } else {
        Serial.println("[STATUS] 🤖 สแตนด์บายปกติ (AFK Standby)");
      }

      debugRawReadAllSensors();
    }
  }
}
