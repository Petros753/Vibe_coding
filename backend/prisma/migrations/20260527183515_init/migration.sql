-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MANAGER', 'RESIDENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'ELEVATOR', 'INTERCOM', 'CLEANING', 'SECURITY', 'PARKING', 'OTHER');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('COLD_WATER', 'HOT_WATER', 'ELECTRICITY', 'GAS', 'HEAT');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResidentAccessLevel" AS ENUM ('OWNER', 'TENANT', 'FAMILY_MEMBER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TICKET_UPDATE', 'ANNOUNCEMENT', 'CHAT_MESSAGE', 'INTERCOM_CALL', 'METER_REMINDER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complexes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Москва',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "floors" INTEGER NOT NULL DEFAULT 9,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entrances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apartments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entranceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "area" DOUBLE PRECISION,
    "rooms" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apartments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "phone" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "middleName" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'RESIDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apartment_residents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "accessLevel" "ResidentAccessLevel" NOT NULL DEFAULT 'TENANT',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apartment_residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "complexId" TEXT,
    "buildingId" TEXT,
    "entranceId" TEXT,
    "name" TEXT NOT NULL,
    "rtspUrlEncrypted" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intercoms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entranceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "httpOpenUrl" TEXT,
    "httpOpenToken" TEXT,
    "sipLogin" TEXT,
    "sipPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intercoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intercom_call_logs" (
    "id" TEXT NOT NULL,
    "intercomId" TEXT NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "intercom_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL DEFAULT 'OTHER',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meters" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "type" "MeterType" NOT NULL,
    "serialNumber" TEXT,
    "installDate" TIMESTAMP(3),
    "nextCheckDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TEXT NOT NULL,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_inn_key" ON "organizations"("inn");

-- CreateIndex
CREATE INDEX "complexes_organizationId_idx" ON "complexes"("organizationId");

-- CreateIndex
CREATE INDEX "buildings_organizationId_idx" ON "buildings"("organizationId");

-- CreateIndex
CREATE INDEX "buildings_complexId_idx" ON "buildings"("complexId");

-- CreateIndex
CREATE INDEX "entrances_organizationId_idx" ON "entrances"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "entrances_buildingId_number_key" ON "entrances"("buildingId", "number");

-- CreateIndex
CREATE INDEX "apartments_organizationId_idx" ON "apartments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "apartments_entranceId_number_key" ON "apartments"("entranceId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "apartment_residents_organizationId_idx" ON "apartment_residents"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "apartment_residents_userId_apartmentId_key" ON "apartment_residents"("userId", "apartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

-- CreateIndex
CREATE INDEX "cameras_organizationId_idx" ON "cameras"("organizationId");

-- CreateIndex
CREATE INDEX "intercoms_organizationId_idx" ON "intercoms"("organizationId");

-- CreateIndex
CREATE INDEX "intercom_call_logs_intercomId_idx" ON "intercom_call_logs"("intercomId");

-- CreateIndex
CREATE INDEX "tickets_organizationId_idx" ON "tickets"("organizationId");

-- CreateIndex
CREATE INDEX "tickets_creatorId_idx" ON "tickets"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_organizationId_ticketNumber_key" ON "tickets"("organizationId", "ticketNumber");

-- CreateIndex
CREATE INDEX "ticket_comments_organizationId_idx" ON "ticket_comments"("organizationId");

-- CreateIndex
CREATE INDEX "ticket_comments_ticketId_idx" ON "ticket_comments"("ticketId");

-- CreateIndex
CREATE INDEX "chat_messages_organizationId_idx" ON "chat_messages"("organizationId");

-- CreateIndex
CREATE INDEX "chat_messages_chatRoomId_idx" ON "chat_messages"("chatRoomId");

-- CreateIndex
CREATE INDEX "announcements_organizationId_idx" ON "announcements"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "meters_organizationId_idx" ON "meters"("organizationId");

-- CreateIndex
CREATE INDEX "meters_apartmentId_idx" ON "meters"("apartmentId");

-- CreateIndex
CREATE INDEX "meter_readings_meterId_idx" ON "meter_readings"("meterId");

-- CreateIndex
CREATE UNIQUE INDEX "meter_readings_meterId_period_key" ON "meter_readings"("meterId", "period");

-- AddForeignKey
ALTER TABLE "complexes" ADD CONSTRAINT "complexes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrances" ADD CONSTRAINT "entrances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrances" ADD CONSTRAINT "entrances_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_entranceId_fkey" FOREIGN KEY ("entranceId") REFERENCES "entrances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartment_residents" ADD CONSTRAINT "apartment_residents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartment_residents" ADD CONSTRAINT "apartment_residents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartment_residents" ADD CONSTRAINT "apartment_residents_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_entranceId_fkey" FOREIGN KEY ("entranceId") REFERENCES "entrances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercoms" ADD CONSTRAINT "intercoms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercoms" ADD CONSTRAINT "intercoms_entranceId_fkey" FOREIGN KEY ("entranceId") REFERENCES "entrances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercom_call_logs" ADD CONSTRAINT "intercom_call_logs_intercomId_fkey" FOREIGN KEY ("intercomId") REFERENCES "intercoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
