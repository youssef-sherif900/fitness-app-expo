# Fitness app (Expo SDK 57) — F0 foundation + F1 nutrition slice

## Setup
```bash
npx create-expo-app@latest fitness-app --template default@sdk-57
cd fitness-app && npm run reset-project   # then delete app-example/
# copy this folder's app/, src/, app.json, tsconfig.json, .env.example over the project
cp .env.example .env                      # set EXPO_PUBLIC_API_URL to your LAN IP
npx expo install expo-router expo-sqlite expo-secure-store expo-crypto expo-camera \
  @react-native-community/netinfo react-native-safe-area-context @expo/vector-icons
npm i @tanstack/react-query zustand react-hook-form zod @hookform/resolvers
npx expo install --fix
npx expo start
```
Backend: `docker compose up` must be reachable from the phone (use the LAN IP, not localhost).
