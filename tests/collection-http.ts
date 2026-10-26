// Install fake-service I/O only after databases.ts has selected this test file's isolated database.
import { collectionHttp } from "@aihot/backend/sources/collection-http";
collectionHttp.fetch = async (url, opts) => (await import("@aihot/backend/lib/http-fetch")).guardedFetch(url, opts);
