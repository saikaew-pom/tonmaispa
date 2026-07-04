-- ============================================================
-- TON MAI SPA — align the guest CRM table with the customers schema in
-- TWILIO_BOOKING_CRM_PLAN.md, so later phases (identities, conversation
-- threads, handoffs, automation jobs) can reference `customers`/`customer_id`
-- directly without a naming mismatch.
-- ============================================================

ALTER TABLE guests RENAME TO customers;
ALTER TABLE customers RENAME COLUMN full_name TO display_name;
ALTER TABLE customers RENAME COLUMN phone TO primary_phone_e164;

ALTER TABLE customers
  ADD COLUMN preferred_language   text,
  ADD COLUMN whatsapp_consent_at  timestamptz,
  ADD COLUMN marketing_consent_at timestamptz,
  ADD COLUMN opted_out_at         timestamptz,
  ADD COLUMN last_contact_at      timestamptz,
  ADD COLUMN last_visit_at        date,
  ADD COLUMN visit_count          integer NOT NULL DEFAULT 0,
  ADD COLUMN lifetime_value       numeric NOT NULL DEFAULT 0;

ALTER TABLE bookings RENAME COLUMN guest_id TO customer_id;
ALTER TABLE chat_sessions ADD COLUMN customer_id uuid REFERENCES customers(id);

-- Backfill visit_count / lifetime_value / last_visit_at from completed bookings
UPDATE customers c SET
  visit_count    = sub.cnt,
  lifetime_value = sub.total,
  last_visit_at  = sub.last_date
FROM (
  SELECT customer_id, count(*) AS cnt, sum(price) AS total, max(date) AS last_date
  FROM bookings WHERE status = 'completed' AND customer_id IS NOT NULL
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id;

-- Keep visit_count / lifetime_value / last_visit_at in sync automatically
-- whenever a booking's status changes to or from 'completed' — matches the
-- plan's "Update visit count and lifetime value after completed bookings"
-- CRM automation, implemented here as a trigger rather than a job queue
-- since it's a pure same-database rollup with no external side effects.
CREATE OR REPLACE FUNCTION sync_customer_stats() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'completed' AND OLD.customer_id IS NOT NULL THEN
      UPDATE customers SET
        visit_count = visit_count - 1,
        lifetime_value = lifetime_value - COALESCE(OLD.price, 0)
      WHERE id = OLD.customer_id;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.customer_id IS NOT NULL THEN
      UPDATE customers SET
        visit_count = visit_count + 1,
        lifetime_value = lifetime_value + COALESCE(NEW.price, 0),
        last_visit_at = GREATEST(COALESCE(last_visit_at, NEW.date), NEW.date)
      WHERE id = NEW.customer_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    IF NEW.customer_id IS NOT NULL THEN
      UPDATE customers SET
        visit_count = visit_count - 1,
        lifetime_value = lifetime_value - COALESCE(OLD.price, 0)
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_stats ON bookings;
CREATE TRIGGER trg_sync_customer_stats
AFTER INSERT OR UPDATE OF status OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION sync_customer_stats();
