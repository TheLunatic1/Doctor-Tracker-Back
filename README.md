# Doctor Tracker - Backend REST API

> Secure, production-ready Node.js & Express RESTful API powering the Doctor Tracker healthcare administration platform. Built with TypeScript, MongoDB (Mongoose), and Zod.

---

## 🌟 Overview

The Doctor Tracker Backend provides robust healthcare data services:
- **Authentication & Security:** JWT tokens delivered via `httpOnly`, `SameSite=Lax`, `Secure` cookies with Bearer token fallback, Argon2/Bcrypt password hashing, Helmet headers, CORS policies, and rate-limiting.
- **Doctor & Patient Management:** Rich CRUD operations with multi-field search, compound index filtering, strict relational consistency, and configurable cascade deletion.
- **Analytics Aggregation Engine:** High-performance database-level pipelines calculating executive KPIs, patient distribution by medical condition, top doctor workloads, and zero-filled continuous time-series.
- **Quality Assured:** 35 automated integration tests running against in-memory MongoDB with 100% `IXSCAN` query plan verification.

---

## 🌐 Live API Deployment

- **Base URL:** [https://toha.tail2c2947.ts.net:10000](https://toha.tail2c2947.ts.net:10000)
- **Health Check:** [https://toha.tail2c2947.ts.net:10000/health](https://toha.tail2c2947.ts.net:10000/health)
- **API Prefix:** `/api/v1`

---

### 1. User (`src/models/User.ts`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `name` | String | required, trim | Administrator's display name |
| `email` | String | required, unique, lowercase, indexed | Login identifier |
| `password` | String | required, select: false | Bcrypt hashed password (12 rounds) |
| `role` | String | enum: `['admin', 'staff']`, default: `'admin'` | Access control role |
| `createdAt` | Date | default: `Date.now` | Account creation timestamp |

### 2. Doctor (`src/models/Doctor.ts`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `name` | String | required, trim, index | Doctor full name |
| `specialization` | String | required, index | Medical specialty (e.g. Cardiology, Neurology) |
| `hospital` | String | required, index | Affiliated medical facility |
| `phone` | String | required, trim | Contact telephone |
| `email` | String | required, unique, lowercase | Professional email address |
| `qualification` | String | optional | Degrees (e.g. MBBS, MD, FCPS) |
| `yearsExperience`| Number | default: 5 | Clinical experience |
| `rating` | Number | default: 4.8 | Patient feedback rating (1-5) |
| `status` | String | enum: `['Active', 'On Leave', 'Inactive']` | Current availability |
| `createdAt` | Date | indexed | Registration timestamp |

**Compound Indexes:**
- `{ specialization: 1, createdAt: -1 }`
- `{ hospital: 1, createdAt: -1 }`
- `{ name: 'text', email: 'text' }`

### 3. Patient (`src/models/Patient.ts`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `name` | String | required, trim, index | Patient full name |
| `age` | Number | required, min: 0, max: 125 | Patient age in years |
| `gender` | String | enum: `['Male', 'Female', 'Other']` | Biological/registered gender |
| `phone` | String | required, trim | Primary phone number |
| `condition` | String | required, index | Diagnosis / admitted condition |
| `doctor` | ObjectId | ref: `'Doctor'`, required, index | Attending physician reference |
| `admittedAt` | Date | default: `Date.now`, index | Hospital admission timestamp |
| `createdAt` | Date | indexed | Record creation timestamp |

**Compound Indexes:**
- `{ doctor: 1, createdAt: -1 }`
- `{ condition: 1, createdAt: -1 }`
- `{ admittedAt: -1 }`

---

## 📡 API Specification

All responses adhere to the standard envelope format:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 10, "total": 48, "totalPages": 5, "hasNext": true, "hasPrev": false },
  "error": null
}
```

### 1. Health
- `GET /health` - System health probe (returns `{ status: "ok", timestamp }`).

### 2. Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/v1/auth/login` | Authenticate with email and password; sets `httpOnly` cookie | No |
| `POST` | `/api/v1/auth/logout` | Invalidate cookie and terminate session | Yes |
| `GET` | `/api/v1/auth/me` | Fetch currently logged in user profile | Yes |

### 3. Doctors (`/api/v1/doctors`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/api/v1/doctors` | Paginated doctors list. Query params: `page`, `limit`, `search`, `specialization`, `hospital`, `dateFrom`, `dateTo`, `sort` | Yes |
| `POST` | `/api/v1/doctors` | Create a new doctor record | Yes |
| `GET` | `/api/v1/doctors/:id` | Fetch doctor profile by ID | Yes |
| `PUT` | `/api/v1/doctors/:id` | Update doctor information | Yes |
| `DELETE`| `/api/v1/doctors/:id` | Delete doctor. Blocks with 409 if active patients exist unless `?cascade=true` | Yes |

### 4. Doctor Patients (`/api/v1/doctors/:id/patients`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/api/v1/doctors/:id/patients` | List all patients admitted under specified doctor | Yes |
| `POST` | `/api/v1/doctors/:id/patients` | Add a patient assigned directly to this doctor | Yes |
| `DELETE`| `/api/v1/doctors/:id/patients/:patientId` | Remove patient from this doctor's roster | Yes |

### 5. Patients (`/api/v1/patients`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/api/v1/patients` | Paginated patients list. Query params: `page`, `limit`, `search`, `condition`, `doctorId`, `dateFrom`, `dateTo`, `sort` | Yes |
| `GET` | `/api/v1/patients/:id` | Fetch patient record by ID (populates doctor details) | Yes |
| `PUT` | `/api/v1/patients/:id` | Update patient demographic/condition details | Yes |
| `DELETE`| `/api/v1/patients/:id` | Remove patient record | Yes |

### 6. Analytics (`/api/v1/analytics`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/api/v1/analytics/overview` | High-level metrics: total doctors, total patients, average patient ratio, month-over-month growth | Yes |
| `GET` | `/api/v1/analytics/timeline` | Admissions over time (`range`: `7d`, `30d`, `6m`, `1y`; `groupBy`: `day`, `week`, `month`) with zero-filled missing buckets | Yes |
| `GET` | `/api/v1/analytics/conditions` | Patient count and percentage breakdown by medical condition | Yes |
| `GET` | `/api/v1/analytics/specializations` | Doctor distribution by medical specialty | Yes |
| `GET` | `/api/v1/analytics/patients-per-doctor` | Top doctors ranked by active patient count | Yes |
| `GET` | `/api/v1/analytics/recent` | Recent additions (latest 5 doctors and patients) | Yes |

---

## 🚀 Setup & Local Execution

### Prerequisites
- Node.js >= 20.x
- MongoDB (local instance or MongoDB Atlas cluster)

### Installation

```bash
# Clone the repository
git clone https://github.com/TheLunatic1/Doctor-Tracker-Back.git
cd Doctor-Tracker-Back

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
```

### Environment Variables (`.env`)
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/doctor_tracker
JWT_SECRET=super_secret_jwt_key_doctor_tracker_autonomous_2026_xyz
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
ADMIN_EMAIL=admin@doctortracker.com
ADMIN_PASSWORD=Admin123456!
```

### Database Seeding
Populate the database idempotently with 1 admin, 48 diverse doctors across 8 hospitals, and 500+ patients spread chronologically over 12 months:
```bash
npm run seed
```

### Build & Run Commands

```bash
# Start development server with live reload
npm run dev

# Run TypeScript type check
npm run typecheck

# Run ESLint (enforcing 0 warnings)
npm run lint

# Compile production TypeScript to dist/
npm run build

# Start production server
npm start

# Run automated Vitest test suite
npm test
```

---

## 🧪 Testing

The backend includes a comprehensive 35-test suite covering:
- **Phase 1:** Seed idempotency, model validations, index declarations, health check.
- **Phase 2:** Login credential checking, JWT cookie generation, route protection, token tampering prevention.
- **Phase 3:** Full CRUD, regex search sanitation, pagination mathematical accuracy, 409 conflict on active patient deletion, and `.explain('executionStats')` verifying index scans (`IXSCAN`).
- **Phase 4:** Aggregation accuracy, continuous timeline zero-filling, and distribution percentage calculations.

```bash
npm test
```

---

## 📄 License
MIT © Doctor Tracker Engineering
