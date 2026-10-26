CREATE TABLE crawl_request_slots (host text PRIMARY KEY, finished_at timestamptz NOT NULL, interval_ms integer NOT NULL CHECK (interval_ms >= 5000));
