# 🚀 Bilimdon Backend API

**NestJS-based REST API server for the Bilimdon educational platform.**

---

## 📦 Tech Stack

- **Framework:** NestJS 10+
- **Language:** TypeScript
- **Database:** PostgreSQL + TypeORM
- **Authentication:** JWT + Passport
- **Caching:** Redis + IORedis
- **Real-time:** Socket.IO
- **Documentation:** Swagger/OpenAPI
- **File Upload:** Multer
- **Email:** Nodemailer
- **Validation:** class-validator & class-transformer

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev
```

**Server runs on:** `http://localhost:3001`  
**Swagger Docs:** `http://localhost:3001/api/docs`

---

## ⚙️ Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/bilimdon?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# External APIs
GEMINI_API_KEY=your-gemini-api-key
TELEGRAM_BOT_TOKEN=your-telegram-token
TELEGRAM_BOT_USERNAME=YourBotName
WEBAPP_URL=http://localhost:3000

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

---

## 📂 Project Structure

```
src/
├── modules/
│   ├── auth/              # Authentication (JWT, login, register)
│   ├── users/             # User management & profiles
│   ├── questions/         # Quiz questions & storage
│   ├── tests/             # Test management & evaluation
│   ├── categories/        # Topic categorization
│   ├── ai/                # Gemini AI integration
│   ├── telegram/          # Telegram bot handler
│   ├── achievements/      # Badge & achievement system
│   ├── leaderboard/       # Ranking & statistics
│   ├── stats/             # User analytics
│   ├── notifications/     # Email & push alerts
│   ├── upload/            # File upload service
│   ├── mail/              # Email sender
│   └── admin/             # Admin operations
├── app.module.ts          # Root module
└── main.ts                # Application entry point

scripts/                    # Utility & migration scripts
```

---

## 📚 API Modules

### 🔐 Auth Module

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/logout` - User logout

### 👥 Users Module

- `GET /api/users` - List users
- `GET /api/users/:id` - Get user details
- `PATCH /api/users/:id` - Update profile
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/:id/stats` - User statistics

### 📝 Questions Module

- `GET /api/questions` - Get questions (paginated)
- `GET /api/questions/:id` - Get question details
- `POST /api/questions` - Create question (admin)
- `PUT /api/questions/:id` - Update question (admin)
- `DELETE /api/questions/:id` - Delete question (admin)
- `GET /api/questions/category/:categoryId` - Questions by category

### 🧪 Tests Module

- `POST /api/tests/start` - Start new test
- `GET /api/tests/:id` - Get test details
- `POST /api/tests/:id/submit` - Submit test answers
- `GET /api/tests/user/history` - User test history
- `GET /api/tests/:id/results` - Test results

### 📚 Categories Module

- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Category details
- `GET /api/categories/:id/stats` - Category statistics
- `POST /api/categories` - Create category (admin)
- `PUT /api/categories/:id` - Update category (admin)

### 🤖 AI Module

- `POST /api/ai/chat` - Chat with AI
- `GET /api/ai/generate-questions` - Generate questions (admin)
- `POST /api/ai/explain` - Explain concept

### 🏆 Leaderboard Module

- `GET /api/leaderboard` - Global rankings
- `GET /api/leaderboard/weekly` - Weekly rankings
- `GET /api/leaderboard/category/:id` - Category rankings
- `GET /api/leaderboard/user/:id` - User position

### 🎖️ Achievements Module

- `GET /api/achievements` - List all achievements
- `GET /api/users/:id/achievements` - User achievements
- `POST /api/achievements` - Create achievement (admin)

### 📊 Stats Module

- `GET /api/stats/dashboard` - Dashboard statistics
- `GET /api/stats/user/:id` - User statistics
- `GET /api/stats/category/:id` - Category statistics

### 📱 Telegram Module

- `POST /api/telegram/webhook` - Webhook for Telegram updates
- `GET /api/telegram/status` - Bot status

### 📧 Notifications Module

- `POST /api/notifications/email` - Send email
- `POST /api/notifications/subscribe` - Subscribe to alerts

---

## 🛠️ Available Scripts

```bash
# Development
npm run start              # Start server
npm run start:dev         # Development mode with hot reload
npm run start:debug       # Debug mode

# Production
npm run build             # Compile TypeScript to JavaScript
npm run start:prod        # Run compiled code

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format code with Prettier
npm run test              # Run unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run test:e2e          # E2E tests
```

---

## 🔑 Authentication

### JWT Flow

1. User registers or logs in
2. Server generates JWT token
3. Client includes token in Authorization header
4. Server validates token before processing request
5. Token expires after JWT_EXPIRES_IN period

### Protected Routes

All routes marked with `@UseGuards(JwtAuthGuard)` require valid JWT token in header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 📊 Database

### TypeORM Entities

Entity fayllar `src/modules/*/entities/` papkalarida joylashgan. Har bir modul o'zining entity fayllariga ega.

---

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### Test Coverage

```bash
npm run test:cov
```

### E2E Tests

```bash
npm run test:e2e
```

---

## 📖 API Documentation

### Swagger UI

- **URL:** `http://localhost:3001/api/docs`
- **JSON:** `http://localhost:3001/api-json`

All endpoints are documented with:

- Request parameters
- Response schemas
- Example payloads
- Error responses

---

## 🔒 Security Features

- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ CORS configuration
- ✅ Helmet for HTTP headers
- ✅ Rate limiting
- ✅ Input validation
- ✅ SQL injection protection (TypeORM)
- ✅ HTTPS support

---

## 🚀 Deployment

### Build for Production

```bash
npm run build
npm run start:prod
```

### Docker

```bash
docker build -t bilimdon-backend .
docker run -p 3001:3001 --env-file .env bilimdon-backend
```

### Environment Variables for Production

```env
NODE_ENV=production
JWT_SECRET=<strong-random-key>
DATABASE_URL=<production-postgres-url>
REDIS_HOST=<production-redis-host>
TELEGRAM_BOT_TOKEN=<your-bot-token>
GEMINI_API_KEY=<your-api-key>
```

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
# Verify DATABASE_URL in .env
```

### Port Already in Use

```bash
# Check port: lsof -i :3001 (Linux/Mac)
# Kill process: kill -9 <PID>
# Or change PORT in .env
```

---

## 📚 Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Guide](https://jwt.io/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Google Generative AI](https://ai.google.dev/)

---

## 👨‍💻 Author

**Bekmuhammad**

---

## 📝 License

MIT License

---

**Happy Backend Development! 🚀**
