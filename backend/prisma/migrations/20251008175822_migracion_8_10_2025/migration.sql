/*
  Warnings:

  - The values [documento] on the enum `resp_consulta` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "resp_consulta_new" AS ENUM ('abogado', 'IA');
ALTER TABLE "consulta" ALTER COLUMN "opcion_respuesta" TYPE "resp_consulta_new" USING ("opcion_respuesta"::text::"resp_consulta_new");
ALTER TYPE "resp_consulta" RENAME TO "resp_consulta_old";
ALTER TYPE "resp_consulta_new" RENAME TO "resp_consulta";
DROP TYPE "resp_consulta_old";
COMMIT;
