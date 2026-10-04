# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Project Overview: LostReturn (Smart Locker System)
Web application for managing lost-and-found items with IoT smart lockers.

## Tech Stack
- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL with RLS enabled)
- **UI & Icons:** React Hooks, Lucide React, Radix / Tailwind
- **IoT Communication:** MQTT Protocol (Cloud MQTT Broker to ESP32)

## Key Development Commands
- `npm run dev`: Start local development server
- `npm run build`: Build production bundle
- `npx tsc --noEmit`: TypeScript type-check
- `npm run lint`: Run ESLint
