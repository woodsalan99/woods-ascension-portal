-- Optional deadline on a client task. Most tasks won't have one.
ALTER TABLE "ClientTask" ADD COLUMN "dueAt" TIMESTAMP(3);
