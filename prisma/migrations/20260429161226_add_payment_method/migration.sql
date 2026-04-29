-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'YAPE', 'PLIN', 'CARD', 'OTHER');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "tip" DOUBLE PRECISION;
