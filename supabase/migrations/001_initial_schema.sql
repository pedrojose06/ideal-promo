-- Profiles: extends auth.users
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  whatsapp        TEXT,
  notify_email    BOOLEAN NOT NULL DEFAULT true,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their profile"
  ON profiles FOR ALL USING (auth.uid() = id);

-- Auto-create profile on sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Alerts
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  search_query    TEXT,
  product_url     TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  frequency_hours INT NOT NULL DEFAULT 6,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT must_have_query_or_url CHECK (
    search_query IS NOT NULL OR product_url IS NOT NULL
  )
);

CREATE INDEX idx_alerts_next_run ON alerts (next_run_at)
  WHERE is_active = true;

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their alerts"
  ON alerts FOR ALL USING (auth.uid() = user_id);

-- Promotions
CREATE TABLE promotions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id        UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  title           TEXT NOT NULL,
  snippet         TEXT,
  coupon_code     TEXT,
  price           NUMERIC(12,2),
  original_price  NUMERIC(12,2),
  discount_pct    INT,
  found_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at     TIMESTAMPTZ,
  content_hash    TEXT NOT NULL,
  UNIQUE (alert_id, content_hash)
);

CREATE INDEX idx_promotions_pending ON promotions (alert_id)
  WHERE notified_at IS NULL;

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see their promotions"
  ON promotions FOR SELECT
  USING (
    alert_id IN (
      SELECT id FROM alerts WHERE user_id = auth.uid()
    )
  );

-- Notification logs
CREATE TABLE notification_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id  UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_id   TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see their logs"
  ON notification_logs FOR SELECT
  USING (
    promotion_id IN (
      SELECT p.id FROM promotions p
      JOIN alerts a ON a.id = p.alert_id
      WHERE a.user_id = auth.uid()
    )
  );
