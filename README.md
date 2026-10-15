# AeroSync

A mobile app for airport ground crews: baggage registration and QR tracking, crew
coordination, and delay-risk monitoring. Final-year project, BSc Computer Science,
Strathmore University.

Built with Expo (React Native, TypeScript, Expo Router) and Firebase (Auth, Firestore).

## Features

**Supervisor** (tabs: Operations, Baggage, Crew, Delay Risk, Account)
- Approve new staff accounts
- Register baggage and generate a QR code for each bag
- View all registered baggage and its status
- Assign handlers to flights and shifts
- Monitor delay-risk indicators

**Handler** (tabs: Home, My Tasks, Scan QR, Incidents, Account)
- View assigned shifts, check in and out, update task progress
- Scan baggage QR codes and record loading and offloading
- Incident reporting is a placeholder ("coming soon")

New accounts start as `pending` and can't access operational data until approved.

## Baggage workflow

1. **Register** (Baggage → *Register Baggage*): enter a flight number and baggage
   reference. Flight numbers are validated and stored in one format (`kq-100` → `KQ100`).
   After saving, the page shows the bag's details and QR code, with *Save QR to Photos*.
2. **Scan** (Scan QR tab): scan with the camera or choose a QR image from Photos.
   Only AeroSync codes (`AEROSYNC:BAGGAGE:<documentId>`) are accepted.
3. **Update status**: only the next valid step is offered:
   `Registered` → *Record Loading* → `Loading` → *Record Offloading* → `Offloaded`.
   An optional *Active flight* field warns before handling a bag from another flight.

Each step saves the status change and a timestamped history entry together in one
Firestore transaction, so a bag can't be loaded twice or offloaded before loading,
even if two handlers scan it at once.

### Firestore data

| Collection | Key fields |
|---|---|
| `BaggageRecords/{id}` | `baggageId` (`BAG-<id>`), `flightId`, `baggageReference`, `status`, `qrPayload`, `registeredBy`, `createdAt`, `lastHandlingAction`, `lastHandledBy`, `lastHandledAt` |
| `BaggageRecords/{id}/handlingEvents/{id}` | `action`, `baggageId`, `flightId`, `handlerUid`, `timestamp` |
| `users/{uid}` | `email`, `displayName`, `role` (`pending` / `handler` / `supervisor`), `requestedRole` |
| `CrewAssignments/{id}` | `handlerUid`, `flightNumber`, `shiftDate`, `shiftTime`, `activity`, `status`, `attendanceStatus` |

## Getting started

Requires **Node.js 24.12+** (Firebase SDK) and **Expo Go** on your phone.

```bash
npm install
npx expo start      # scan the QR in the terminal with Expo Go
```

Use `npx expo start -c` after adding native packages. The first supervisor must be set
in the Firebase console (`users/{uid}.role = "supervisor"`); after that, supervisors
approve new accounts in the app.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm test` | Unit tests (Jest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | Lint |

Unit tests in `src/features/baggage/__tests__` cover the handling rules, QR parsing and
flight-number validation.

## Project structure

```
src/
  app/                  Screens (Expo Router), e.g. baggage.tsx, scan-qr.tsx
  components/           Shared UI, incl. register-baggage-screen.tsx, baggage-qr-card.tsx
  features/baggage/     Baggage logic: handling rules, transaction, QR, validation, tests
  lib/firebase.ts       Firebase setup
data/, scripts/, ml/    Dataset, data pipeline (Python) and delay-risk model notebook
```

## Known gaps

- Firestore security rules are not yet in the repo (`firebase.json` points to a
  missing `firestore.rules`), so access control is currently enforced in the app only.
