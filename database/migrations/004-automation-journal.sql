CREATE TABLE IF NOT EXISTS automation_spend (
  kind VARCHAR(32) NOT NULL, job_id CHAR(36) NOT NULL, day CHAR(10) NOT NULL,
  amount_sun DECIMAL(30,0) NOT NULL CHECK (amount_sun >= 0),
  PRIMARY KEY(kind, job_id, day), INDEX automation_spend_day (kind, day)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS automation_funding (
  job_id CHAR(36) PRIMARY KEY, txid CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  payload LONGTEXT NOT NULL, confirmed TINYINT NOT NULL DEFAULT 0 CHECK (confirmed IN (0,1))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS automation_sweeps (
  id CHAR(36) PRIMARY KEY, request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  destination CHAR(34) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_units DECIMAL(30,0) NOT NULL, status VARCHAR(16) NOT NULL, txid CHAR(64) CHARACTER SET ascii COLLATE ascii_bin UNIQUE,
  payload LONGTEXT, fee_limit BIGINT UNSIGNED NOT NULL, created_at BIGINT UNSIGNED NOT NULL, updated_at BIGINT UNSIGNED NOT NULL,
  issue VARCHAR(64), active_job TINYINT GENERATED ALWAYS AS (CASE WHEN status IN ('planned','signed','submitted') THEN 1 ELSE NULL END) STORED,
  UNIQUE KEY one_active_sweep (active_job)
) ENGINE=InnoDB;
