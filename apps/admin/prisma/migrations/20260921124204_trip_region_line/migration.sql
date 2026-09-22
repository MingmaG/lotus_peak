-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "regions" TEXT[] DEFAULT ARRAY[]::TEXT[];
