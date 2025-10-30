/*
  Warnings:

  - Added the required column `que_te_importa` to the `auditoria` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "auditoria" ADD COLUMN     "que_te_importa" TEXT NOT NULL;
