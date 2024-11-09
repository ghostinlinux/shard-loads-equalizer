import { test as baseTest } from "@playwright/test";
import { recordTestsExecutionTime } from "shard-loads-equalizer";
import dotenv from "dotenv";

dotenv.config();
const auto = Boolean(process.env.AUTO) || false;

export const test = baseTest.extend<{ executeTimeLog: void }>({
  executeTimeLog: [
    async ({}, use, testInfo) => {
      await use();
      recordTestsExecutionTime(testInfo);
    },
    { auto: auto },
  ],
});

export { expect } from "@playwright/test";
