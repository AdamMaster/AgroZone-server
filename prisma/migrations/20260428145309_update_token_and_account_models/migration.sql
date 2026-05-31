/*
  Warnings:

  - A unique constraint covering the columns `[provider,provider_account_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,phone,token,type]` on the table `tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `provider_account_id` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "tokens_phone_token_type_key";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "provider_account_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "tokens_user_id_idx" ON "tokens"("user_id");

-- CreateIndex
CREATE INDEX "tokens_token_idx" ON "tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_email_phone_token_type_key" ON "tokens"("email", "phone", "token", "type");
