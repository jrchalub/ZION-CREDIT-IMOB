import "dotenv/config";
import { pingRedis } from "../infra/redis";
import { getStorageProvider } from "../infra/storage";

async function main() {
  const redis = await pingRedis();
  await getStorageProvider().ensureBucket();
  console.log(
    JSON.stringify(
      {
        redis,
        minio: true,
        databaseUrlHostPort: "localhost:5433",
        dbUser: "zioncredit",
        baas: "none",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
